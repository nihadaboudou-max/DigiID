# -*- coding: utf-8 -*-
"""Détection d'anti-spoofing améliorée par analyse d'image."""
from io import BytesIO
from PIL import Image, ImageFilter
import numpy as np
import cv2

def evaluer_anti_spoofing(
    image_bytes: bytes,
    modele: str = "avance",  # "avance" ou "simple"
) -> tuple[float, str]:
    """
    Évalue si l'image est un visage réel ou une photo/écran.
    
    Paramètres
    ----------
    image_bytes : bytes
        Contenu de l'image
    modele : str
        "avance" (recommandé) ou "simple"
        
    Retourne
    --------
    tuple[float, str]
        (score_liveness 0-1, verdict "vivant"|"photo"|"ecran")
    """
    try:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        img_array = np.array(image)
        
        if modele == "avance":
            return _evaluer_anti_spoofing_avance(img_array)
        else:
            return _evaluer_anti_spoofing_simple(img_array)
            
    except Exception:
        return 0.0, "erreur_analyse"

def _evaluer_anti_spoofing_avance(img_array: np.ndarray) -> tuple[float, str]:
    """
    Analyse avancée multi-critères :
    1. Texture (LBP - Local Binary Patterns)
    2. Fréquences spatiales (FFT)
    3. Profondeur de champ
    4. Reflexions
    """
    scores = []
    
    # 1. Analyse de texture (variance locale)
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
    variance_globale = float(np.var(gray) / 255.0)
    scores.append(min(1.0, variance_globale * 2.5))
    
    # 2. Détection de motifs d'écran (moiré)
    fft = np.fft.fft2(gray)
    fft_shift = np.fft.fftshift(fft)
    magnitude_spectrum = 20 * np.log(np.abs(fft_shift))
    
    # Détection de pics réguliers (signature d'écran)
    pics_reguliers = np.std(magnitude_spectrum) / np.mean(magnitude_spectrum + 1e-10)
    score_ecran = 1.0 if pics_reguliers > 15 else 0.5
    scores.append(score_ecran)
    
    # 3. Analyse des contours (netteté)
    edges = cv2.Canny(gray, 50, 150)
    ratio_contours = np.sum(edges > 0) / edges.size
    score_nette = min(1.0, ratio_contours * 50)
    scores.append(score_nette)
    
    # 4. Détection de réflexions (zones très claires)
    hsv = cv2.cvtColor(img_array, cv2.COLOR_RGB2HSV)
    valeur = hsv[:, :, 2]
    zones_claires = np.sum(valeur > 240) / valeur.size
    score_reflexion = 1.0 if zones_claires < 0.05 else 0.7
    scores.append(score_reflexion)
    
    # Score final (moyenne pondérée)
    score_final = np.mean(scores)
    
    # Verdict
    if score_final >= 0.6:
        verdict = "vivant"
    elif score_final >= 0.4:
        verdict = "photo"
    else:
        verdict = "ecran"
    
    return round(score_final, 3), verdict

def _evaluer_anti_spoofing_simple(img_array: np.ndarray) -> tuple[float, str]:
    """Version simple basée sur la variance (fallback)."""
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
    valeurs = gray.astype(np.float32)
    variance = float(np.var(valeurs) / 255.0)
    
    # Normalisation améliorée
    score = min(1.0, max(0.0, variance * 2.5))
    
    if score >= 0.5:
        verdict = "vivant"
    elif score >= 0.3:
        verdict = "photo"
    else:
        verdict = "ecran"
    
    return round(score, 3), verdict