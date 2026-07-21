# -*- coding: utf-8 -*-
"""
Module Recherche Faciale Médicale — pour les agents médicaux.

Contient :
  - routes.py   : endpoints API pour la recherche faciale
  - schemas.py  : contrats Pydantic de la recherche faciale
  - service.py  : logique métier (orchestration)

Endpoint : /api/v1/medical/recherche-faciale
Inspiré du module verification_visuelle.
"""

from src.modules.recherche_faciale.routes import routeur_recherche_faciale

__all__ = ["routeur_recherche_faciale"]
