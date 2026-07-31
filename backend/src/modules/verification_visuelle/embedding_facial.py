# -*- coding: utf-8 -*-
"""
Génération d'embedding facial via deepface (Facenet512).
Solution robuste : utilise un fichier temporaire pour éviter les bugs de DeepFace 
avec les tableaux NumPy, garantissant un alignement et un score de qualité.
"""
import os
import tempfile
from typing import Iterable, Optional
import numpy as np
from PIL import Image

# ── deepface : chargement paresseux (lazy) ──
_BACKEND: str = "opencv"      # On garde opencv comme demandé
_MODELE: str = "Facenet512"   # On garde Facenet512 (excellent modèle)
_HANDLE_DEEPFACE = None

def _obtenir_deepface():
    """Importe et retourne le module DeepFace (lazy)."""
    global _HANDLE_DEEPFACE
    if _HANDLE_DEEPFACE is None:
        try:
            from deepface import DeepFace
            _HANDLE_DEEPFACE = DeepFace
        except ImportError:
            raise RuntimeError(
                "deepface n'est pas installé. "
                "Exécute : docker compose exec backend pip install deepface tensorflow"
            )
    return _HANDLE_DEEPFACE

def generer_embedding(
    image_bytes: bytes,
    modele: str = _MODELE,
    detecter_visage: bool = True,
) -> list[float]:
    """
    Extrait un embedding facial (vecteur 512D) via deepface Facenet512.
    ✅ Utilise un fichier temporaire pour une compatibilité 100% fiable avec DeepFace.
    """
    DeepFace = _obtenir_deepface()
    
    # 1. Écrire les bytes dans un fichier temporaire (méthode la plus fiable)
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp_file:
        tmp_file.write(image_bytes)
        tmp_file_path = tmp_file.name
    
    try:
        # 2. DeepFace.Represent extrait l'embedding via le chemin du fichier
        resultat = DeepFace.represent(
            img_path=tmp_file_path,          # ✅ CHEMIN DU FICHIER (pas de tableau NumPy)
            model_name=modele,
            detector_backend=_BACKEND,
            enforce_detection=detecter_visage,
            align=True,                      # ✅ L'alignement fonctionne parfaitement avec un fichier
        )
    except ValueError as exc:
        raise ValueError(f"Aucun visage détecté dans l'image : {exc}") from exc
    except Exception as exc:
        raise RuntimeError(f"Erreur lors de l'extraction de l'embedding : {exc}") from exc
    finally:
        # 3. Nettoyer impérativement le fichier temporaire pour éviter de saturer le disque
        if os.path.exists(tmp_file_path):
            os.remove(tmp_file_path)
            
    if not resultat or "embedding" not in resultat[0]:
        raise ValueError("deepface n'a pas retourné d'embedding.")
        
    embedding: list[float] = resultat[0]["embedding"]
    
    # 4. Normalisation L2 (améliore la précision de la comparaison cosinus)
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
    a = _lire_embedding_depuis_liste(emb1)
    b = _lire_embedding_depuis_liste(emb2)
    
    if a.shape != b.shape:
        return 0.0
    
    # Normalisation L2 explicite (sécurité)
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
    """Trouve la meilleure correspondance parmi une liste d'embeddings."""
    meilleur_id = None
    meilleur_score_val = 0.0
    
    for identifiant, vecteur in embeddings_cibles:
        score = calculer_similarite(embedding_source, vecteur)
        if score > meilleur_score_val:
            meilleur_score_val = score
            meilleur_id = identifiant
    
    return meilleur_id, meilleur_score_val