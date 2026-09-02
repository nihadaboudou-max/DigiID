# -*- coding: utf-8 -*-
"""
Vérificateur de qualité d'image.
Utilise des métriques OpenCV (variance du Laplacien pour le flou, 
histogramme pour la luminosité) pour valider la scannabilité du document.
"""
import numpy as np
from typing import Tuple
from pydantic import BaseModel
try:
    import cv2
    CV2_DISPONIBLE = True
except ImportError:
    cv2 = None
    CV2_DISPONIBLE = False

from src.noyau.journal import journal


class ResultatQualite(BaseModel):
    score_global: float  # 0 à 100
    est_valide: bool
    est_flou: bool
    est_trop_sombre: bool
    est_trop_clair: bool
    message: str


def evaluer_qualite_image(image_bytes: bytes) -> ResultatQualite:
    """
    Évalue la qualité d'une image pour l'OCR.
    
    Seuils recommandés :
    - Flou (Laplacian variance) : < 100 = flou, > 100 = net
    - Luminosité moyenne : < 60 = trop sombre, > 200 = trop clair (brûlé)
    """
    if not CV2_DISPONIBLE:
        journal.warning("OpenCV non disponible : évaluation de qualité ignorée.")
        return ResultatQualite(score_global=100.0, est_valide=True, est_flou=False, 
                               est_trop_sombre=False, est_trop_clair=False, message="Qualité non évaluée (OpenCV manquant)")

    try:
        # Décodage de l'image
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
        
        if image is None:
            return ResultatQualite(score_global=0.0, est_valide=False, est_flou=True, 
                                   est_trop_sombre=True, est_trop_clair=True, message="Image invalide ou corrompue")

        # 1. Détection du flou (Variance du Laplacien)
        variance_laplacien = cv2.Laplacian(image, cv2.CV_64F).var()
        est_flou = variance_laplacien < 100.0

        # 2. Détection de la luminosité
        luminosite_moyenne = np.mean(image)
        est_trop_sombre = luminosite_moyenne < 60.0
        est_trop_clair = luminosite_moyenne > 200.0

        # 3. Calcul du score global (heuristique simple mais efficace)
        score = 100.0
        if est_flou:
            score -= 50.0
        if est_trop_sombre or est_trop_clair:
            score -= 30.0
        
        score = max(0.0, min(100.0, score))
        est_valide = score >= 50.0

        message = "Image de bonne qualité." if est_valide else "Image de mauvaise qualité (floue, trop sombre ou trop claire)."
        
        journal.info(f"Qualité image : score={score:.1f}, flou={est_flou}, lum={luminosite_moyenne:.1f}")
        
        return ResultatQualite(
            score_global=round(score, 1),
            est_valide=est_valide,
            est_flou=est_flou,
            est_trop_sombre=est_trop_sombre,
            est_trop_clair=est_trop_clair,
            message=message
        )
        
    except Exception as e:
        journal.error(f"Erreur évaluation qualité image : {e}")
        return ResultatQualite(score_global=0.0, est_valide=False, est_flou=True, 
                               est_trop_sombre=True, est_trop_clair=True, message="Erreur technique lors de l'analyse")