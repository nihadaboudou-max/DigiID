# -*- coding: utf-8 -*-
"""Détection de la présence (et du contenu) du QR code sur un CIP."""
from typing import Optional, Tuple

from src.noyau.journal import journal

try:
    import cv2
    import numpy as np
    CV2_OK = True
except ImportError:
    cv2 = None
    np = None
    CV2_OK = False


def detecter_qr_code(image_bytes: bytes) -> Tuple[bool, Optional[str]]:
    """
    Détecte un QR code dans l'image du CIP.

    Returns:
        (detecte, contenu) — contenu est None si illisible ou absent.
    """
    if not CV2_OK or not image_bytes:
        journal.warning("QR CIP : OpenCV indisponible — détection impossible.")
        return False, None

    try:
        tableau = np.frombuffer(image_bytes, dtype=np.uint8)
        image = cv2.imdecode(tableau, cv2.IMREAD_COLOR)
        if image is None:
            return False, None

        detecteur = cv2.QRCodeDetector()
        contenu, points, _ = detecteur.detectAndDecode(image)
        if points is not None and len(points) > 0:
            texte = (contenu or "").strip() or None
            journal.info(f"QR CIP détecté (contenu={'oui' if texte else 'vide'})")
            return True, texte

        # Repli : image en niveaux de gris + seuillage (photos floues / contraste faible).
        gris = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        for methode in (
            cv2.threshold(gris, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1],
            cv2.adaptiveThreshold(
                gris, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 5
            ),
        ):
            contenu, points, _ = detecteur.detectAndDecode(methode)
            if points is not None and len(points) > 0:
                texte = (contenu or "").strip() or None
                journal.info("QR CIP détecté (repli seuillage)")
                return True, texte

        journal.warning("QR CIP : aucun QR code détecté sur l'image.")
        return False, None
    except Exception as e:
        journal.warning(f"QR CIP : erreur de détection ({e})")
        return False, None
