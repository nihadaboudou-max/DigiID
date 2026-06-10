# -*- coding: utf-8 -*-
"""Règles métier de détection de fraude."""
import math
from typing import Optional

from src.config.constantes import NiveauxRisque
from src.modules.detection_fraude.schemas import SignalFraude


def _distance_kilometres(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance approximative entre deux points GPS en kilomètres."""
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return 0.0

    rayon_terre = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return rayon_terre * c


def evaluer_tentatives_connexion_echec(
    tentatives: int,
    seuil: int = 5,
) -> SignalFraude:
    """Évalue les tentatives de connexion échouées successives."""
    if tentatives <= 0:
        return SignalFraude(
            nom="tentatives_connexion_echec",
            severite=0,
            description="Aucune tentative échouée détectée.",
        )

    if tentatives >= seuil * 2:
        severite = 90
        description = (
            "Plusieurs tentatives échouées de connexion ont été détectées. "
            "Risque de brute force élevé."
        )
    elif tentatives >= seuil:
        severite = 70
        description = (
            "Tentatives de connexion échouées répétées. "
            "L'utilisateur pourrait être victime d'une attaque ciblée."
        )
    else:
        severite = 30
        description = "Quelques échecs de connexion, mais le niveau de risque reste modéré."

    return SignalFraude(
        nom="tentatives_connexion_echec",
        severite=severite,
        description=description,
    )


def evaluer_geolocalisation(
    latitude: Optional[float],
    longitude: Optional[float],
    latitude_precedente: Optional[float],
    longitude_precedente: Optional[float],
) -> SignalFraude:
    """Évalue la cohérence géographique entre deux positions successives."""
    if latitude is None or longitude is None or latitude_precedente is None or longitude_precedente is None:
        return SignalFraude(
            nom="geolocalisation",
            severite=0,
            description="Pas assez de données de géolocalisation pour évaluer le risque.",
        )

    distance = _distance_kilometres(latitude_precedente, longitude_precedente, latitude, longitude)
    if distance >= 500:
        severite = 90
        description = (
            "Changement géographique impossible sur la période mesurée. "
            "Risque de connexion frauduleuse potentiel."
        )
    elif distance >= 150:
        severite = 70
        description = (
            "Déplacement rapide détecté entre deux connexions. "
            "Le risque est modéré à élevé."
        )
    else:
        severite = 10
        description = "La localisation est cohérente avec l'historique utilisateur."

    return SignalFraude(
        nom="geolocalisation",
        severite=severite,
        description=description,
    )


def evaluer_appareil(
    appareil: Optional[str],
    appareil_precedent: Optional[str],
) -> SignalFraude:
    """Évalue les changements d'appareil ou de navigateur. """
    if not appareil or not appareil_precedent:
        return SignalFraude(
            nom="appareil",
            severite=0,
            description="Données d'appareil insuffisantes pour évaluer le risque.",
        )

    if appareil != appareil_precedent:
        return SignalFraude(
            nom="appareil",
            severite=55,
            description=(
                "Changement d'appareil ou de navigateur détecté. "
                "Cela peut indiquer une reprise de session sur un nouveau terminal."
            ),
        )

    return SignalFraude(
        nom="appareil",
        severite=5,
        description="L'appareil utilisé est cohérent avec l'historique."
    )


def interprete_niveau(score: int) -> str:
    """Retourne un libellé texte pour un score de risque."""
    niveau = NiveauxRisque.depuis_score(score)
    return niveau.value
