# -- coding: utf-8 --
"""
Zone Cropper : Le Cartographe OpenCV (Stratégie "Crop & Conquer").
Détecte les ancres (MRZ), découpe le document en bandes de texte propres,
et applique un prétraitement local extrême pour neutraliser les hologrammes/fonds colorés.
"""
import io
import numpy as np
from typing import Dict, Optional, Tuple
from PIL import Image

try:
    import cv2
    CV2_DISPONIBLE = True
except ImportError:
    cv2 = None
    CV2_DISPONIBLE = False

from src.noyau.journal import journal

# Padding blanc ajouté autour des crops (CRUCIAL pour Tesseract et les petits VLM)
PADDING_PIXELS = 20 

def _charger_image_cv2(image_bytes: bytes) -> Optional[np.ndarray]:
    """Charge une image depuis des bytes vers un tableau NumPy (BGR)."""
    if not CV2_DISPONIBLE:
        return None
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        return cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    except Exception as e:
        journal.error(f"ZoneCropper: Erreur chargement image : {e}")
        return None

def _trouver_zone_mrz(image_grise: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
    """
    Détecte la MRZ (Machine Readable Zone) en bas du document.
    Utilise la morphologie pour fusionner les caractères en un gros bloc noir.
    """
    h, w = image_grise.shape
    
    # On se concentre sur le tiers inférieur (la MRZ est toujours en bas)
    zone_recherche = image_grise[int(h * 0.6):h, 0:w]
    
    # Binarisation inversée (le texte MRZ est noir, on veut du blanc)
    _, binaire = cv2.threshold(zone_recherche, 150, 255, cv2.THRESH_BINARY_INV)
    
    # Kernel horizontal très large pour fusionner les lignes de la MRZ en un seul bloc
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (w // 2, 5))
    masque_mrz = cv2.morphologyEx(binaire, cv2.MORPH_CLOSE, kernel)
    
    # Trouver les contours
    contours, _ = cv2.findContours(masque_mrz, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        return None
        
    # Prendre le plus grand contour (la MRZ)
    plus_grand_contour = max(contours, key=cv2.contourArea)
    x, y, w_contour, h_contour = cv2.boundingRect(plus_grand_contour)
    
    # Ajuster pour inclure tout le bloc MRZ (parfois un peu plus haut)
    y_absolu = int(h * 0.6) + y
    return (0, y_absolu, w, h_contour + 10) # x=0, w=largeur totale

def _decouper_bandes_texte(image_grise: np.ndarray, y_mrz: int) -> Dict[str, Tuple[int, int, int, int]]:
    """
    Découpe la zone au-dessus de la MRZ en bandes horizontales basées sur la densité de texte.
    """
    h, w = image_grise.shape
    zone_haut = image_grise[0:y_mrz, 0:w]
    
    # Projection horizontale (somme des pixels noirs par ligne)
    _, binaire = cv2.threshold(zone_haut, 160, 255, cv2.THRESH_BINARY_INV)
    projection = np.sum(binaire, axis=1)
    
    bandes = {}
    # On divise la zone haut en 3 tiers approximatifs pour capturer les layouts classiques
    # (Ex: 1. En-tête/Numéro, 2. Nom/Prénom, 3. Dates/Lieux)
    tiers = y_mrz // 3
    
    bandes["bande_haut"] = (0, 0, w, tiers)
    bandes["bande_milieu"] = (0, tiers, w, tiers)
    bandes["bande_bas"] = (0, tiers * 2, w, y_mrz - (tiers * 2))
    
    return bandes

def _nettoyer_et_agrandir_crop(image_originale: np.ndarray, bbox: Tuple[int, int, int, int]) -> Optional[bytes]:
    """
    Prend un crop, le nettoie (enlève les couleurs/hologrammes), 
    ajoute du padding blanc, et le retourne en JPEG bytes.
    """
    x, y, w, h = bbox
    if w <= 10 or h <= 10:
        return None
        
    # 1. Extraction du crop
    crop = image_originale[y:y+h, x:x+w]
    
    # 2. Conversion en niveaux de gris
    gris = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    
    # 3. CLAHE (Contraste local) pour faire ressortir le texte même sur fond sombre
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    contraste = clahe.apply(gris)
    
    # 4. Binarisation adaptative (Gaussian) pour tuer les ombres et variations de lumière
    binaire = cv2.adaptiveThreshold(
        contraste, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 10
    )
    
    # 5. Inversion si nécessaire (pour avoir du noir sur blanc pur)
    # On vérifie la moyenne : si > 127, le fond est blanc, c'est bon. Sinon on inverse.
    if np.mean(binaire) < 127:
        binaire = cv2.bitwise_not(binaire)
        
    # 6. Ajout de Padding Blanc (CRUCIAL : Tesseract et les VLM détestent le texte collé aux bords)
    crop_pad = cv2.copyMakeBorder(
        binaire, PADDING_PIXELS, PADDING_PIXELS, PADDING_PIXELS, PADDING_PIXELS,
        cv2.BORDER_CONSTANT, value=255
    )
    
    # 7. Encodage en JPEG (haute qualité pour ne pas perdre les détails des lettres)
    _, buffer = cv2.imencode('.jpg', crop_pad, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    return buffer.tobytes()

def extraire_zones_interet(image_bytes: bytes) -> Dict[str, bytes]:
    """
    Pipeline principal : Prend l'image brute, retourne un dictionnaire de zones nettoyées.
    Keys : 'zone_mrz', 'bande_haut', 'bande_milieu', 'bande_bas', 'image_globale_nettoyee'
    Values : Images en bytes (JPEG) prêtes pour OCR/VLM.
    """
    if not CV2_DISPONIBLE:
        journal.warning("ZoneCropper: OpenCV indisponible. Retour de l'image brute.")
        return {"image_globale_nettoyee": image_bytes}

    image = _charger_image_cv2(image_bytes)
    if image is None:
        return {}

    h, w = image.shape[:2]
    image_grise = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    zones_extraites = {}
    
    # --- ÉTAPE 1 : Trouver l'ancre MRZ ---
    bbox_mrz = _trouver_zone_mrz(image_grise)
    
    if bbox_mrz:
        x, y_mrz, w_mrz, h_mrz = bbox_mrz
        journal.info(f"ZoneCropper: MRZ détectée à Y={y_mrz} (Hauteur doc: {h})")
        
        # Extraire et nettoyer la MRZ
        crop_mrz = _nettoyer_et_agrandir_crop(image, bbox_mrz)
        if crop_mrz:
            zones_extraites["zone_mrz"] = crop_mrz
            
        # --- ÉTAPE 2 : Découper le reste du document en bandes ---
        bandes = _decouper_bandes_texte(image_grise, y_mrz)
        
        for nom_bande, bbox in bandes.items():
            crop_bytes = _nettoyer_et_agrandir_crop(image, bbox)
            if crop_bytes:
                zones_extraites[nom_bande] = crop_bytes
                journal.info(f"ZoneCropper: {nom_bande} générée ({bbox[2]}x{bbox[3]}px)")
    else:
        journal.warning("ZoneCropper: MRZ non détectée. Fallback sur découpage uniforme.")
        # Fallback : on coupe l'image en 4 bandes horizontales égales
        hauteur_bande = h // 4
        for i in range(4):
            y_start = i * hauteur_bande
            bbox = (0, y_start, w, hauteur_bande)
            crop_bytes = _nettoyer_et_agrandir_crop(image, bbox)
            if crop_bytes:
                zones_extraites[f"bande_fallback_{i}"] = crop_bytes

    # --- ÉTAPE 3 : Image globale nettoyée (pour le VLM de classification si besoin) ---
    _, buffer_global = cv2.imencode('.jpg', image, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    zones_extraites["image_globale"] = buffer_global.tobytes()

    journal.info(f"ZoneCropper: {len(zones_extraites)} zones d'intêt générées avec succès.")
    return zones_extraites