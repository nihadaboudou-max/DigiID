# -*- coding: utf-8 -*-
"""
Génération d'embedding facial via deepface (Facenet512/ArcFace).
Version optimisée et corrigée pour éviter les erreurs de type 'tuple' ou de lecture.
"""
import os
import tempfile
from typing import Iterable, Optional
import numpy as np
import cv2
from src.noyau import journal

_BACKEND: str = "retinaface"  
_MODELE: str = "Facenet512" 
_HANDLE_DEEPFACE = None

def _obtenir_deepface():
    """Importe et retourne le module DeepFace (lazy)."""
    global _HANDLE_DEEPFACE
    if _HANDLE_DEEPFACE is None:
        try:
            from deepface import DeepFace
            _HANDLE_DEEPFACE = DeepFace
            journal.info("Module DeepFace chargé avec succès.")
        except ImportError:
            raise RuntimeError(
                "deepface n'est pas installé. "
                "Exécute : docker compose exec backend pip install deepface tensorflow"
            )
    return _HANDLE_DEEPFACE

def _optimiser_image_cni(image_bytes: bytes) -> bytes:
    """Applique un filtre CLAHE pour réduire les reflets du plastique de la CNI."""
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            journal.warning("Échec du décodage de l'image pour CLAHE.")
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
        journal.warning(f"Erreur lors de l'optimisation CLAHE : {e}")
        return image_bytes

def generer_embedding(
    image_bytes: bytes,
    modele: str = _MODELE,
    detecter_visage: bool = True,
    appliquer_clahe: bool = True,
) -> list[float]:
    """Extrait un embedding facial (vecteur 512D) via deepface Facenet512."""
    DeepFace = _obtenir_deepface()
    
    if appliquer_clahe:
        image_bytes = _optimiser_image_cni(image_bytes)

    if not isinstance(image_bytes, (bytes, bytearray)):
        raise ValueError(f"Type d'image invalide attendu: bytes, reçu: {type(image_bytes)}")

    # Décoder l'image en tableau numpy directement (évite les écritures disque)
    nparr = np.frombuffer(image_bytes, np.uint8)
    img_array = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img_array is None:
        raise ValueError("Le fichier image est corrompu ou illisible par OpenCV.")

    try:
        # CORRECTION CRITIQUE : On passe le tableau numpy directement, pas un chemin de fichier
        resultat = DeepFace.represent(
            img_path=img_array,  
            model_name=modele,
            detector_backend=_BACKEND,
            enforce_detection=detecter_visage,
            align=True,
        )
    except ValueError as exc:
        journal.warning(f"Échec avec {_BACKEND}, tentative avec opencv : {exc}")
        try:
            resultat = DeepFace.represent(
                img_path=img_array,
                model_name=modele,
                detector_backend="opencv",
                enforce_detection=detecter_visage,
                align=True,
            )
        except Exception as fallback_exc:
            raise ValueError(f"Aucun visage détecté dans l'image : {fallback_exc}") from fallback_exc
    except Exception as exc:
        raise RuntimeError(f"Erreur lors de l'extraction de l'embedding : {exc}") from exc
            
    if not resultat or not isinstance(resultat, list) or len(resultat) == 0 or "embedding" not in resultat[0]:
        raise ValueError("deepface n'a pas retourné d'embedding valide.")
        
    embedding: list[float] = resultat[0]["embedding"]
    
    # Normalisation L2
    norme = np.linalg.norm(embedding)
    if norme > 0:
        embedding = (np.array(embedding) / norme).tolist()
        
    return embedding

# =============================================================================
# ⚠️ CES FONCTIONS SONT OBLIGATOIRES POUR QUE L'IMPORT FONCTIONNE ⚠️
# =============================================================================

def calculer_similarite(
    emb1: Iterable[float],
    emb2: Iterable[float],
) -> float:
    """Calcule la similarité cosinus entre deux embeddings."""
    a = np.array(list(emb1), dtype=np.float64)
    b = np.array(list(emb2), dtype=np.float64)
    
    if a.ndim != 1 or b.ndim != 1:
        return 0.0
    
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