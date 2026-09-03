# -*- coding: utf-8 -*-
"""
Moteur OCR intelligent utilisant EasyOCR + PaddleOCR.
Beaucoup plus performant que Tesseract pour les documents d'identité africains.
"""
import easyocr
import numpy as np
from PIL import Image
import io
from typing import Optional, Tuple, Dict, List
from src.noyau.journal import journal

# Initialisation globale du lecteur (évite de recharger le modèle à chaque appel)
_lecteur_ocr = None

def _get_lecteur_ocr():
    global _lecteur_ocr
    if _lecteur_ocr is None:
        # Langues : français, anglais, arabe (pour le Maghreb)
        _lecteur_ocr = easyocr.Reader(
            ['fr', 'en', 'ar'],
            gpu=False,  # Mettre True si GPU disponible
            model_storage_directory='/app/models/easyocr',
            download_enabled=True
        )
    return _lecteur_ocr

def analyser_document_intelligent(donnees_image: bytes) -> Dict:
    """
    Analyse un document avec EasyOCR.
    Retourne le texte brut ET les positions des mots (bounding boxes).
    """
    lecteur = _get_lecteur_ocr()
    
    # Charger l'image
    image = np.array(Image.open(io.BytesIO(donnees_image)).convert('RGB'))
    
    # EasyOCR retourne : (bbox, texte, confiance)
    resultats = lecteur.readtext(
        image,
        paragraph=True,  # Regroupe les mots en paragraphes
        detail=1,        # Retourne les coordonnées
        min_size=10      # Ignore le bruit trop petit
    )
    
    # Extraire le texte complet
    texte_brut = "\n".join([r[1] for r in resultats])
    
    # Calculer la confiance moyenne
    confiances = [r[2] for r in resultats if r[2] > 0]
    confiance_moyenne = sum(confiances) / len(confiances) if confiances else 0.0
    
    # Extraire les bounding boxes pour analyse spatiale
    boxes = [
        {"texte": r[1], "confiance": r[2], "bbox": r[0]}
        for r in resultats
        if r[2] > 0.3  # Filtrer les détections faibles
    ]
    
    return {
        "texte_brut": texte_brut,
        "confiance_moyenne": round(confiance_moyenne * 100, 2),
        "boxes": boxes,
        "succes": bool(texte_brut.strip())
    }