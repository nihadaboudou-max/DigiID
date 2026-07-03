# -*- coding: utf-8 -*-
"""
Module QR Code Dynamique — Génération et vérification de QR codes temporaires.

Sécurité :
- Expiration automatique après 30 secondes
- Invalidation après premier scan (usage unique)
- Renouvellement à chaque demande
"""
from src.modules.qr_dynamique.routes import routeur_qr_dynamique

__all__ = ["routeur_qr_dynamique"]