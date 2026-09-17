# -*- coding: utf-8 -*-
"""
Zone Cropper : Le Cartographe OpenCV (Stratégie "Crop & Conquer").
Détecte les ancres (MRZ), découpe le document en bandes de texte propres,
et applique un prétraitement local pour neutraliser les hologrammes/fonds colorés.
"""
import numpy as np
from typing import Dict, Optional, Tuple

try:
    import cv2
    CV2_DISPONIBLE = True
except ImportError:
    cv2 = None
    CV2_DISPONIBLE = False

from src.noyau.journal import journal

PADDING_PIXELS = 20 

def _charger_image_cv2(image_bytes: bytes) -> Optional[np.ndarray]:
    if not CV2_DISPONIBLE:
        return None
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        return cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    except Exception as e:
        journal.error(f"ZoneCropper: Erreur chargement image : {e}")
        return None

def _trouver_zone_mrz(image_grise: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
    h, w = image_grise.shape
    zone_recherche = image_grise[int(h * 0.6):h, 0:w]
    _, binaire = cv2.threshold(zone_recherche, 150, 255, cv2.THRESH_BINARY_INV)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (w // 2, 5))
    masque_mrz = cv2.morphologyEx(binaire, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(masque_mrz, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    plus_grand_contour = max(contours, key=cv2.contourArea)
    x, y, w_contour, h_contour = cv2.boundingRect(plus_grand_contour)
    y_absolu = int(h * 0.6) + y
    return (0, y_absolu, w, h_contour + 10)

def _decouper_bandes_texte(image_grise: np.ndarray, y_mrz: int) -> Dict[str, Tuple[int, int, int, int]]:
    h, w = image_grise.shape
    tiers = y_mrz // 3
    bandes = {}
    bandes["bande_haut"] = (0, 0, w, tiers)
    bandes["bande_milieu"] = (0, tiers, w, tiers)
    bandes["bande_bas"] = (0, tiers * 2, w, y_mrz - (tiers * 2))
    return bandes

def _nettoyer_et_agrandir_crop(image_originale: np.ndarray, bbox: Tuple[int, int, int, int]) -> Optional[bytes]:
    x, y, w, h = bbox
    if w <= 10 or h <= 10:
        return None
    crop = image_originale[y:y+h, x:x+w]
    gris = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    contraste = clahe.apply(gris)
    binaire = cv2.adaptiveThreshold(contraste, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 10)
    if np.mean(binaire) < 127:
        binaire = cv2.bitwise_not(binaire)
    crop_pad = cv2.copyMakeBorder(binaire, PADDING_PIXELS, PADDING_PIXELS, PADDING_PIXELS, PADDING_PIXELS, cv2.BORDER_CONSTANT, value=255)
    _, buffer = cv2.imencode('.jpg', crop_pad, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    return buffer.tobytes()

def extraire_zones_interet(image_bytes: bytes) -> Dict[str, bytes]:
    if not CV2_DISPONIBLE:
        journal.warning("ZoneCropper: OpenCV indisponible. Retour de l'image brute.")
        return {"image_globale": image_bytes}

    image = _charger_image_cv2(image_bytes)
    if image is None:
        return {}

    h, w = image.shape[:2]
    image_grise = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    zones_extraites = {}
    
    bbox_mrz = _trouver_zone_mrz(image_grise)
    if bbox_mrz:
        x, y_mrz, w_mrz, h_mrz = bbox_mrz
        journal.info(f"ZoneCropper: MRZ détectée à Y={y_mrz} (Hauteur doc: {h})")
        crop_mrz = _nettoyer_et_agrandir_crop(image, bbox_mrz)
        if crop_mrz:
            zones_extraites["zone_mrz"] = crop_mrz
            
        bandes = _decouper_bandes_texte(image_grise, y_mrz)
        for nom_bande, bbox in bandes.items():
            crop_bytes = _nettoyer_et_agrandir_crop(image, bbox)
            if crop_bytes:
                zones_extraites[nom_bande] = crop_bytes
                journal.info(f"ZoneCropper: {nom_bande} générée ({bbox[2]}x{bbox[3]}px)")
    else:
        journal.warning("ZoneCropper: MRZ non détectée. Fallback sur découpage uniforme.")
        hauteur_bande = h // 4
        for i in range(4):
            y_start = i * hauteur_bande
            bbox = (0, y_start, w, hauteur_bande)
            crop_bytes = _nettoyer_et_agrandir_crop(image, bbox)
            if crop_bytes:
                zones_extraites[f"bande_fallback_{i}"] = crop_bytes

    _, buffer_global = cv2.imencode('.jpg', image, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    zones_extraites["image_globale"] = buffer_global.tobytes()
    journal.info(f"ZoneCropper: {len(zones_extraites)} zones d'intérêt générées avec succès.")
    return zones_extraites