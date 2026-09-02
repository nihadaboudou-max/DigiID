# -*- coding: utf-8 -*-
"""
Prétraitement d'image pour optimiser la reconnaissance OCR.
Pipeline : Redimensionnement → Niveaux de gris → Débruitage → CLAHE → Binarisation adaptative.
"""
import numpy as np
from typing import Optional
try:
    import cv2
    CV2_DISPONIBLE = True
except ImportError:
    cv2 = None
    CV2_DISPONIBLE = False

from src.noyau.journal import journal

TAILLE_MAX_PIXELS = 2500  # Limite pour éviter la surcharge mémoire

def pretraiter_image(image_bytes: bytes) -> Optional[bytes]:
    """
    Applique un pipeline de prétraitement et retourne l'image optimisée en bytes.
    """
    if not CV2_DISPONIBLE:
        journal.warning("OpenCV non disponible : prétraitement ignoré, image originale retournée.")
        return image_bytes

    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            return None

        # 1. Redimensionnement si l'image est trop grande
        h, w = image.shape[:2]
        if max(h, w) > TAILLE_MAX_PIXELS:
            ratio = TAILLE_MAX_PIXELS / max(h, w)
            image = cv2.resize(image, (int(w * ratio), int(h * ratio)), interpolation=cv2.INTER_AREA)

        # 2. Niveaux de gris
        gris = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # 3. Débruitage (Non-local Means)
        debruite = cv2.fastNlMeansDenoising(gris, h=10)

        # 4. Amélioration du contraste local (CLAHE)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        contraste = clahe.apply(debruite)

        # 5. Binarisation adaptative (excellente pour les ombres sur les CNI)
        binaire = cv2.adaptiveThreshold(
            contraste, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            blockSize=31,
            C=10
        )

        # 6. Encodage retour en JPEG
        _, encoded_image = cv2.imencode('.jpg', binaire, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
        return encoded_image.tobytes()

    except Exception as e:
        journal.error(f"Erreur prétraitement image : {e}")
        return image_bytes  # Fallback : retourner l'original en cas d'erreur