# -*- coding: utf-8 -*-
"""Module espace administrateur — endpoints réservés au rôle 'administrateur'."""
from src.modules.admin.routes import routeur_admin
from src.modules.admin.routes_attestations import routeur_admin_attestations

__all__ = ["routeur_admin", "routeur_admin_attestations"]
