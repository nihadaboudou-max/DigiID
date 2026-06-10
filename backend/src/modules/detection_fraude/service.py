# -*- coding: utf-8 -*-
"""Service de détection de fraude et calcul du score de risque."""
from typing import Optional

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.parametres import parametres
from src.modeles import FraudeIncident, Utilisateur
from src.modules.detection_fraude import modele_anomalies, regles, scoring_risque
from src.modules.detection_fraude.schemas import (
    ActionFraudeRequete,
    IncidentFraude,
    ListeIncidentsFraude,
    ScoreRisque,
)
from src.noyau import journal
from src.noyau.exceptions import ErreurFraudeDetectee


async def evaluer_risque_action(
    session: AsyncSession,
    utilisateur: Utilisateur,
    action: ActionFraudeRequete,
    adresse_ip: Optional[str] = None,
) -> ScoreRisque:
    """Évalue le risque d'une action utilisateur et enregistre un incident. """
    facteurs = [
        regles.evaluer_tentatives_connexion_echec(
            action.tentatives_connexion_echec,
            seuil=parametres.seuil_tentatives_connexion_echec,
        )
    ]

    if action.latitude is not None and action.longitude is not None:
        facteurs.append(
            regles.evaluer_geolocalisation(
                action.latitude,
                action.longitude,
                action.latitude_precedente,
                action.longitude_precedente,
            )
        )

    if action.appareil:
        facteurs.append(regles.evaluer_appareil(action.appareil, None))

    distance_km = 0.0
    if action.latitude is not None and action.longitude is not None and action.latitude_precedente is not None and action.longitude_precedente is not None:
        distance_km = regles._distance_kilometres(
            action.latitude_precedente,
            action.longitude_precedente,
            action.latitude,
            action.longitude,
        )

    anomalie = modele_anomalies.score_anomalie(
        {
            "tentatives_connexion_echec": float(action.tentatives_connexion_echec),
            "distance_km": distance_km,
            "changement_appareil": bool(action.appareil),
        }
    )

    resultat = scoring_risque.calculer_score_risque(facteurs, anomalie)

    incident = FraudeIncident(
        utilisateur_id=utilisateur.id,
        type_action=action.type_action,
        score_risque=resultat.score_total,
        niveau=resultat.niveau,
        description=resultat.interpretation,
        adresse_ip=adresse_ip,
        appareil=action.appareil,
        details={
            "tentatives_connexion_echec": action.tentatives_connexion_echec,
            "distance_km": round(distance_km, 2),
            "anomalie": round(anomalie, 3),
            "metadonnees": action.metadonnees,
        },
    )
    session.add(incident)
    await session.commit()
    await session.refresh(incident)

    journal.info(
        f"Incident fraude enregistré : utilisateur={utilisateur.id} score={resultat.score_total}"
    )

    if resultat.score_total >= parametres.seuil_score_risque_blocage:
        raise ErreurFraudeDetectee(
            "Action bloquée par le moteur de détection de fraude.",
            message_utilisateur=(
                "Notre système de sécurité a détecté un risque élevé et a bloqué cette action. "
                "Si tu penses que c'est une erreur, contacte le support."
            ),
            donnees_supplementaires={
                "score_risque": resultat.score_total,
                "niveau": resultat.niveau,
            },
        )

    return resultat


async def obtenir_score_risque_actuel(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> ScoreRisque:
    """Retourne le dernier score de risque enregistré pour l'utilisateur."""
    resultat = await session.execute(
        select(FraudeIncident)
        .where(FraudeIncident.utilisateur_id == utilisateur.id)
        .order_by(desc(FraudeIncident.cree_le))
        .limit(1)
    )
    incident = resultat.scalar_one_or_none()
    if incident is None:
        return ScoreRisque(
            score_total=0,
            niveau="faible",
            interpretation="Aucun incident de fraude détecté."
            "Les actions sont autorisées par défaut.",
            facteurs=[],
        )
    return ScoreRisque(
        score_total=incident.score_risque,
        niveau=incident.niveau,
        interpretation=incident.description,
        facteurs=[],
    )


async def lister_incidents(
    session: AsyncSession,
    utilisateur: Utilisateur,
    limite: int = 50,
) -> ListeIncidentsFraude:
    """Liste les incidents de fraude pour un utilisateur."""
    resultat = await session.execute(
        select(FraudeIncident)
        .where(FraudeIncident.utilisateur_id == utilisateur.id)
        .order_by(desc(FraudeIncident.cree_le))
        .limit(limite)
    )
    incidents = resultat.scalars().all()

    return ListeIncidentsFraude(
        incidents=[IncidentFraude(
            id=incident.id,
            utilisateur_id=incident.utilisateur_id,
            type_action=incident.type_action,
            score_risque=incident.score_risque,
            niveau=incident.niveau,
            description=incident.description,
            adresse_ip=incident.adresse_ip,
            appareil=incident.appareil,
            details=incident.details,
            date_evenement=incident.cree_le,
        ) for incident in incidents],
        total=len(incidents),
    )
