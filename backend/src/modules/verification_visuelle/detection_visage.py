# -*- coding: utf-8 -*-
"""Détection de visage améliorée via OpenCV + DNN."""
from io import BytesIO
from typing import Optional
from PIL import Image
import numpy as np
import cv2

def detecter_visage(
    image_bytes: bytes,
    modele: str = "dnn",  # "dnn" ou "haar"
) -> tuple[bool, Optional[tuple[int, int, int, int]]]:
    """
    Retourne True si un visage est détecté dans l'image.
    
    Paramètres
    ----------
    image_bytes : bytes
        Contenu de l'image
    modele : str
        "dnn" (recommandé - plus précis) ou "haar" (rapide)
        
    Retourne
    --------
    tuple[bool, Optional[tuple]]
        (True/False, bounding_box ou None)
    """
    try:
        # Conversion bytes → PIL → numpy
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        tableau = np.array(image)
        
        # Conversion RGB → BGR pour OpenCV
        img_bgr = cv2.cvtColor(tableau, cv2.COLOR_RGB2BGR)
        
        # Conversion en niveaux de gris
        gris = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        
        # Égalisation d'histogramme pour améliorer le contraste
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gris = clahe.apply(gris)
        
        if modele == "dnn":
            # ✅ Modèle DNN (plus précis, un peu plus lent)
            return _detecter_visage_dnn(img_bgr)
        else:
            # Fallback Haar Cascades (rapide)
            return _detecter_visage_haar(gris)
            
    except Exception as e:
        return False, None

def _detecter_visage_dnn(img_bgr: np.ndarray) -> tuple[bool, Optional[tuple]]:
    """Détection via DNN OpenCV (modèle SSD)."""
    try:
        # Charger le modèle DNN pré-entraîné
        net = cv2.dnn.readNetFromCaffe(
            "deploy.prototxt",
            "res10_300x300_ssd_iter_140000.caffemodel"
        )
        
        # Pré-traitement
        (h, w) = img_bgr.shape[:2]
        blob = cv2.dnn.blobFromImage(
            cv2.resize(img_bgr, (300, 300)),
            1.0,
            (300, 300),
            (104.0, 177.0, 123.0)
        )
        
        # Détection
        net.setInput(blob)
        detections = net.forward()
        
        # Filtrer les détections
        if len(detections) > 0:
            detection = detections[0, 0, 0, :]
            confidence = detection[2]
            
            if confidence > 0.5:  # Seuil de confiance
                box = detection[3:7] * np.array([w, h, w, h])
                (startX, startY, endX, endY) = box.astype("int")
                return True, (startX, startY, endX - startX, endY - startY)
        
        return False, None
        
    except Exception:
        # Fallback sur Haar si DNN échoue
        return _detecter_visage_haar(cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY))

def _detecter_visage_haar(gris: np.ndarray) -> tuple[bool, Optional[tuple]]:
    """Détection via Haar Cascades (rapide)."""
    try:
        cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
        
        if cascade.empty():
            return False, None
        
        detections = cascade.detectMultiScale(
            gris,
            scaleFactor=1.1,
            minNeighbors=4,  # ✅ Augmenté pour réduire faux positifs
            minSize=(100, 100),  # ✅ Augmenté pour éviter petites détections
        )
        
        if len(detections) == 0:
            return False, None
        
        return True, tuple(detections[0])
        
    except Exception:
        return False, None