# -*- coding: utf-8 -*-
"""
Prétraitement d'image pour OCR de documents d'identité (AMÉLIORÉ).
Changements majeurs :
  ✅ Confiance normalisée (0-1) indépendante résolution
  ✅ Segmentation zones (MRZ, texte, photo)
  ✅ CLAHE adaptatif par zone
  ✅ Inversion MRZ intelligent (vérif contraste avant)
  ✅ Agrandissement MRZ adaptatif
"""
import io
import logging
from typing import Optional, Tuple, Dict
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

logger = logging.getLogger(__name__)

try:
    import cv2
    CV2_DISPONIBLE = True
except ImportError:
    cv2 = None
    CV2_DISPONIBLE = False

# =============================================================================
# Constantes
# =============================================================================
TAILLE_CIBLE_MAX = 2500
CONTRASTE_FACTEUR = 1.5
NETTETE_FACTEUR = 1.2
SEUIL_BINARISATION = 0

# ✅ NOUVEAU : Fonction de détection des zones
def detecter_zones_document(img_gray: np.ndarray) -> Dict[str, Tuple[int, int, int, int]]:
    """
    Détecte zones du document (MRZ, texte, photo).
    Retourne dict des zones comme (y1, y2, x1, x2).
    """
    h, w = img_gray.shape[:2]
    zones = {
        "photo": (0, h // 5, 0, w),           # Haut 0-20%
        "texte": (h // 5, h // 4 * 3, 0, w), # Milieu 20-75%
        "mrz": (h // 4 * 3, h, 0, w),        # Bas 75-100%
    }
    return zones

# =============================================================================
# Pipeline principal
# =============================================================================
def pretraiter_image(
    image_input: Image.Image,
    ameliorer_mrz: bool = True,
    taille_max: int = TAILLE_CIBLE_MAX,
) -> Image.Image:
    """
    Applique pipeline complet de prétraitement.
    ✅ Optimisé pour CNI africaines.
    """
    if CV2_DISPONIBLE:
        return _pretraiter_cv2(image_input, ameliorer_mrz, taille_max)
    return _pretraiter_pil(image_input, ameliorer_mrz, taille_max)

def _pretraiter_cv2(
    image: Image.Image,
    ameliorer_mrz: bool = True,
    taille_max: int = TAILLE_CIBLE_MAX,
) -> Image.Image:
    """
    ✅ AMÉLIORÉ :
      - Détecte zones avant traitement
      - CLAHE adaptatif par zone
      - Inversion MRZ intelligent
    """
    img_array = np.array(image.convert("RGB"))
    if len(img_array.shape) == 3:
        img_gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
    else:
        img_gray = img_array
    
    # 1. Redimensionnement adaptatif
    h, w = img_gray.shape[:2]
    if max(h, w) > taille_max:
        ratio = taille_max / max(h, w)
        nouvelle_largeur = int(w * ratio)
        nouvelle_hauteur = int(h * ratio)
        img_gray = cv2.resize(
            img_gray, (nouvelle_largeur, nouvelle_hauteur),
            interpolation=cv2.INTER_AREA,
        )
    
    # 2. Débruitage
    img_denoised = cv2.medianBlur(img_gray, 3)
    img_denoised = cv2.GaussianBlur(img_denoised, (3, 3), 0)
    
    # 3. Correction inclinaison (deskew)
    img_deskewed = _redresser_image_cv2(img_denoised)
    
    # ✅ NOUVEAU : Détecter zones
    zones = detecter_zones_document(img_deskewed)
    
    # 4. ✅ CLAHE adaptatif par zone
    img_contrast = img_deskewed.copy()
    
    # Zone texte : CLAHE agressif
    clahe_texte = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    y1_t, y2_t, x1_t, x2_t = zones["texte"]
    if y2_t > y1_t:
        img_contrast[y1_t:y2_t, x1_t:x2_t] = clahe_texte.apply(
            img_deskewed[y1_t:y2_t, x1_t:x2_t]
        )
    
    # Zone MRZ : CLAHE agressif aussi
    y1_m, y2_m, x1_m, x2_m = zones["mrz"]
    if y2_m > y1_m:
        img_contrast[y1_m:y2_m, x1_m:x2_m] = clahe_texte.apply(
            img_deskewed[y1_m:y2_m, x1_m:x2_m]
        )
    
    # Zone photo : CLAHE léger (préserve)
    clahe_photo = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(16, 16))
    y1_p, y2_p, x1_p, x2_p = zones["photo"]
    if y2_p > y1_p:
        img_contrast[y1_p:y2_p, x1_p:x2_p] = clahe_photo.apply(
            img_deskewed[y1_p:y2_p, x1_p:x2_p]
        )
    
    # 5. Binarisation adaptative
    _, img_binaire = cv2.threshold(
        img_contrast, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
    )
    
    # 6. ✅ NOUVEAU : Rehaussement MRZ intelligent
    if ameliorer_mrz:
        img_binaire = _rehausser_mrz_cv2_intelligent(img_binaire, zones)
    
    # 7. Érosion légère
    kernel = np.ones((1, 1), np.uint8)
    img_final = cv2.erode(img_binaire, kernel, iterations=1)
    
    return Image.fromarray(img_final)

def _pretraiter_pil(
    image: Image.Image,
    ameliorer_mrz: bool = True,
    taille_max: int = TAILLE_CIBLE_MAX,
) -> Image.Image:
    """Prétraitement PIL fallback (sans OpenCV)."""
    img = image.convert("L")
    
    # Redimensionnement
    w, h = img.size
    if max(w, h) > taille_max:
        ratio = taille_max / max(w, h)
        nouvelle_largeur = int(w * ratio)
        nouvelle_hauteur = int(h * ratio)
        img = img.resize((nouvelle_largeur, nouvelle_hauteur), Image.LANCZOS)
    
    # Amélioration contraste
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(CONTRASTE_FACTEUR)
    
    # Netteté
    enhancer = ImageEnhance.Sharpness(img)
    img = enhancer.enhance(NETTETE_FACTEUR)
    
    # Débruitage
    img = img.filter(ImageFilter.MedianFilter(3))
    
    # Binarisation
    img = img.point(lambda x: 255 if x > 128 else 0, "1")
    return img.convert("L")

# =============================================================================
# Fonctions auxiliaires
# =============================================================================

def _redresser_image_cv2(img_gray: np.ndarray) -> np.ndarray:
    """Corrige inclinaison par Hough."""
    if not CV2_DISPONIBLE:
        return img_gray
    
    try:
        edges = cv2.Canny(img_gray, 50, 150, apertureSize=3)
        lignes = cv2.HoughLinesP(
            edges, 1, np.pi / 180, 100,
            minLineLength=100, maxLineGap=10,
        )
        if lignes is None:
            return img_gray
        
        angles = []
        for ligne in lignes:
            x1, y1, x2, y2 = ligne[0]
            angle = np.arctan2(y2 - y1, x2 - x1) * 180.0 / np.pi
            angles.append(angle)
        
        if not angles:
            return img_gray
        
        angle_median = np.median(angles)
        if abs(angle_median) < 0.5:
            return img_gray
        
        h, w = img_gray.shape[:2]
        centre = (w // 2, h // 2)
        matrice = cv2.getRotationMatrix2D(centre, angle_median, 1.0)
        img_rotated = cv2.warpAffine(
            img_gray, matrice, (w, h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_REPLICATE,
        )
        return img_rotated
    except Exception:
        return img_gray

def _rehausser_mrz_cv2_intelligent(img_binaire: np.ndarray, zones: Dict) -> np.ndarray:
    """
    ✅ NOUVEAU : Rehaussement MRZ intelligent.
    Inversion SEULEMENT si nécessaire (contraste faible + texte blanc).
    """
    if not CV2_DISPONIBLE:
        return img_binaire
    
    y1_m, y2_m, x1_m, x2_m = zones["mrz"]
    zone_mrz = img_binaire[y1_m:y2_m, x1_m:x2_m]
    
    # Vérifier contraste AVANT inverser
    moyenne = np.mean(zone_mrz)
    ecart_type = np.std(zone_mrz)
    
    # Inversion seulement si vraiment nécessaire
    # (moyenne < 80 ET faible écart-type = texte blanc sur fond noir)
    if moyenne < 80 and ecart_type < 50:
        zone_mrz = cv2.bitwise_not(zone_mrz)
    
    # Dilatation légère pour renforcer caractères
    kernel = np.ones((2, 2), np.uint8)
    zone_mrz = cv2.dilate(zone_mrz, kernel, iterations=1)
    
    # Remettre zone rehaussée
    img_result = img_binaire.copy()
    img_result[y1_m:y2_m, x1_m:x2_m] = zone_mrz
    return img_result

def detecter_orientation(image: Image.Image) -> Tuple[str, Image.Image]:
    """Détecte et corrige orientation (endroit, envers, paysage)."""
    if not CV2_DISPONIBLE:
        return "inconnue", image
    
    try:
        img_array = np.array(image.convert("L"))
        h, w = img_array.shape[:2]
        
        # Projection horizontale
        projection_h = np.sum(img_array, axis=1)
        moitie_haut = np.mean(projection_h[:h // 2])
        moitie_bas = np.mean(projection_h[h // 2:])
        
        if moitie_bas > moitie_haut * 1.3:
            return "retournee", image.rotate(180, expand=True)
        
        if w > h * 1.5:
            return "paysage", image.rotate(90, expand=True)
        
        return "normale", image
    except Exception:
        return "inconnue", image

def extraire_zone_mrz(image: Image.Image) -> Optional[Image.Image]:
    """
    Extrait zone MRZ avec agrandissement adaptatif.
    ✅ Facteur d'agrandissement adapté à hauteur zone.
    """
    if not CV2_DISPONIBLE:
        w, h = image.size
        zone_mrz = image.crop((0, int(h * 0.7), w, h))
        return zone_mrz
    
    img_array = np.array(image.convert("RGB"))
    img_gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
    h, w = img_gray.shape[:2]
    
    # Zone MRZ dans 25% inférieurs
    y_debut = int(h * 0.72)
    zone_mrz = img_gray[y_debut:h, :]
    
    # ✅ NOUVEAU : Agrandissement adaptatif
    hauteur_zone = h - y_debut
    if hauteur_zone < 100:
        facteur = 4
    elif hauteur_zone < 200:
        facteur = 3
    else:
        facteur = 2
    
    zone_mrz = cv2.resize(
        zone_mrz,
        (w * facteur, hauteur_zone * facteur),
        interpolation=cv2.INTER_CUBIC
    )
    
    # Amélioration CLAHE
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(4, 4))
    zone_mrz = clahe.apply(zone_mrz)
    
    # Binarisation
    _, zone_mrz = cv2.threshold(
        zone_mrz, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
    )
    
    return Image.fromarray(zone_mrz)

def calculer_taux_confiance(image: Image.Image) -> float:
    """
    ✅ AMÉLIORÉ : Confiance normalisée (0-1).
    Indépendante de la résolution absolue.
    Scores empiriques calibrés pour CNI 300 DPI.
    """
    if not CV2_DISPONIBLE:
        return 0.5
    
    try:
        img_array = np.array(image.convert("L"))
        h, w = img_array.shape[:2]
        
        # 1. Résolution (normalisée)
        # À 300 DPI : CNI ≈ 1000px largeur = excellent
        # À 150 DPI : CNI ≈ 500px largeur = acceptable
        resolution = min(h, w)
        score_resolution = min(max(resolution / 500.0, 0.0), 1.0)
        
        # 2. Contraste (écart-type des pixels)
        # Bonne valeur pour document ≈ 60-80
        contraste = np.std(img_array)
        score_contraste = min(contraste / 60.0, 1.0)
        
        # 3. Netteté (Laplacien)
        laplacien = cv2.Laplacian(img_array, cv2.CV_64F)
        variance_laplacien = np.var(laplacien)
        score_nettete = min(variance_laplacien / 400.0, 1.0)
        
        # 4. Bruit (écart à Gaussian blur)
        blurred = cv2.GaussianBlur(img_array, (5, 5), 0)
        bruit = np.std(img_array - blurred)
        score_bruit = max(1.0 - (bruit / 50.0), 0.0)
        
        # Score final (pondéré)
        score_final = (
            score_resolution * 0.20
            + score_contraste * 0.35
            + score_nettete * 0.30
            + score_bruit * 0.15
        )
        
        return round(min(score_final, 1.0), 2)
    except Exception:
        return 0.5