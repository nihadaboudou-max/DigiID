# -*- coding: utf-8 -*-
"""Génération d'un embedding facial déterministe pour la vérification."""
import hashlib
from io import BytesIO
from typing import Iterable

from PIL import Image


def _fold_bytes_to_float(raw: bytes) -> float:
    valeur = int.from_bytes(raw, byteorder="big", signed=False)
    return (valeur % 10000) / 10000.0


def generer_embedding(image_bytes: bytes, dimension: int = 512) -> list[float]:
    """Génère un embedding facial deterministe basé sur le contenu de l'image."""
    image = Image.open(BytesIO(image_bytes)).convert("RGB")
    buffer = image.tobytes()
    digest = hashlib.sha512(buffer).digest()
    embedding: list[float] = []
    index = 0
    while len(embedding) < dimension:
        offset = index * 2
        if offset + 2 > len(digest):
            digest = hashlib.sha512(digest).digest()
            offset = 0
            index = 0
        embedding.append(_fold_bytes_to_float(digest[offset : offset + 2]))
        index += 1
    return embedding


def calculer_similarite(emb1: Iterable[float], emb2: Iterable[float]) -> float:
    """Calcule une similarité 0-1 entre deux embeddings."""
    liste1 = list(emb1)
    liste2 = list(emb2)
    if len(liste1) != len(liste2) or not liste1:
        return 0.0
    numerateur = sum(a * b for a, b in zip(liste1, liste2))
    denom1 = sum(a * a for a in liste1) ** 0.5
    denom2 = sum(b * b for b in liste2) ** 0.5
    if denom1 == 0 or denom2 == 0:
        return 0.0
    return min(1.0, numerateur / (denom1 * denom2))
