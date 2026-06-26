# -*- coding: utf-8 -*-
"""
Moteur OCR pour l'extraction de texte des Cartes Nationales d'Identité.

Utilise Tesseract OCR avec la langue française pour extraire le texte
des images de CNI. Effectue un prétraitement d'image (OpenCV) pour
améliorer la qualité de la reconnaissance.

Pipeline :
  1. Chargement et conversion de l'image
  2. Correction d'orientation (deskew)
  3. Prétraitement (redimensionnement, normalisation, débruitage, binarisation)
  4. OCR avec Tesseract (langue fra + eng)
  5. Extraction MRZ multi-stratégies (TD1, TD2, TD3)
  6. Nettoyage et structuration du texte brut
  7. Calcul du taux de confiance
"""
import io
import re
import time
from typing import Optional, Tuple

# ✅ Import conditionnel pour éviter l'échec si OpenCV n'est pas disponible
import numpy as np
from PIL import Image

try:
    import cv2
    CV2_DISPONIBLE = True
except ImportError:
    cv2 = None
    CV2_DISPONIBLE = False

from src.noyau.journal import journal

# =============================================================================
# Constantes
# =============================================================================

# Taille cible pour l'image redimensionnée (garder les proportions)
TAILLE_CIBLE_LONGUEUR_MAX = 2500  # pixels

# Préfixes MRZ valides (ICAO 9303)
PREFIXES_MRZ_VALIDES = {"P<", "C<", "I<", "ID", "A<", "V<", "IP", "IC"}

# Configuration Tesseract
CONFIG_TESSERACT = (
    "--oem 3"            # LSTM + Legacy
    " --psm 6"           # Mode : bloc de texte uniforme (meilleur pour les cartes)
    " -c tessedit_char_whitelist="
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    "0123456789/<>+-.()[]:,;!?àâäæçéèêëîïôöœùûüÿÀÂÄÆÇÉÈÊËÎÏÔÖŒÙÛÜŸ "
    " -c tessedit_enable_dict_correction=1"
    " --dpi 300"         # Forcer DPI à 300 pour meilleure reconnaissance
)

# Configuration pour la MRZ (Machine Readable Zone) — beaucoup plus restrictive
CONFIG_TESSERACT_MRZ = (
    "--oem 1"            # LSTM uniquement
    " --psm 6"           # Mode : bloc de texte uniforme (mieux pour plusieurs lignes)
    " -c tessedit_char_whitelist="
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<"
)


def _charger_image(donnees_image: bytes) -> Optional[np.ndarray]:
    """
    Charge des bytes d'image en tableau NumPy utilisable par OpenCV.

    Args :
        donnees_image : bytes bruts de l'image (JPEG, PNG, etc.)

    Retour :
        Tableau NumPy (H, W, 3) en BGR, ou None si échec.
    """
    try:
        if not CV2_DISPONIBLE:
            journal.warning("OpenCV non disponible (cv2) — impossible de traiter l'image")
            return None
        pil_image = Image.open(io.BytesIO(donnees_image))
        # Convertir en RGB si nécessaire
        if pil_image.mode != "RGB":
            pil_image = pil_image.convert("RGB")
        return cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
    except Exception as erreur:
        journal.error(f"Échec chargement image OCR CNI : {erreur}")
        return None


def _pretraiter_image(image: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Applique une série de prétraitements pour améliorer la reconnaissance OCR.

    Retour :
        Tuple (image_niveaux_gris, image_binairee, image_redimensionnee)
    """
    if not CV2_DISPONIBLE:
        journal.warning("OpenCV non disponible — prétraitement impossible")
        return image, image, image

    # 1. Redimensionnement si l'image est trop grande (préserver les proportions)
    hauteur, largeur = image.shape[:2]
    if max(hauteur, largeur) > TAILLE_CIBLE_LONGUEUR_MAX:
        facteur = TAILLE_CIBLE_LONGUEUR_MAX / max(hauteur, largeur)
        nouvelle_largeur = int(largeur * facteur)
        nouvelle_hauteur = int(hauteur * facteur)
        image = cv2.resize(image, (nouvelle_largeur, nouvelle_hauteur),
                           interpolation=cv2.INTER_AREA)

    # 2. Passage en niveaux de gris
    gris = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # 3. Débruitage plus doux (préserver les détails)
    debruite = cv2.fastNlMeansDenoising(gris, h=5)

    # 4. Amélioration du contraste (CLAHE)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    contraste = clahe.apply(debruite)

    # 5. Binarisation adaptative (paramètres optimisés pour CNI)
    binaire = cv2.adaptiveThreshold(
        contraste, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=15,
        C=5
    )

    # 6. Fermeture morphologique plus légère
    noyau = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 1))
    binaire = cv2.morphologyEx(binaire, cv2.MORPH_CLOSE, noyau)

    return gris, binaire, image


def _executer_tesseract(image: np.ndarray, config: str = CONFIG_TESSERACT) -> Tuple[str, float]:
    """
    Exécute Tesseract OCR sur une image pré-traitée.

    Args :
        image : Image en niveaux de gris ou binaire
        config : Configuration Tesseract à utiliser

    Retour :
        Tuple (texte_extrait, taux_confiance_moyen)
    """
    try:
        import pytesseract
        # Convertir le tableau OpenCV en image PIL pour pytesseract
        pil_image = Image.fromarray(image)

        # Obtenir les données détaillées avec confiance
        donnees_ocr = pytesseract.image_to_data(
            pil_image,
            lang="fra+eng",
            config=config,
            output_type=pytesseract.Output.DICT
        )

        # Reconstituer le texte complet
        texte = pytesseract.image_to_string(
            pil_image,
            lang="fra+eng",
            config=config
        )

        # Calculer le taux de confiance moyen
        confiances = [
            c for c in donnees_ocr["conf"]
            if c != -1  # Ignorer les confiances -1 (caractères sans confiance)
        ]
        confiance_moyenne = float(np.mean(confiances)) if confiances else 0.0

        return texte, confiance_moyenne

    except ImportError:
        journal.error(
            "pytesseract n'est pas installé. "
            "Installer avec : pip install pytesseract "
            "et s'assurer que Tesseract est installé sur le système."
        )
        return "", 0.0
    except Exception as erreur:
        journal.error(f"Erreur Tesseract OCR : {erreur}")
        return "", 0.0


def _nettoyer_ligne_mrz(ligne: Optional[str]) -> Optional[str]:
    """
    Nettoie une ligne MRZ en ne gardant que les caractères valides.
    Retourne None si la ligne est trop courte pour être une MRZ.
    """
    if ligne is None:
        return None
    ligne = ligne.upper().strip()
    ligne = "".join(c for c in ligne if c.isalnum() or c in "<")
    # Remplacer les O par des 0 dans les zones numériques (approximatif)
    return ligne if len(ligne) >= 20 else None


def _est_ligne_mrz_valide(ligne: str) -> bool:
    """Vérifie si une ligne ressemble à une MRZ (commence par un préfixe valide)."""
    if not ligne or len(ligne) < 20:
        return False
    prefixe = ligne[:2]
    return prefixe in PREFIXES_MRZ_VALIDES


def _extraire_zone_mrz(image: np.ndarray, texte_brut: str = "") -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Détecte et extrait la zone MRZ avec stratégie multi-niveaux.

    Stratégie :
      1. Zone bas de l'image (75-100%) avec agrandissement
      2. Recherche dans le texte brut complet (fallback)
      3. Détection automatique TD1/TD2/TD3

    Retour :
        Tuple (ligne_1, ligne_2, ligne_3) ou (None, None, None)
    """
    if not CV2_DISPONIBLE:
        journal.warning("OpenCV non disponible — extraction MRZ impossible")
        return None, None, None

    # === STRATÉGIE 1 : Zone bas de l'image ===
    hauteur, largeur = image.shape[:2]
    debut_mrz = int(hauteur * 0.75)  # Réduit de 0.80 à 0.75 pour capturer plus
    zone_mrz = image[debut_mrz:hauteur, 0:largeur]

    # Agrandir la zone MRZ pour meilleure reconnaissance
    facteur_agrandissement = 3
    zone_mrz_agrandie = cv2.resize(
        zone_mrz,
        (largeur * facteur_agrandissement,
         (hauteur - debut_mrz) * facteur_agrandissement),
        interpolation=cv2.INTER_CUBIC
    )

    # Binarisation agressive pour la MRZ
    _, zone_mrz_binaire = cv2.threshold(
        zone_mrz_agrandie, 128, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU
    )

    try:
        import pytesseract
        pil_mrz = Image.fromarray(zone_mrz_binaire)
        texte_mrz = pytesseract.image_to_string(
            pil_mrz,
            lang="eng",
            config=CONFIG_TESSERACT_MRZ
        )

        # Nettoyer et séparer les lignes
        lignes_brutes = [
            ligne.strip()
            for ligne in texte_mrz.split("\n")
            if ligne.strip()
        ]

        # Nettoyer chaque ligne
        lignes_nettoyees = [_nettoyer_ligne_mrz(l) for l in lignes_brutes]
        lignes_nettoyees = [l for l in lignes_nettoyees if l is not None]

        # Chercher 2 ou 3 lignes consécutives qui ressemblent à une MRZ
        for i in range(len(lignes_nettoyees)):
            l1 = lignes_nettoyees[i]
            if not _est_ligne_mrz_valide(l1):
                continue

            # TD1 : 3 lignes de ~30 caractères
            if i + 2 < len(lignes_nettoyees):
                l2 = lignes_nettoyees[i + 1]
                l3 = lignes_nettoyees[i + 2]
                if 25 <= len(l1) <= 35 and 25 <= len(l2) <= 35 and 25 <= len(l3) <= 35:
                    journal.info(f"MRZ TD1 trouvée par zone image : {l1[:15]}...")
                    return l1, l2, l3

            # TD2 : 2 lignes de ~36 caractères
            if i + 1 < len(lignes_nettoyees):
                l2 = lignes_nettoyees[i + 1]
                if 30 <= len(l1) <= 40 and 25 <= len(l2) <= 40:
                    journal.info(f"MRZ TD2 trouvée par zone image : {l1[:15]}...")
                    return l1, l2, None

            # TD3 : 2 lignes de ~44 caractères
            if i + 1 < len(lignes_nettoyees):
                l2 = lignes_nettoyees[i + 1]
                if 40 <= len(l1) <= 50 and 40 <= len(l2) <= 50:
                    journal.info(f"MRZ TD3 trouvée par zone image : {l1[:15]}...")
                    return l1, l2, None

    except ImportError:
        journal.warning("pytesseract non disponible pour l'extraction MRZ")
    except Exception as erreur:
        journal.warning(f"Extraction MRZ par zone échouée : {erreur}")

    # === STRATÉGIE 2 : Recherche dans le texte brut complet ===
    if texte_brut:
        lignes_texte = [l.strip() for l in texte_brut.split("\n") if l.strip()]
        lignes_nettoyees = [_nettoyer_ligne_mrz(l) for l in lignes_texte]
        lignes_nettoyees = [l for l in lignes_nettoyees if l is not None]

        for i in range(len(lignes_nettoyees)):
            l1 = lignes_nettoyees[i]
            if not _est_ligne_mrz_valide(l1):
                continue

            # TD1 : 3 lignes
            if i + 2 < len(lignes_nettoyees):
                l2 = lignes_nettoyees[i + 1]
                l3 = lignes_nettoyees[i + 2]
                if 25 <= len(l1) <= 35 and 25 <= len(l2) <= 35 and 25 <= len(l3) <= 35:
                    journal.info(f"MRZ TD1 trouvée dans texte brut : {l1[:15]}...")
                    return l1, l2, l3

            # TD2 ou TD3 : 2 lignes
            if i + 1 < len(lignes_nettoyees):
                l2 = lignes_nettoyees[i + 1]
                if 30 <= len(l1) <= 50 and 25 <= len(l2) <= 50:
                    journal.info(f"MRZ TD2/TD3 trouvée dans texte brut : {l1[:15]}...")
                    return l1, l2, None

    journal.warning("MRZ non trouvée ni par zone image ni par texte brut")
    return None, None, None


def _corriger_orientation(image: np.ndarray) -> np.ndarray:
    """
    Détecte et corrige l'orientation de l'image si nécessaire.
    """
    if not CV2_DISPONIBLE:
        return image

    try:
        # Détecter les bords
        bords = cv2.Canny(image, 50, 150, apertureSize=3)

        # Détecter les lignes
        lignes = cv2.HoughLinesP(bords, 1, np.pi/180, threshold=100,
                                  minLineLength=100, maxLineGap=10)

        if lignes is None or len(lignes) == 0:
            return image

        # Calculer l'angle moyen des lignes horizontales
        angles = []
        for ligne in lignes:
            x1, y1, x2, y2 = ligne[0]
            angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
            # Ne garder que les lignes quasi-horizontales (±10°)
            if abs(angle) < 10:
                angles.append(angle)

        if not angles:
            return image

        angle_moyen = np.mean(angles)

        # Si l'angle est significatif, corriger
        if abs(angle_moyen) > 0.5:
            hauteur, largeur = image.shape[:2]
            centre = (largeur // 2, hauteur // 2)
            matrice_rotation = cv2.getRotationMatrix2D(centre, angle_moyen, 1.0)
            image = cv2.warpAffine(image, matrice_rotation, (largeur, hauteur),
                                    flags=cv2.INTER_CUBIC,
                                    borderMode=cv2.BORDER_REPLICATE)
            journal.info(f"Correction orientation : {angle_moyen:.2f}°")

        return image
    except Exception as e:
        journal.warning(f"Échec correction orientation : {e}")
        return image


def analyser_image_cni(donnees_image: bytes) -> dict:
    """
    Fonction principale d'analyse OCR d'une image de CNI.

    Args :
        donnees_image : Bytes de l'image (JPEG, PNG)

    Retour :
        Dictionnaire contenant :
          - texte_brut : texte complet extrait
          - confiance_moyenne : taux de confiance (0-100)
          - mrz_lignes : tuple des 3 lignes MRZ (TD1) ou 2 lignes (TD2/TD3)
          - temps_analyse_ms : temps d'exécution
          - succes : booléen indiquant si l'analyse a réussi
          - erreurs : liste des messages d'erreur
    """
    debut = time.time()
    erreurs = []

    # 1. Charger l'image
    image = _charger_image(donnees_image)
    if image is None:
        return {
            "texte_brut": "",
            "confiance_moyenne": 0.0,
            "mrz_lignes": (None, None, None),
            "temps_analyse_ms": int((time.time() - debut) * 1000),
            "succes": False,
            "erreurs": ["Impossible de charger l'image."],
        }

    # 2. Corriger l'orientation AVANT le prétraitement
    image = _corriger_orientation(image)

    # 3. Prétraiter l'image (une seule fois)
    image_gris, image_binaire, image_originale = _pretraiter_image(image)

    # 4. OCR principal sur l'image prétraitée (binaire)
    texte_principal, confiance_principal = _executer_tesseract(image_binaire)

    # 5. OCR secondaire sur l'image en niveaux de gris (pour les détails)
    try:
        import pytesseract
        pil_gris = Image.fromarray(image_gris)
        texte_gris = pytesseract.image_to_string(
            pil_gris,
            lang="fra+eng",
            config=CONFIG_TESSERACT
        )
    except (ImportError, Exception) as erreur:
        texte_gris = ""
        if "pytesseract" not in str(erreur):
            journal.warning(f"OCR secondaire échoué : {erreur}")

    # 6. Combiner les résultats (le meilleur des deux)
    texte_combine = texte_principal
    if len(texte_gris) > len(texte_principal):
        texte_combine = texte_gris

    confiance = max(confiance_principal, 0.0)

    if not texte_combine.strip():
        erreurs.append("Aucun texte extrait. L'image est peut-être de trop mauvaise qualité.")
        confiance = 0.0

    # 7. Extraire la MRZ avec stratégie multi-niveaux (zone image + fallback texte brut)
    mrz_l1, mrz_l2, mrz_l3 = _extraire_zone_mrz(image_gris, texte_combine)

    temps = int((time.time() - debut) * 1000)

    journal.info(
        f"OCR CNI terminé : {len(texte_combine)} caractères extraits, "
        f"confiance={confiance:.1f}%, MRZ={'OK' if mrz_l1 else 'NON'}, "
        f"temps={temps}ms"
    )

    return {
        "texte_brut": texte_combine.strip(),
        "confiance_moyenne": round(confiance, 2),
        "mrz_lignes": (mrz_l1, mrz_l2, mrz_l3),
        "temps_analyse_ms": temps,
        "succes": bool(texte_combine.strip()),
        "erreurs": erreurs,
    }
