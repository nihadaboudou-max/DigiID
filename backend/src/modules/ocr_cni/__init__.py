# -*- coding: utf-8 -*-
"""
Module OCR CNI — Scan et authentification de la Carte Nationale d'Identité.

Ce module permet à un utilisateur de :
  1. Uploader une photo recto/verso de sa CNI
  2. Extraire automatiquement les champs par OCR (pytesseract + français)
  3. Valider le format des champs (numéro, dates, MRZ)
  4. Vérifier la cohérence des données extraites
  5. Authentifier la carte (validation MRZ + checksum)
  6. Associer la vérification à l'utilisateur pour KYC

Dépendances :
  - pytesseract (Tesseract OCR avec langue française)
  - opencv-python-headless (prétraitement image)
  - Pillow (manipulation image)
  - python-dateutil (parsing dates)
"""
from src.modules.ocr_cni.routes import routeur_ocr_cni

__all__ = ["routeur_ocr_cni"]
