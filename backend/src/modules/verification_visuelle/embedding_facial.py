# -*- coding: utf-8 -*-
"""
Génération d'embedding facial via deepface (Facenet512/ArcFace).
Version optimisée pour les pièces d'identité (CNI / Passeports).
"""
import io
import os
import tempfile
from functools import lru_cache
from typing import Iterable, Optional

import cv2
import numpy as np
from PIL import Image

from src.config.parametres import parametres
from src.noyau import journal

# ── Configuration ──
TAILLE_MAX_IMAGE = 15 * 1024 * 1024  # 15 Mo
_BACKEND = getattr(parametres, 'detecteur_visage', 'retinaface')
_MODELE = getattr(parametres, 'modele_embedding', 'Facenet512')
_HANDLE_DEEPFACE = None


def _obtenir_deepface():
    """Importe et retourne le module DeepFace (lazy)."""
    global _HANDLE_DEEPFACE
    if _HANDLE_DEEPFACE is None:
        try:
            from deepface import DeepFace
            _HANDLE_DEEPFACE = DeepFace
            journal.info(f"DeepFace chargé avec modèle {_MODELE}")
        except ImportError:
            raise RuntimeError(
                "deepface n'est pas installé. "
                "Exécute : docker compose exec backend pip install deepface tensorflow"
            )
    return _HANDLE_DEEPFACE


@lru_cache(maxsize=1)
def _precharger_modele(modele: str = _MODELE):
    """Précharge le modèle en mémoire pour éviter le premier appel lent."""
    DeepFace = _obtenir_deepface()
    try:
        DeepFace.build_model(modele)
        journal.info(f"Modèle {modele} préchargé")
    except Exception as e:
        journal.warning(f"Préchargement modèle échoué : {e}")
    return DeepFace


def _optimiser_image_cni(image_bytes: bytes) -> bytes:
    """Applique CLAHE pour réduire les reflets des CNI plastifiées."""
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return image_bytes

        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        img_clahe = cv2.merge((l, a, b))
        img_final = cv2.cvtColor(img_clahe, cv2.COLOR_LAB2BGR)

        _, buffer = cv2.imencode('.jpg', img_final, [cv2.IMWRITE_JPEG_QUALITY, 95])
        return buffer.tobytes()
    except Exception as e:
        journal.warning(f"CLAHE échoué : {e}")
        return image_bytes


def generer_embedding(
    image_bytes: bytes,
    modele: str = _MODELE,
    detecter_visage: bool = True,
    appliquer_clahe: bool = True,
) -> list[float]:
    """Extrait un embedding facial (vecteur 512D) via deepface."""
    # Validation
    if len(image_bytes) > TAILLE_MAX_IMAGE:
        raise ValueError(f"Image trop volumineuse : {len(image_bytes)} octets (max {TAILLE_MAX_IMAGE})")

    # Prétraitement
    if appliquer_clahe:
        image_bytes = _optimiser_image_cni(image_bytes)

    DeepFace = _obtenir_deepface()
    _precharger_modele(modele)

    # Fichier temporaire sécurisé
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".jpg")
    try:
        with os.fdopen(tmp_fd, 'wb') as tmp_file:
            tmp_file.write(image_bytes)

        # Extraction avec fallback
        try:
            resultat = DeepFace.represent(
                img_path=tmp_path,
                model_name=modele,
                detector_backend=_BACKEND,
                enforce_detection=detecter_visage,
                align=True,
            )
        except ValueError as exc:
            journal.warning(f"{_BACKEND} échoué, tentative MTCNN : {exc}")
            try:
                resultat = DeepFace.represent(
                    img_path=tmp_path,
                    model_name=modele,
                    detector_backend="mtcnn",
                    enforce_detection=detecter_visage,
                    align=True,
                )
            except Exception:
                raise ValueError(f"Aucun visage détecté : {exc}") from exc

        if not resultat or "embedding" not in resultat[0]:
            raise ValueError("deepface n'a pas retourné d'embedding.")

        embedding: list[float] = resultat[0]["embedding"]

        # Normalisation L2
        norme = np.linalg.norm(embedding)
        if norme > 0:
            embedding = (np.array(embedding) / norme).tolist()

        return embedding

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


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
    """Calcule la similarité cosinus entre deux embeddings."""
    a = _lire_embedding_depuis_liste(emb1)
    b = _lire_embedding_depuis_liste(emb2)

    if a.shape != b.shape:
        return 0.0

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
    """Trouve le meilleur score de similarité parmi une liste d'embeddings."""
    meilleur_id = None
    meilleur_score_val = 0.0

    for identifiant, vecteur in embeddings_cibles:
        score = calculer_similarite(embedding_source, vecteur)
        if score > meilleur_score_val:
            meilleur_score_val = score
            meilleur_id = identifiant

    return meilleur_id, meilleur_score_val