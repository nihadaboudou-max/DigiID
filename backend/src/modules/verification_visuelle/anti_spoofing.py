# -*- coding: utf-8 -*-
"""Détection d'anti-spoofing améliorée par analyse d'image."""
from io import BytesIO
from PIL import Image
import numpy as np
import cv2

def evaluer_anti_spoofing(
    image_bytes: bytes,
    modele: str = "avance",
    visage_bbox: tuple | None = None,  # (x, y, w, h)
) -> tuple[float, str]:
    """
    Évalue si l'image est un visage réel ou une photo/écran.
    
    Paramètres
    ----------
    image_bytes : bytes
        Contenu de l'image
    modele : str
        "avance" (recommandé) ou "simple"
    visage_bbox : tuple | None
        Coordonnées du visage détecté (x, y, w, h)
        
    Retourne
    --------
    tuple[float, str]
        (score_liveness 0-1, verdict "vivant"|"photo"|"ecran")
    """
    try:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        img_array = np.array(image)
        
        # Si bbox fournie, extraire le visage
        if visage_bbox:
            x, y, w, h = visage_bbox
            img_array = img_array[y:y+h, x:x+w]
        
        if modele == "avance":
            return _evaluer_anti_spoofing_avance(img_array)
        else:
            return _evaluer_anti_spoofing_simple(img_array)
            
    except Exception:
        return 0.0, "erreur_analyse"

def _evaluer_anti_spoofing_avance(img_array: np.ndarray) -> tuple[float, str]:
    """
    Analyse avancée multi-critères avec pondération.
    """
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
    
    # 1. Texture (variance locale) - Poids: 30%
    variance_globale = float(np.var(gray) / 255.0)
    score_texture = min(1.0, variance_globale * 2.5)
    
    # 2. Détection de moiré (FFT) - Poids: 30%
    fft = np.fft.fft2(gray)
    fft_shift = np.fft.fftshift(fft)
    magnitude_spectrum = np.abs(fft_shift)
    
    # Détecter les pics réguliers (signature d'écran)
    # Un écran produit des pics à des fréquences spécifiques
    h, w = magnitude_spectrum.shape
    centre_y, centre_x = h // 2, w // 2
    
    # Analyser les quadrants pour symétrie (écrans sont très symétriques)
    quadrant_1 = magnitude_spectrum[:centre_y, :centre_x]
    quadrant_2 = magnitude_spectrum[:centre_y, centre_x:]
    correlation = np.corrcoef(quadrant_1.flatten(), quadrant_2.flatten())[0, 1]
    score_ecran = 1.0 if abs(correlation) < 0.7 else 0.3  # Moins de corrélation = vivant
    
    # 3. Netteté des contours - Poids: 20%
    edges = cv2.Canny(gray, 50, 150)
    ratio_contours = np.sum(edges > 0) / edges.size
    score_nette = min(1.0, ratio_contours * 50)
    
    # 4. Réflexions - Poids: 20%
    hsv = cv2.cvtColor(img_array, cv2.COLOR_RGB2HSV)
    valeur = hsv[:, :, 2]
    zones_claires = np.sum(valeur > 230) / valeur.size
    score_reflexion = 1.0 if zones_claires < 0.08 else 0.5
    
    # Score final pondéré
    score_final = (
        score_texture * 0.30 +
        score_ecran * 0.30 +
        score_nette * 0.20 +
        score_reflexion * 0.20
    )
    
    # Verdict
    if score_final >= 0.65:
        verdict = "vivant"
    elif score_final >= 0.45:
        verdict = "photo"
    else:
        verdict = "ecran"
    
    return round(score_final, 3), verdict

def _evaluer_anti_spoofing_simple(img_array: np.ndarray) -> tuple[float, str]:
    """Version simple basée sur la variance (fallback)."""
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
    variance = float(np.var(gray.astype(np.float32)) / 255.0)
    
    score = min(1.0, max(0.0, variance * 2.5))
    
    if score >= 0.5:
        verdict = "vivant"
    elif score >= 0.3:
        verdict = "photo"
    else:
        verdict = "ecran"
    
    return round(score, 3), verdict