# -*- coding: utf-8 -*-
"""Détection basique d'anti-spoofing par analyse de l'image."""
from io import BytesIO

from PIL import Image
import numpy as np


def evaluer_anti_spoofing(image_bytes: bytes) -> tuple[float, str]:
    """Retourne un score de liveness et un verdict simple."""
    image = Image.open(BytesIO(image_bytes)).convert("L")
    valeurs = np.array(image, dtype=np.float32)
    variance = float(np.var(valeurs) / 255.0)
    score = min(1.0, max(0.0, variance * 3.0))
    verdict = "vivant" if score >= 0.4 else "photo"
    return score, verdict
