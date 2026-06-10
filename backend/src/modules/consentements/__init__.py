# -*- coding: utf-8 -*-
"""Module Consentements — gestion granulaire des autorisations RGPD-like."""
from src.modules.consentements.routes import routeur_consentements
from src.modules.consentements.categories import CategoriesConsentement

__all__ = ["routeur_consentements", "CategoriesConsentement"]
