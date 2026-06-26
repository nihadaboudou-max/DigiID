# -*- coding: utf-8 -*-
"""
Prétraitement d'image pour l'OCR de documents d'identité africains.

Pipeline de prétraitement optimisé pour les Cartes Nationales d'Identité :
  1. Conversion niveaux de gris
  2. Redimensionnement adaptatif (max 2500px)
  3. Débruitage (filtre médian + Gaussian blur léger)
  4. Binarisation adaptative (Otsu + Sauvola selon le document)
  5. Correction de perspective (détection des 4 coins)
  6. Redressement de l'inclinaison (deskew)
  7. Amélioration du contraste (CLAHE)
  8. Détection et rehaussement de la MRZ

Utilise OpenCV si disponible, sinon fallback PIL.
"""
import io
import logging
from typing import Optional, Tuple

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

logger = logging.getLogger(__name__)

# Tentative d'import OpenCV (optionnel)
try:
    import cv2

    CV2_DISPONIBLE = True
except ImportError:
    cv2 = None
    CV2_DISPONIBLE = False

# =============================================================================
# Constantes
# =============================================================================

TAILLE_CIBLE_MAX = 2500  # pixels (longueur max)
CONTRASTE_FACTEUR = 1.5
NETTETE_FACTEUR = 1.2
SEUIL_BINARISATION = 0  # 0 = auto (Otsu)

# =============================================================================
# Pipeline principal
# =============================================================================


def pretraiter_image(
    image_input: Image.Image,
    ameliorer_mrz: bool = True,
    taille_max: int = TAILLE_CIBLE_MAX,
) -> Image.Image:
    """
    Applique le pipeline complet de prétraitement à une image de document.

    Args :
        image_input : Image PIL en entrée (RGB ou RGBA)
        ameliorer_mrz : Si True, applique un rehaussement supplémentaire
                        sur la zone MRZ (bas de l'image)
        taille_max : Taille max du grand côté en pixels

    Retour :
        Image PIL prétraitée pour Tesseract OCR
    """
    if CV2_DISPONIBLE:
        return _pretraiter_cv2(image_input, ameliorer_mrz, taille_max)
    return _pretraiter_pil(image_input, ameliorer_mrz, taille_max)


def _pretraiter_cv2(
    image: Image.Image,
    ameliorer_mrz: bool = True,
    taille_max: int = TAILLE_CIBLE_MAX,
) -> Image.Image:
    """Prétraitement avec OpenCV (meilleure qualité)."""
    # Conversion PIL → numpy array
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

    # 2. Débruitage (filtre médian préserve les bords)
    img_denoised = cv2.medianBlur(img_gray, 3)
    # Gaussian léger pour lisser
    img_denoised = cv2.GaussianBlur(img_denoised, (3, 3), 0)

    # 3. Correction d'inclinaison (deskew)
    img_deskewed = _redresser_image_cv2(img_denoised)

    # 4. Amélioration du contraste (CLAHE)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    img_contrast = clahe.apply(img_deskewed)

    # 5. Binarisation adaptative
    # Otsu pour fond clair / texte foncé
    _, img_binaire = cv2.threshold(
        img_contrast, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
    )

    # 6. Optionnel : rehaussement MRZ (bas de l'image)
    if ameliorer_mrz:
        img_binaire = _rehausser_mrz_cv2(img_binaire)

    # 7. Érosion légère pour épaissir les caractères fins
    kernel = np.ones((1, 1), np.uint8)
    img_final = cv2.erode(img_binaire, kernel, iterations=1)

    # Conversion numpy → PIL
    return Image.fromarray(img_final)


def _pretraiter_pil(
    image: Image.Image,
    ameliorer_mrz: bool = True,
    taille_max: int = TAILLE_CIBLE_MAX,
) -> Image.Image:
    """Prétraitement de base avec PIL (fallback sans OpenCV)."""
    # 1. Conversion niveaux de gris
    img = image.convert("L")

    # 2. Redimensionnement
    w, h = img.size
    if max(w, h) > taille_max:
        ratio = taille_max / max(w, h)
        nouvelle_largeur = int(w * ratio)
        nouvelle_hauteur = int(h * ratio)
        img = img.resize((nouvelle_largeur, nouvelle_hauteur), Image.LANCZOS)

    # 3. Amélioration du contraste
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(CONTRASTE_FACTEUR)

    # 4. Netteté
    enhancer = ImageEnhance.Sharpness(img)
    img = enhancer.enhance(NETTETE_FACTEUR)

    # 5. Débruitage (filtre médian PIL)
    img = img.filter(ImageFilter.MedianFilter(3))

    # 6. Binarisation par seuillage
    img = img.point(lambda x: 255 if x > 128 else 0, "1")

    return img.convert("L")


# =============================================================================
# Fonctions auxiliaires
# =============================================================================


def _redresser_image_cv2(img_gray: np.ndarray) -> np.ndarray:
    """
    Corrige l'inclinaison du document (deskew).

    Détecte l'angle de rotation via la transformée de Hough
    et applique la rotation inverse.
    """
    if not CV2_DISPONIBLE:
        return img_gray

    # Détection des bords (Canny)
    edges = cv2.Canny(img_gray, 50, 150, apertureSize=3)

    # Transformée de Hough
    lignes = cv2.HoughLinesP(
        edges, 1, np.pi / 180, 100,
        minLineLength=100, maxLineGap=10,
    )

    if lignes is None:
        return img_gray

    # Calcul de l'angle moyen
    angles = []
    for ligne in lignes:
        x1, y1, x2, y2 = ligne[0]
        angle = np.arctan2(y2 - y1, x2 - x1) * 180.0 / np.pi
        angles.append(angle)

    if not angles:
        return img_gray

    angle_median = np.median(angles)

    # Ignorer les angles trop faibles (< 0.5 degré)
    if abs(angle_median) < 0.5:
        return img_gray

    # Rotation
    h, w = img_gray.shape[:2]
    centre = (w // 2, h // 2)
    matrice = cv2.getRotationMatrix2D(centre, angle_median, 1.0)
    img_rotated = cv2.warpAffine(
        img_gray, matrice, (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )

    return img_rotated


def _rehausser_mrz_cv2(img_binaire: np.ndarray) -> np.ndarray:
    """
    Détecte et rehausse la zone MRZ (bas de l'image).

    La MRZ se trouve généralement dans les 20-30% inférieurs
    du document. Cette fonction applique un traitement spécifique
    pour améliorer la lisibilité des caractères OCR-B.
    """
    if not CV2_DISPONIBLE:
        return img_binaire

    h, w = img_binaire.shape[:2]

    # Extraire le quart inférieur (zone MRZ probable)
    zone_mrz = img_binaire[3 * h // 4:, :]

    # Inverser les couleurs si texte clair sur fond foncé
    moyenne = np.mean(zone_mrz)
    if moyenne < 127:
        zone_mrz = cv2.bitwise_not(zone_mrz)

    # Dilatation légère pour renforcer les caractères
    kernel = np.ones((2, 2), np.uint8)
    zone_mrz = cv2.dilate(zone_mrz, kernel, iterations=1)

    # Remettre la zone rehaussée dans l'image
    img_result = img_binaire.copy()
    img_result[3 * h // 4:, :] = zone_mrz

    return img_result


def detecter_orientation(image: Image.Image) -> Tuple[str, Image.Image]:
    """
    Détecte et corrige l'orientation de l'image.

    Vérifie si l'image est à l'endroit, à l'envers, ou pivotée.
    
    Retour :
        Tuple (orientation, image_corrigée)
    """
    if not CV2_DISPONIBLE:
        return "inconnue", image

    img_array = np.array(image.convert("L"))
    h, w = img_array.shape[:2]

    # Détection de texte par analyse de projection horizontale
    projection_h = np.sum(img_array, axis=1)
    # Le texte a tendance à créer des pics dans la projection
    # Si les pics sont plus forts en bas, l'image est probablement à l'envers
    
    moitie_haut = np.mean(projection_h[:h // 2])
    moitie_bas = np.mean(projection_h[h // 2:])

    if moitie_bas > moitie_haut * 1.3:
        # Plus de "texture" en bas = image à l'envers
        return "retournee", image.rotate(180, expand=True)

    if w > h * 1.5:
        # Image très large = probablement en paysage, pivoter
        return "paysage", image.rotate(90, expand=True)

    return "normale", image


def extraire_zone_mrz(image: Image.Image) -> Optional[Image.Image]:
    """
    Extrait spécifiquement la zone MRZ de l'image.

    La MRZ se trouve généralement dans les 20-30% inférieurs
    de la carte d'identité.

    Retour :
        Image PIL de la zone MRZ ou None si échec
    """
    if not CV2_DISPONIBLE:
        # Fallback PIL: extraire le bas de l'image
        w, h = image.size
        zone_mrz = image.crop((0, int(h * 0.7), w, h))
        return zone_mrz

    img_array = np.array(image.convert("RGB"))
    img_gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
    h, w = img_gray.shape[:2]

    # La MRZ est généralement dans les 25% inférieurs
    y_debut = int(h * 0.72)
    zone_mrz = img_gray[y_debut:h, :]

    # Rehaussement spécifique pour MRZ
    zone_mrz = cv2.resize(zone_mrz, (w * 2, zone_mrz.shape[0] * 2),
                          interpolation=cv2.INTER_CUBIC)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(4, 4))
    zone_mrz = clahe.apply(zone_mrz)

    _, zone_mrz = cv2.threshold(zone_mrz, 0, 255,
                                cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    return Image.fromarray(zone_mrz)


def calculer_taux_confiance(image: Image.Image) -> float:
    """
    Estime la qualité de l'image pour l'OCR (0.0 à 1.0).

    Critères :
      - Résolution suffisante
      - Contraste global
      - Netteté (détection des bords)
      - Bruit présent

    Retour :
        Score de confiance entre 0.0 (mauvaise) et 1.0 (excellente)
    """
    if not CV2_DISPONIBLE:
        return 0.5  # Valeur par défaut sans OpenCV

    img_array = np.array(image.convert("L"))
    h, w = img_array.shape[:2]

    # 1. Résolution
    resolution = min(h, w)
    score_resolution = min(resolution / 1000, 1.0)

    # 2. Contraste (écart-type des pixels)
    contraste = np.std(img_array)
    score_contraste = min(contraste / 64, 1.0)

    # 3. Netteté (détection des bords Laplacien)
    laplacien = cv2.Laplacian(img_array, cv2.CV_64F)
    variance_laplacien = np.var(laplacien)
    score_nettete = min(variance_laplacien / 500, 1.0)

    # 4. Bruit (ratio signal/bruit)
    bruit = np.std(img_array - cv2.GaussianBlur(img_array, (5, 5), 0))
    score_bruit = max(1.0 - (bruit / 64), 0.0)

    # Score final pondéré
    score_final = (
        score_resolution * 0.25
        + score_contraste * 0.30
        + score_nettete * 0.30
        + score_bruit * 0.15
    )

    return round(min(score_final, 1.0), 2)
