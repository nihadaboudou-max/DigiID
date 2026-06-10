# -*- coding: utf-8 -*-
"""
Module détection de fraude — Phase 4.

Contient :
  - service.py        : orchestration des règles + ML
  - regles.py         : règles métier explicites (vélocité, géolocalisation, etc.)
  - modele_anomalies.py : génération de score d'anomalie
  - scoring_risque.py : calcul du score de risque par action
  - routes.py         : endpoints API utilisateur protégés
  - schemas.py        : contrats de la détection de fraude
"""

from src.modules.detection_fraude.routes import routeur_fraude

__all__ = ["routeur_fraude"]
