# -*- coding: utf-8 -*-
"""
Génération d'embedding facial via deepface (VGG-Face + RetinaFace).
OPTIMISÉ pour la comparaison CNI/Selfie avec pré-traitement avancé.
Modèles supportés :
- VGG-Face (4096D) - Meilleur pour CNI/Selfie
- Facenet512 (512D) - Bon équilibre
- ArcFace (512D) - Très précis
"""
from io import BytesIO
from typing import Iterable, Optional
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
import cv2

# ── deepface : chargement paresseux (lazy) ─
_BACKEND: str = "retinaface"  # ✅ CHANGÉ : retinaface au lieu de opencv
_MODELE: str = "VGG-Face"      # ✅ CHANGÉ : VGG-Face meilleur pour CNI
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
                "Exécute : pip install deepface tensorflow opencv-python"
            )
    return _HANDLE_DEEPFACE

def _preparer_image_pour_embedding(image_bytes: bytes) -> np.ndarray:
    """
    Pré-traitement avancé de l'image pour améliorer la détection :
    - Égalisation d'histogramme (CLAHE)
    - Réduction du bruit
    - Amélioration du contraste
    - Normalisation de la luminosité
    """
    # Conversion bytes → PIL → OpenCV
    pil_image = Image.open(BytesIO(image_bytes)).convert("RGB")
    img_array = np.array(pil_image)
    
    # Conversion RGB → BGR pour OpenCV
    img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
    
    # Conversion en niveaux de gris
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    
    # Égalisation d'histogramme adaptative (CLAHE)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    
    # Réduction du bruit (filtre bilatéral préserve les contours)
    denoised = cv2.bilateralFilter(enhanced, 9, 75, 75)
    
    # Conversion finale en RGB pour DeepFace
    final_rgb = cv2.cvtColor(denoised, cv2.COLOR_GRAY2RGB)
    
    return final_rgb

def generer_embedding(
    image_bytes: bytes,
    modele: str = _MODELE,
    detecter_visage: bool = True,
) -> list[float]:
    """
    Extrait un embedding facial optimisé via deepface.
    ✅ Utilise RetinaFace pour la détection (beaucoup plus robuste)
    ✅ Pré-traitement CLAHE pour améliorer les photos sombres/CNI
    ✅ Alignement automatique activé
    
    Paramètres
    ----------
    image_bytes : bytes
        Contenu brut de l'image (JPEG, PNG, …)
    modele : str
        Nom du modèle deepface (VGG-Face, Facenet512, ArcFace)
    detecter_visage : bool
        Si True, deepface détecte/aligne le visage automatiquement
        
    Retourne
    -------
    list[float]
        Vecteur d'embedding normalisé (L2).
        
    Lève
    ----
    RuntimeError
        Si deepface n'est pas installé
    ValueError
        Si aucun visage n'est détecté dans l'image
    """
    DeepFace = _obtenir_deepface()
    
    # 1. Pré-traitement avancé de l'image
    try:
        img_preprocessed = _preparer_image_pour_embedding(image_bytes)
    except Exception as e:
        # Fallback sur l'image originale si pré-traitement échoue
        pil_image = Image.open(BytesIO(image_bytes)).convert("RGB")
        img_preprocessed = np.array(pil_image)
    
    # 2. DeepFace.Represent avec RetinaFace
    try:
        resultat = DeepFace.represent(
            img_path=img_preprocessed,
            model_name=modele,
            detector_backend=_BACKEND,  # ✅ RetinaFace
            enforce_detection=detecter_visage,
            align=True,  # ✅ Alignement activé
            normalization="base",  # Normalisation recommandée
        )
    except ValueError as exc:
        # Si RetinaFace échoue, essayer avec OpenCV en fallback
        try:
            resultat = DeepFace.represent(
                img_path=img_preprocessed,
                model_name=modele,
                detector_backend="opencv",
                enforce_detection=detecter_visage,
                align=True,
            )
        except ValueError:
            raise ValueError(
                f"Aucun visage détecté dans l'image. "
                f"Assurez-vous que la photo montre clairement un visage de face. "
                f"Détails: {exc}"
            ) from exc
    
    if not resultat or "embedding" not in resultat[0]:
        raise ValueError("deepface n'a pas retourné d'embedding.")
    
    embedding: list[float] = resultat[0]["embedding"]
    
    # 3. Normalisation L2 (améliore la comparaison cosinus)
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
    Retourne un score entre 0 (différent) et 1 (identique).
    ✅ Optimisé pour les embeddings normalisés L2
    """
    a = _lire_embedding_depuis_liste(emb1)
    b = _lire_embedding_depuis_liste(emb2)
    
    if a.shape != b.shape:
        return 0.0
    
    # Similarité cosinus (déjà normalisés L2)
    produit_scalaire = float(np.dot(a, b))
    return max(0.0, min(1.0, produit_scalaire))

def meilleur_score(
    embeddings_cibles: list[tuple[str, list[float]]],
    embedding_source: list[float],
) -> tuple[Optional[str], float]:
    """
    Trouve la meilleure correspondance parmi une liste d'embeddings.
    """
    meilleur_id = None
    meilleur_score_val = 0.0
    
    for identifiant, vecteur in embeddings_cibles:
        score = calculer_similarite(embedding_source, vecteur)
        if score > meilleur_score_val:
            meilleur_score_val = score
            meilleur_id = identifiant
    
    return meilleur_id, meilleur_score_val