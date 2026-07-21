# -*- coding: utf-8 -*-
"""
Génération d'embedding facial via deepface (Facenet512).
Remplace l'ancienne version basée sur SHA-512.

Modèles supportés par deepface :
  - Facenet512 (512D, recommandé) — bon équilibre précision/performance
  - ArcFace (512D) — meilleure précision, plus lent
  - VGG-Face (4096D) — plus lent, plus lourd
  - OpenFace (128D) — rapide mais moins précis

Usage :
    embedding = generer_embedding(image_bytes)
    similarity = calculer_similarite(emb1, emb2)  # cosinus 0‑1
"""
from io import BytesIO
from typing import Iterable, Optional
import numpy as np

# ── deepface : chargement paresseux (lazy) pour éviter le gel au démarrage ──
_BACKEND: str = "opencv"      # detection
_MODELE: str = "Facenet512"    # embedding

_HANDLE_DEEPFACE = None       # lazy import cache


def _obtenir_deepface():
    """Importe et retourne le module deepface (lazy)."""
    global _HANDLE_DEEPFACE
    if _HANDLE_DEEPFACE is None:
        try:
            import deepface
            _HANDLE_DEEPFACE = deepface
        except ImportError:
            raise RuntimeError(
                "deepface n'est pas installé. "
                "Exécute : pip install deepface tensorflow"
            )
    return _HANDLE_DEEPFACE


DEEPFACE_DISPONIBLE: bool = True


def generer_embedding(
    image_bytes: bytes,
    modele: str = _MODELE,
    detecter_visage: bool = True,
) -> list[float]:
    """
    Extrait un embedding facial (vecteur 512D) via deepface Facenet512.

    Paramètres
    ----------
    image_bytes : bytes
        Contenu brut de l'image (JPEG, PNG, …)
    modele : str
        Nom du modèle deepface (Facenet512, ArcFace, VGG-Face, OpenFace)
    detecter_visage : bool
        Si True, deepface détecte/aligne le visage automatiquement

    Retourne
    -------
    list[float]
        Vecteur d'embedding normalisé (L2). Longueur = 512 pour Facenet512/ArcFace.

    Lève
    ----
    RuntimeError
        Si deepface n'est pas installé
    ValueError
        Si aucun visage n'est détecté dans l'image
    """
    df = _obtenir_deepface()

    # deepface.Represent accepte un chemin ou un np.array
    img = np.array(bytearray(image_bytes), dtype=np.uint8)

    try:
        resultat = df.Represent(
            img_path=img,
            model_name=modele,
            detector_backend=_BACKEND,
            enforce_detection=detecter_visage,
            align=True,
        )
    except ValueError as exc:
        # deepface lève ValueError si aucun visage détecté
        raise ValueError(f"Aucun visage détecté dans l'image : {exc}") from exc

    if not resultat or "embedding" not in resultat[0]:
        raise ValueError("deepface n'a pas retourné d'embedding.")

    embedding: list[float] = resultat[0]["embedding"]

    # Normalisation L2
    norme = np.linalg.norm(embedding)
    if norme > 0:
        embedding = (np.array(embedding) / norme).tolist()

    return embedding


def _lire_embedding_depuis_liste(v: Iterable[float]) -> np.ndarray:
    """Convertit un itérable en tableau numpy 1D normalisé."""
    arr = np.array(list(v), dtype=np.float64)
    if arr.ndim != 1:
        raise ValueError(f"L'embedding doit être 1D, reçu {arr.ndim}D")
    return arr


def calculer_similarite(
    emb1: Iterable[float],
    emb2: Iterable[float],
) -> float:
    """
    Calcule la similarité cosinus entre deux embeddings.

    Retourne un score entre 0 (orthogonal / différent) et 1 (colinéaire / identique).
    """
    a = _lire_embedding_depuis_liste(emb1)
    b = _lire_embedding_depuis_liste(emb2)

    if a.shape != b.shape:
        return 0.0

    # Normalisation L2
    norme_a = np.linalg.norm(a)
    norme_b = np.linalg.norm(b)
    if norme_a == 0 or norme_b == 0:
        return 0.0
    a = a / norme_a
    b = b / norme_b

    produit_scalaire = float(np.dot(a, b))
    return max(0.0, min(1.0, produit_scalaire))


def meilleur_score(
    embeddings_cibles: list[tuple[str, list[float]]],
    embedding_source: list[float],
) -> tuple[Optional[str], float]:
    """
    Trouve la meilleure correspondance parmi une liste d'embeddings.

    Paramètres
    ----------
    embeddings_cibles : list[tuple[str, list[float]]]
        Liste de (identifiant, vecteur_embedding)
    embedding_source : list[float]
        Vecteur à comparer

    Retourne
    --------
    tuple[Optional[str], float]
        (identifiant de la meilleure correspondance, score de similarité max)
        (None, 0.0) si la liste est vide
    """
    meilleur_id = None
    meilleur_score_val = 0.0

    for identifiant, vecteur in embeddings_cibles:
        score = calculer_similarite(embedding_source, vecteur)
        if score > meilleur_score_val:
            meilleur_score_val = score
            meilleur_id = identifiant

    return meilleur_id, meilleur_score_val
