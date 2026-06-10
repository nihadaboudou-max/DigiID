# -*- coding: utf-8 -*-
"""
Moteur OCR pour l'extraction de texte des Cartes Nationales d'Identité.

Utilise Tesseract OCR avec la langue française pour extraire le texte
des images de CNI. Effectue un prétraitement d'image (OpenCV) pour
améliorer la qualité de la reconnaissance.

Pipeline :
  1. Chargement et conversion de l'image
  2. Prétraitement (redimensionnement, normalisation, débruitage, binarisation)
  3. OCR avec Tesseract (langue fra + eng)
  4. Nettoyage et structuration du texte brut
  5. Calcul du taux de confiance
"""
import io
import time
from typing import Optional, Tuple

import cv2
import numpy as np
from PIL import Image

from src.noyau.journal import journal

# =============================================================================
# Constantes
# =============================================================================

# Taille cible pour l'image redimensionnée (garder les proportions)
TAILLE_CIBLE_LONGUEUR_MAX = 2500  # pixels

# Configuration Tesseract
CONFIG_TESSERACT = (
    "--oem 3"            # LSTM + Legacy (meilleur résultat)
    " --psm 4"           # Mode de segmentation : texte multicolonne uniforme
    " -c tessedit_char_whitelist="
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    "0123456789/<>+-.()[]:,;!?àâäæçéèêëîïôöœùûüÿÀÂÄÆÇÉÈÊËÎÏÔÖŒÙÛÜŸ "
    " -c tessedit_enable_dict_correction=1"
)

# Configuration pour la MRZ (Machine Readable Zone) — beaucoup plus restrictive
CONFIG_TESSERACT_MRZ = (
    "--oem 1"            # LSTM uniquement
    " --psm 7"           # Traiter l'image comme une seule ligne de texte
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

    # 3. Débruitage (Non-local Means Denoising)
    debruite = cv2.fastNlMeansDenoising(gris, h=10)

    # 4. Amélioration du contraste (CLAHE)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    contraste = clahe.apply(debruite)

    # 5. Binarisation adaptative (gère les ombres et éclairage non uniforme)
    binaire = cv2.adaptiveThreshold(
        contraste, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=31,  # Taille de la fenêtre locale
        C=10           # Constante soustraite
    )

    # 6. Optionnel : fermeture morphologique pour connecter les caractères brisés
    noyau = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
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


def _extraire_zone_mrz(image: np.ndarray) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Détecte et extrait spécifiquement la zone MRZ (bas de la carte).

    La MRZ française se trouve dans le bas de la carte et comporte
    3 lignes de 30 caractères (format TD1).

    Retour :
        Tuple (ligne_1, ligne_2, ligne_3) ou (None, None, None)
    """
    hauteur, largeur = image.shape[:2]

    # La MRZ occupe environ les 15-20% inférieurs de la carte
    debut_mrz = int(hauteur * 0.80)
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
            lang="eng",  # La MRZ est uniquement en anglais/chiffres
            config=CONFIG_TESSERACT_MRZ
        )

        # Nettoyer et séparer les lignes
        lignes = [
            ligne.strip()
            for ligne in texte_mrz.split("\n")
            if ligne.strip()
        ]

        ligne_1 = lignes[0] if len(lignes) > 0 else None
        ligne_2 = lignes[1] if len(lignes) > 1 else None
        ligne_3 = lignes[2] if len(lignes) > 2 else None

        # Nettoyer : ne garder que les caractères valides MRZ
        def _nettoyer_ligne_mrz(ligne: Optional[str]) -> Optional[str]:
            if ligne is None:
                return None
            ligne = ligne.upper()
            ligne = "".join(c for c in ligne if c.isalnum() or c in "<")
            return ligne if len(ligne) >= 10 else None  # Trop court = probablement pas une MRZ

        return (
            _nettoyer_ligne_mrz(ligne_1),
            _nettoyer_ligne_mrz(ligne_2),
            _nettoyer_ligne_mrz(ligne_3),
        )

    except ImportError:
        journal.warning("pytesseract non disponible pour l'extraction MRZ")
        return None, None, None
    except Exception as erreur:
        journal.error(f"Erreur extraction MRZ : {erreur}")
        return None, None, None


def analyser_image_cni(donnees_image: bytes) -> dict:
    """
    Fonction principale d'analyse OCR d'une image de CNI.

    Args :
        donnees_image : Bytes de l'image (JPEG, PNG)

    Retour :
        Dictionnaire contenant :
          - texte_brut : texte complet extrait
          - confiance_moyenne : taux de confiance (0-100)
          - mrz_lignes : tuple des 3 lignes MRZ
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

    # 2. Prétraiter l'image
    _, image_binaire, image_originale = _pretraiter_image(image)

    # 3. OCR principal sur l'image prétraitée (binaire)
    texte_principal, confiance_principal = _executer_tesseract(image_binaire)

    # 4. OCR secondaire sur l'image en niveaux de gris (pour les détails)
    try:
        import pytesseract
        pil_gris = Image.fromarray(cv2.cvtColor(
            cv2.resize(image, (image.shape[1], image.shape[0])),
            cv2.COLOR_BGR2GRAY
        ))
        texte_gris = pytesseract.image_to_string(
            pil_gris,
            lang="fra+eng",
            config=CONFIG_TESSERACT
        )
    except (ImportError, Exception) as erreur:
        texte_gris = ""
        if "pytesseract" not in str(erreur):
            journal.warning(f"OCR secondaire échoué : {erreur}")

    # 5. Combiner les résultats (le meilleur des deux)
    texte_combine = texte_principal
    if len(texte_gris) > len(texte_principal):
        texte_combine = texte_gris

    confiance = max(confiance_principal, 0.0)

    if not texte_combine.strip():
        erreurs.append("Aucun texte extrait. L'image est peut-être de trop mauvaise qualité.")
        confiance = 0.0

    # 6. Extraire la MRZ
    image_gris, _, _ = _pretraiter_image(image)
    mrz_l1, mrz_l2, mrz_l3 = _extraire_zone_mrz(image_gris)

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
