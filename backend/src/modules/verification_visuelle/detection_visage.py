# -*- coding: utf-8 -*-
"""Détection de visage simple via OpenCV Haar cascades."""
from io import BytesIO

from PIL import Image
import cv2
import numpy as np


def detecter_visage(image_bytes: bytes) -> tuple[bool, tuple[int, int, int, int] | None]:
    """Retourne True si un visage est détecté dans l'image."""
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
