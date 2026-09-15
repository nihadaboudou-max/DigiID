# -- coding: utf-8 --
"""
Moteur OCR global (Filet de secours).
Extrait le texte brut complet et tente de trouver la MRZ globale.
Le prétraitement lourd est désormais géré par zone_cropper.py.
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

# Configuration Tesseract pour le texte global (on accepte tout)
CONFIG_TESSERACT_GLOBAL = "--oem 3 --psm 6"
# Configuration Tesseract pour la MRZ globale (très restrictif)
CONFIG_TESSERACT_MRZ = "--oem 1 --psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<"

def _charger_image(donnees_image: bytes) -> Optional[np.ndarray]:
    try:
        if not CV2_DISPONIBLE:
            return None
        pil_image = Image.open(io.BytesIO(donnees_image)).convert("RGB")
        return cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
    except Exception as e:
        journal.error(f"Échec chargement image : {e}")
        return None

def _extraire_zone_mrz_globale(image: np.ndarray) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Détecte la MRZ dans l'image globale (fallback si le cropper échoue)."""
    if not CV2_DISPONIBLE:
        return None, None, None
        
    hauteur, largeur = image.shape[:2]
    # On cherche dans le tiers inférieur
    zone = image[int(hauteur * 0.65):hauteur, 0:largeur]
    
    try:
        import pytesseract
        gris = cv2.cvtColor(zone, cv2.COLOR_BGR2GRAY)
        _, binaire = cv2.threshold(gris, 128, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
        
        texte = pytesseract.image_to_string(Image.fromarray(binaire), lang="eng", config=CONFIG_TESSERACT_MRZ)
        lignes = [l.strip() for l in texte.split("\n") if l.strip()]
        
        # Filtrer : une vraie MRZ contient beaucoup de '<' et fait > 25 chars
        lignes_mrz = [l for l in lignes if len(l) >= 25 and l.count('<') > 3]
        if len(lignes_mrz) >= 2:
            return (lignes_mrz[0], lignes_mrz[1], lignes_mrz[2] if len(lignes_mrz) > 2 else None)
    except Exception as e:
        journal.warning(f"OCR Engine: Erreur MRZ globale : {e}")
        
    return None, None, None

def analyser_document(donnees_image: bytes) -> dict:
    """Pipeline principal d'analyse OCR globale (Filet de secours)."""
    debut = time.time()
    image = _charger_image(donnees_image)
    
    if image is None:
        return {"texte_brut": "", "confiance_moyenne": 0.0, "mrz_lignes": (None, None, None), "succes": False}

    try:
        import pytesseract
        # Pas de prétraitement lourd ici, on laisse Tesseract faire sur l'image brute
        # pour avoir le texte le plus large possible pour les Regex de secours.
        pil_image = Image.fromarray(image)
        texte = pytesseract.image_to_string(pil_image, lang="fra+eng", config=CONFIG_TESSERACT_GLOBAL)
        
        donnees_ocr = pytesseract.image_to_data(pil_image, lang="fra+eng", config=CONFIG_TESSERACT_GLOBAL, output_type=pytesseract.Output.DICT)
        confiances = [c for c in donnees_ocr["conf"] if c != -1]
        confiance = float(np.mean(confiances)) if confiances else 0.0
    except Exception as e:
        journal.error(f"Erreur Tesseract global : {e}")
        texte, confiance = "", 0.0

    mrz_lignes = _extraire_zone_mrz_globale(image)

    return {
        "texte_brut": texte.strip(),
        "confiance_moyenne": round(confiance, 2),
        "mrz_lignes": mrz_lignes,
        "temps_analyse_ms": int((time.time() - debut) * 1000),
        "succes": bool(texte.strip())
    }