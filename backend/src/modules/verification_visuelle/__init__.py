# -*- coding: utf-8 -*-
"""
Module vérification visuelle (Deep Learning) — Phase 4.

Contient :
  - service.py            : orchestration de la vérification
  - detection_visage.py   : détection qu'un visage est bien présent
  - embedding_facial.py   : génération du vecteur facial
  - anti_spoofing.py      : détection des photos d'écran
  - comparaison.py        : comparaison d'embeddings (anti-doublon)
  - listes_recherchees.py : comparaison aux listes officielles (OFAC, ONU, Interpol)
  - routes.py             : endpoints API utilisateur protégés
  - schemas.py            : contrats de vérification visuelle
"""

from src.modules.verification_visuelle.routes import routeur_verification as routeur_verification_visuelle

__all__ = ["routeur_verification_visuelle"]
