# -*- coding: utf-8 -*-
"""Agrégats d'analyse logistique filtrés selon le rôle connecté."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import Float, and_, cast, extract, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from src.modeles.analytique import PrevisionDemandeLigneAnalytique
from src.modeles.logistique import (
    Colis,
    Gare,
    Ligne,
    SuiviFamilial,
    Vehicule,
    Voyage,
)
from src.modeles.utilisateur import Utilisateur
from src.modules.logistique import service
from src.noyau.constantes_roles import RoleUtilisateur


async def obtenir_analyses_logistiques(
    session: AsyncSession, utilisateur: Utilisateur
) -> dict:
    """Retourne des indicateurs agrégés, sans charger de listes opérationnelles."""
    filtres_voyages = []
    gare_perimetre = None
    if utilisateur.role == RoleUtilisateur.CHAUFFEUR.value:
        filtres_voyages.append(Voyage.chauffeur_id == utilisateur.id)
    elif service._est_guichet(utilisateur):
        gare_perimetre = await service._gare_de_l_agent(session, utilisateur.id)
        if gare_perimetre is not None:
            filtres_voyages.append(
                or_(
                    Ligne.gare_depart_id == gare_perimetre,
                    Ligne.gare_arrivee_id == gare_perimetre,
                )
            )

    gare_depart = aliased(Gare)
    gare_arrivee = aliased(Gare)
    routes_resultat = await session.execute(
        select(gare_depart.ville, gare_arrivee.ville)
        .select_from(Voyage)
        .join(Ligne, Ligne.id == Voyage.ligne_id)
        .join(gare_depart, gare_depart.id == Ligne.gare_depart_id)
        .join(gare_arrivee, gare_arrivee.id == Ligne.gare_arrivee_id)
        .where(*filtres_voyages)
        .distinct()
    )
    routes = sorted(set(routes_resultat.tuples().all()))

    depart_colis = []
    depart_passagers = []
    if utilisateur.role == RoleUtilisateur.CHAUFFEUR.value:
        voyages_du_chauffeur = select(Voyage.id).where(
            Voyage.chauffeur_id == utilisateur.id
        )
        depart_colis.append(Colis.voyage_id.in_(voyages_du_chauffeur))
        depart_passagers.append(SuiviFamilial.voyage_id.in_(voyages_du_chauffeur))
    elif service._est_guichet(utilisateur):
        conditions_colis = [Colis.enregistre_par_id == utilisateur.id]
        conditions_passagers = [
            SuiviFamilial.enregistre_par_id == utilisateur.id
        ]
        if gare_perimetre is not None:
            conditions_colis.extend(
                [
                    Colis.gare_depart_id == gare_perimetre,
                    Colis.gare_arrivee_id == gare_perimetre,
                ]
            )
            conditions_passagers.extend(
                [
                    SuiviFamilial.gare_depart_id == gare_perimetre,
                    SuiviFamilial.gare_arrivee_id == gare_perimetre,
                ]
            )
        depart_colis.append(or_(*conditions_colis))
        depart_passagers.append(or_(*conditions_passagers))

    colis_par_voyage = (
        select(
            Colis.voyage_id.label("voyage_id"),
            func.count(Colis.id).label("nombre_colis"),
        )
        .where(Colis.voyage_id.is_not(None), *depart_colis)
        .group_by(Colis.voyage_id)
        .subquery()
    )
    passagers_par_voyage = (
        select(
            SuiviFamilial.voyage_id.label("voyage_id"),
            func.count(SuiviFamilial.id).label("nombre_passagers"),
        )
        .where(SuiviFamilial.voyage_id.is_not(None), *depart_passagers)
        .group_by(SuiviFamilial.voyage_id)
        .subquery()
    )
    capacite = Vehicule.capacite
    charge = (
        func.coalesce(colis_par_voyage.c.nombre_colis, 0)
        + func.coalesce(passagers_par_voyage.c.nombre_passagers, 0)
    )
    taux_remplissage = cast(charge, Float) / func.nullif(capacite, 0)
    voyages_mesurables = (
        select(
            Voyage.date_depart.label("date_depart"),
            taux_remplissage.label("taux_remplissage"),
        )
        .select_from(Voyage)
        .join(Ligne, Ligne.id == Voyage.ligne_id)
        .join(Vehicule, Vehicule.id == Voyage.vehicule_id)
        .outerjoin(colis_par_voyage, colis_par_voyage.c.voyage_id == Voyage.id)
        .outerjoin(
            passagers_par_voyage,
            passagers_par_voyage.c.voyage_id == Voyage.id,
        )
        .where(
            Voyage.statut != "annule",
            capacite > 0,
            *filtres_voyages,
        )
        .subquery()
    )

    resume = (
        await session.execute(
            select(
                func.count().label("nombre"),
                func.avg(voyages_mesurables.c.taux_remplissage).label("taux_moyen"),
                func.max(voyages_mesurables.c.date_depart).label("dernier_depart"),
            )
        )
    ).mappings().one()
    taux_actuel = resume["taux_moyen"]
    saisonnalite = False
    taux_saisonnier = taux_actuel
    if resume["dernier_depart"] is not None:
        jour_semaine = (resume["dernier_depart"].weekday() + 1) % 7
        resume_saisonnier = (
            await session.execute(
                select(
                    func.count().label("nombre"),
                    func.avg(voyages_mesurables.c.taux_remplissage).label("taux_moyen"),
                ).where(
                    extract("dow", voyages_mesurables.c.date_depart)
                    == jour_semaine
                )
            )
        ).mappings().one()
        if resume_saisonnier["nombre"]:
            taux_saisonnier = resume_saisonnier["taux_moyen"]
        saisonnalite = resume_saisonnier["nombre"] >= 2

    taux_prevu = (
        max(taux_actuel, taux_saisonnier)
        if taux_actuel is not None and taux_saisonnier is not None
        else None
    )
    coefficient = None
    action = "Données insuffisantes pour une recommandation fiable."
    if resume["nombre"] >= 2 and taux_prevu is not None:
        coefficient = 1.1 if taux_prevu >= 0.85 else 0.95 if taux_prevu <= 0.4 else 1.0
        action = (
            "Préserver la capacité et appliquer une majoration validée par l’opérateur."
            if coefficient > 1
            else "Stimuler la demande avec une remise validée par l’opérateur."
            if coefficient < 1
            else "Maintenir le tarif de référence."
        )

    previsions, erreur_modele, erreur_baseline, nombre_evalue = (
        await _obtenir_previsions(session, routes)
    )
    return {
        "previsions": previsions,
        "erreur_modele_moyenne": erreur_modele,
        "erreur_moyenne_simple": erreur_baseline,
        "previsions_evaluees": nombre_evalue,
        "taux_remplissage_pct": (
            round(float(taux_prevu) * 100, 1) if taux_prevu is not None else None
        ),
        "coefficient_suggere": coefficient,
        "voyages_mesurables": int(resume["nombre"]),
        "saisonnalite_confirmee": saisonnalite,
        "action_suggeree": action,
    }


async def _obtenir_previsions(
    session: AsyncSession, routes: list[tuple[str, str]]
) -> tuple[list[dict], float | None, float | None, int]:
    if not routes:
        return [], None, None, 0

    filtre_routes = or_(
        *[
            and_(
                PrevisionDemandeLigneAnalytique.depart == depart,
                PrevisionDemandeLigneAnalytique.arrivee == arrivee,
            )
            for depart, arrivee in routes
        ]
    )
    aujourd_hui = datetime.now(timezone.utc).date()
    previsions = list(
        await session.scalars(
            select(PrevisionDemandeLigneAnalytique)
            .where(
                PrevisionDemandeLigneAnalytique.date_prevue == aujourd_hui,
                filtre_routes,
            )
            .order_by(
                PrevisionDemandeLigneAnalytique.depart,
                PrevisionDemandeLigneAnalytique.arrivee,
            )
            .limit(10)
        )
    )
    historique = (
        await session.execute(
            select(
                func.avg(PrevisionDemandeLigneAnalytique.erreur_absolue).label(
                    "erreur_modele"
                ),
                func.avg(PrevisionDemandeLigneAnalytique.erreur_moyenne_simple).label(
                    "erreur_baseline"
                ),
                func.count(PrevisionDemandeLigneAnalytique.id).label("nombre"),
            ).where(
                PrevisionDemandeLigneAnalytique.date_prevue
                >= aujourd_hui - timedelta(days=30),
                PrevisionDemandeLigneAnalytique.date_prevue < aujourd_hui,
                PrevisionDemandeLigneAnalytique.erreur_absolue.is_not(None),
                filtre_routes,
            )
        )
    ).mappings().one()
    return (
        [
            {
                "date_prevue": prediction.date_prevue,
                "depart": prediction.depart,
                "arrivee": prediction.arrivee,
                "demande_prevue": prediction.demande_prevue,
                "moyenne_simple": prediction.moyenne_simple,
            }
            for prediction in previsions
        ],
        (
            round(float(historique["erreur_modele"]), 2)
            if historique["erreur_modele"] is not None
            else None
        ),
        (
            round(float(historique["erreur_baseline"]), 2)
            if historique["erreur_baseline"] is not None
            else None
        ),
        int(historique["nombre"]),
    )
