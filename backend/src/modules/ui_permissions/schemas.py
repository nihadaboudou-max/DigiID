# -*- coding: utf-8 -*-
"""Schémas Pydantic pour le module de permissions UI."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ModulePermissionSchema(BaseModel):
    """Un module UI avec ses permissions pour un rôle."""
    role_name: str = Field(..., description="Nom du rôle")
    module_key: str = Field(..., description="Identifiant unique du module")
    module_label: Optional[str] = Field(None, description="Libellé affichable du module")
    module_description: Optional[str] = Field(None, description="Description du module")
    module_icon: Optional[str] = Field("default", description="Icône du module")
    is_enabled: bool = Field(True, description="Module activé ou désactivé")
    is_read_only: bool = Field(False, description="Module en lecture seule")
    updated_at: Optional[datetime] = Field(None, description="Date de dernière modification")


class MatricePermissionsResponse(BaseModel):
    """Matrice complète des permissions UI."""
    modules: list[ModulePermissionSchema]
    total: int


class ModulesRoleResponse(BaseModel):
    """Modules UI pour un rôle spécifique."""
    role: str
    modules: list[ModulePermissionSchema]
    total: int


class MiseAJourModuleRequete(BaseModel):
    """Requête de mise à jour d'un module pour un rôle."""
    module_key: str = Field(..., description="Identifiant du module à modifier")
    is_enabled: Optional[bool] = Field(None, description="Activer/désactiver le module")
    is_read_only: Optional[bool] = Field(None, description="Passer en lecture seule")


class ConfigUIUtilisateurResponse(BaseModel):
    """Configuration UI complète pour un utilisateur connecté."""
    role: str
    layout: str = "default"
    modules: list[ModulePermissionSchema]


class OverridesUtilisateurRequete(BaseModel):
    """Requête de mise à jour des overrides UI d'un utilisateur."""
    modules_overrides: dict = Field(
        ...,
        description="Dictionnaire des overrides : { module_key: { is_enabled: bool, is_read_only: bool } }",
    )


class OverridesUtilisateurResponse(BaseModel):
    """Réponse après mise à jour des overrides."""
    utilisateur_id: str
    modules_overrides: dict
    message: str
