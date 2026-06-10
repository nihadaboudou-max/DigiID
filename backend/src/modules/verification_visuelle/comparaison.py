# -*- coding: utf-8 -*-
"""Comparaison d'embeddings faciaux pour détecter les doublons."""
from typing import Iterable

from src.modules.verification_visuelle.embedding_facial import calculer_similarite


def comparer_embeddings(
    embedding: Iterable[float],
    historique: list[tuple[str, list[float]]],
    seuil: float = 0.6,
) -> list[dict]:
    """Retourne la liste des enregistrements similaires détectés."""
    resultats = []
    for identifiant, vecteur in historique:
        similarite = calculer_similarite(embedding, vecteur)
        if similarite >= seuil:
            resultats.append(
                {
                    "utilisateur_id": identifiant,
                    "similarite": round(similarite, 3),
                }
            )
    return resultats
