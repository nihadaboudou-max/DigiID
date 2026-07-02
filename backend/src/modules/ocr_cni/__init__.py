# -*- coding: utf-8 -*-
"""
Module OCR CNI — Scan et authentification de documents d'identité africains.
Ce module permet à un utilisateur de :
- Uploader une photo recto/verso de sa CNI, passeport, CIP, etc.
- Extraire automatiquement les champs par OCR (pytesseract)
- Valider le format des champs (numéro, dates, MRZ)
- Vérifier la cohérence des données extraites
- Authentifier le document (validation MRZ + checksum)
- Associer la vérification à l'utilisateur pour KYC

Pays supportés : Côte d'Ivoire, Sénégal, Mali, Burkina Faso, Niger,
Bénin, Togo, Ghana, Nigeria, Cameroun, Gabon, RDC, Maroc, Algérie,
Tunisie, et tout document avec MRZ (standard ICAO 9303).

Dépendances :
- pytesseract (Tesseract OCR avec langue française + anglaise)
- opencv-python-headless (prétraitement image)
- Pillow (manipulation image)
"""
from src.modules.ocr_cni.routes import routeur_ocr_cni

__all__ = ["routeur_ocr_cni"]