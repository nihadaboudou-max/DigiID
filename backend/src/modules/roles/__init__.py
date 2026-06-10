# -*- coding: utf-8 -*-
"""
Module Roles — Gestion des rôles et permissions RBAC.

Permet aux utilisateurs de demander un changement de rôle
et aux administrateurs de gérer les attributions de rôles.
"""
from src.modules.roles.routes import routeur_roles

__all__ = ["routeur_roles"]
