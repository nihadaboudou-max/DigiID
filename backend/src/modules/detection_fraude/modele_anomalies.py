# -*- coding: utf-8 -*-
"""Score d'anomalie simplifié pour la détection de fraude."""
from typing import Mapping


def score_anomalie(features: Mapping[str, float]) -> float:
    """Calcule un score d'anomalie 0-1 à partir de quelques métriques clés."""
    if not features:
        return 0.0

    penalite_tentatives = min(1.0, features.get("tentatives_connexion_echec", 0) / 10)
    penalite_distance = min(1.0, features.get("distance_km", 0) / 200)
    penalite_appareil = 1.0 if features.get("changement_appareil", False) else 0.0

    score = (penalite_tentatives * 0.45) + (penalite_distance * 0.35) + (penalite_appareil * 0.20)
    return max(0.0, min(1.0, score))
