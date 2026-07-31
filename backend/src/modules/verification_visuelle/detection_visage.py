# -*- coding: utf-8 -*-
"""Détection de visage améliorée via OpenCV."""
from io import BytesIO
from typing import Optional, Tuple
from PIL import Image
import cv2
import numpy as np
from src.noyau import journal

# Cache pour les classificateurs Haar
_CASCADE_FACE = None
_CASCADE_PROFILE = None

def _obtenir_cascade_visage() -> cv2.CascadeClassifier:
    """Retourne le classificateur Haar pour visages de face (avec cache)."""
    global _CASCADE_FACE
    if _CASCADE_FACE is None:
        _CASCADE_FACE = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
    return _CASCADE_FACE

def _obtenir_cascade_profil() -> cv2.CascadeClassifier:
    """Retourne le classificateur Haar pour visages de profil (avec cache)."""
    global _CASCADE_PROFILE
    if _CASCADE_PROFILE is None:
        _CASCADE_PROFILE = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_profileface.xml"
        )
    return _CASCADE_PROFILE


def detecter_visage(
    image_bytes: bytes,
    taille_min: int = 80,
) -> Tuple[bool, Optional[Tuple[int, int, int, int]]]:
    """
    Retourne True si un visage est détecté dans l'image.
    
    Paramètres
    ----------
    image_bytes : bytes
        Contenu de l'image
    taille_min : int
        Taille minimale du visage en pixels (défaut: 80)
        
    Retourne
    --------
    tuple[bool, Optional[tuple]]
        (True/False, bounding_box (x, y, w, h) ou None)
    """
    try:
        # Conversion bytes → PIL → numpy
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        tableau = np.array(image)
        
        # Validation taille minimale
        if tableau.shape[0] < taille_min or tableau.shape[1] < taille_min:
            journal.warning(f"Image trop petite pour détection: {tableau.shape}")
            return False, None
        
        # Conversion RGB → BGR pour OpenCV
        img_bgr = cv2.cvtColor(tableau, cv2.COLOR_RGB2BGR)
        
        # Conversion en niveaux de gris
        gris = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        
        # Égalisation d'histogramme pour améliorer le contraste
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gris_ameliore = clahe.apply(gris)
        
        # 1. Détection de face (frontal)
        cascade_face = _obtenir_cascade_visage()
        if not cascade_face.empty():
            detections = cascade_face.detectMultiScale(
                gris_ameliore,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(taille_min, taille_min),
                flags=cv2.CASCADE_SCALE_IMAGE,
            )
            if len(detections) > 0:
                x, y, w, h = detections[0]
                journal.info(f"Visage détecté (face): x={x}, y={y}, w={w}, h={h}")
                return True, (int(x), int(y), int(w), int(h))
        
        # 2. Fallback: détection de profil
        cascade_profil = _obtenir_cascade_profil()
        if not cascade_profil.empty():
            detections = cascade_profil.detectMultiScale(
                gris_ameliore,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(taille_min, taille_min),
            )
            if len(detections) > 0:
                x, y, w, h = detections[0]
                journal.info(f"Visage détecté (profil): x={x}, y={y}, w={w}, h={h}")
                return True, (int(x), int(y), int(w), int(h))
        
        # 3. Dernière tentative: image originale sans CLAHE
        detections = cascade_face.detectMultiScale(
            gris,
            scaleFactor=1.1,
            minNeighbors=4,
            minSize=(taille_min, taille_min),
        )
        if len(detections) > 0:
            x, y, w, h = detections[0]
            journal.info(f"Visage détecté (fallback): x={x}, y={y}, w={w}, h={h}")
            return True, (int(x), int(y), int(w), int(h))
        
        journal.warning("Aucun visage détecté dans l'image")
        return False, None
        
    except Exception as e:
        journal.exception(f"Erreur lors de la détection de visage: {e}")
        return False, None


def extraire_visage(
    image_bytes: bytes,
    marge: float = 0.2,
) -> Optional[bytes]:
    """
    Extrait le visage de l'image avec une marge autour.
    
    Paramètres
    ----------
    image_bytes : bytes
        Contenu de l'image
    marge : float
        Marge autour du visage (0.2 = 20%)
        
    Retourne
    --------
    Optional[bytes]
        Image du visage extraite en JPG, ou None si aucun visage
    """
    detecte, box = detecter_visage(image_bytes)
    if not detecte or box is None:
        return None
    
    x, y, w, h = box
    
    # Ouvrir l'image originale
    image = Image.open(BytesIO(image_bytes)).convert("RGB")
    tableau = np.array(image)
    
    # Calculer les coordonnées avec marge
    img_h, img_w = tableau.shape[:2]
    marge_x = int(w * marge)
    marge_y = int(h * marge)
    
    x1 = max(0, x - marge_x)
    y1 = max(0, y - marge_y)
    x2 = min(img_w, x + w + marge_x)
    y2 = min(img_h, y + h + marge_y)
    
    # Extraire le visage
    visage = tableau[y1:y2, x1:x2]
    
    # Convertir en JPG
    _, buffer = cv2.imencode('.jpg', visage, [cv2.IMWRITE_JPEG_QUALITY, 95])
    return buffer.tobytes()


def compter_visages(
    image_bytes: bytes,
    taille_min: int = 80,
) -> int:
    """
    Compte le nombre de visages dans l'image.
    
    Retourne
    --------
    int
        Nombre de visages détectés
    """
    try:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        tableau = np.array(image)
        img_bgr = cv2.cvtColor(tableau, cv2.COLOR_RGB2BGR)
        gris = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gris_ameliore = clahe.apply(gris)
        
        cascade = _obtenir_cascade_visage()
        if cascade.empty():
            return 0
        
        detections = cascade.detectMultiScale(
            gris_ameliore,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(taille_min, taille_min),
        )
        
        return len(detections)
        
    except Exception:
        return 0