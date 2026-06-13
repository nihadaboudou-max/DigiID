# -*- coding: utf-8 -*-
"""Détection de visage simple via OpenCV Haar cascades."""
from io import BytesIO
from typing import Optional

from PIL import Image
import numpy as np

try:
    import cv2
    CV2_DISPONIBLE = True
except ImportError:
    cv2 = None  # type: ignore
    CV2_DISPONIBLE = False


def detecter_visage(image_bytes: bytes) -> tuple[bool, Optional[tuple[int, int, int, int]]]:
    """Retourne True si un visage est détecté dans l'image."""
    if not CV2_DISPONIBLE:
        return False, None
    image = Image.open(BytesIO(image_bytes)).convert("RGB")
    tableau = np.array(image)
    gris = cv2.cvtColor(tableau, cv2.COLOR_RGB2GRAY)
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    if cascade.empty():
        return False, None

    detections = cascade.detectMultiScale(
        gris,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(80, 80),
    )
    if len(detections) == 0:
        return False, None
    return True, tuple(detections[0])
