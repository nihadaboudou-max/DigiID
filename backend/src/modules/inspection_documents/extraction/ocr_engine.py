# -*- coding: utf-8 -*-
"""
Moteur OCR avancé avec détection MRZ multi-zones.
Utilise OpenCV pour le prétraitement et Tesseract pour l'extraction.
"""
import io
import time
from typing import Optional, Tuple
import numpy as np
from PIL import Image
try:
    import cv2
    CV2_DISPONIBLE = True
except ImportError:
    cv2 = None
    CV2_DISPONIBLE = False

from src.noyau.journal import journal

CONFIG_TESSERACT = "--oem 3 --psm 4 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/<>+-.()[]:,;!?àâäæçéèêëîïôöœùûüÿÀÂÄÆÇÉÈÊËÎÏÔÖŒÙÛÜŸ "
CONFIG_TESSERACT_MRZ = "--oem 1 --psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<"

def _charger_image(donnees_image: bytes) -> Optional[np.ndarray]:
    try:
        if not CV2_DISPONIBLE: return None
        pil_image = Image.open(io.BytesIO(donnees_image)).convert("RGB")
        return cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
    except Exception as e:
        journal.error(f"Échec chargement image : {e}")
        return None

def _pretraiter_image(image: np.ndarray) -> np.ndarray:
    if not CV2_DISPONIBLE: return image
    gris = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    debruite = cv2.fastNlMeansDenoising(gris, h=10)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(debruite)

def _extraire_zone_mrz_intelligente(image: np.ndarray) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Détecte la MRZ dans plusieurs zones (pas seulement en bas)."""
    if not CV2_DISPONIBLE: return None, None, None
    
    hauteur, largeur = image.shape[:2]
    # Zones à tester : Bas (75-100%), Milieu (40-60%), Image entière (fallback)
    zones = [
        image[int(hauteur * 0.75):hauteur, 0:largeur],
        image[int(hauteur * 0.40):int(hauteur * 0.60), 0:largeur],
        image
    ]
    
    for zone in zones:
        try:
            _, zone_binaire = cv2.threshold(zone, 128, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
            import pytesseract
            texte = pytesseract.image_to_string(Image.fromarray(zone_binaire), lang="eng", config=CONFIG_TESSERACT_MRZ)
            lignes = [l.strip() for l in texte.split("\n") if l.strip()]
            # Filtrer : une vraie MRZ contient beaucoup de '<' et fait > 25 chars
            lignes_mrz = [l for l in lignes if len(l) >= 25 and l.count('<') > 5]
            if len(lignes_mrz) >= 2:
                return (lignes_mrz[0], lignes_mrz[1], lignes_mrz[2] if len(lignes_mrz) > 2 else None)
        except Exception:
            continue
    return None, None, None

def analyser_document(donnees_image: bytes) -> dict:
    """Pipeline principal d'analyse OCR."""
    debut = time.time()
    image = _charger_image(donnees_image)
    if not image:
        return {"texte_brut": "", "confiance_moyenne": 0.0, "mrz_lignes": (None, None, None), "succes": False}
    
    image_pretraitee = _pretraiter_image(image)
    
    try:
        import pytesseract
        pil_image = Image.fromarray(image_pretraitee)
        texte = pytesseract.image_to_string(pil_image, lang="fra+eng", config=CONFIG_TESSERACT)
        donnees_ocr = pytesseract.image_to_data(pil_image, lang="fra+eng", config=CONFIG_TESSERACT, output_type=pytesseract.Output.DICT)
        confiances = [c for c in donnees_ocr["conf"] if c != -1]
        confiance = float(np.mean(confiances)) if confiances else 0.0
    except Exception as e:
        journal.error(f"Erreur Tesseract : {e}")
        texte, confiance = "", 0.0

    mrz_lignes = _extraire_zone_mrz_intelligente(image)
    
    return {
        "texte_brut": texte.strip(),
        "confiance_moyenne": round(confiance, 2),
        "mrz_lignes": mrz_lignes,
        "temps_analyse_ms": int((time.time() - debut) * 1000),
        "succes": bool(texte.strip())
    }