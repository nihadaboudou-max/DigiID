# -*- coding: utf-8 -*-
"""
Routes API pour la gestion des permissions UI par rôle.

Préfixe : /api/v1/super-admin/ui-permissions
  + /api/v1/auth/me/ui-config (pour l'utilisateur connecté)

Endpoints :
  GET    /api/v1/super-admin/ui-permissions          → matrice complète
  GET    /api/v1/super-admin/ui-permissions/{role}   → modules d'un rôle
  PUT    /api/v1/super-admin/ui-permissions/{role}   → modifier un module
  POST   /api/v1/super-admin/ui-permissions/utilisateurs/{id}/overrides → overrides individuels
  GET    /api/v1/auth/me/ui-config                   → config UI de l'utilisateur connecté
"""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import (
    obtenir_ip_client,
    super_admin_courant,
    utilisateur_courant,
)
from src.modules.ui_permissions import service
from src.modules.ui_permissions.schemas import (
    MatricePermissionsResponse,
    MiseAJourModuleRequete,
    ModulesRoleResponse,
    ConfigUIUtilisateurResponse,
    OverridesUtilisateurRequete,
    OverridesUtilisateurResponse,
)


routeur_ui_permissions = APIRouter(
    prefix="/api/v1/super-admin/ui-permissions",
    tags=["Super Admin — Permissions UI"],
    dependencies=[Depends(super_admin_courant)],
)


# =============================================================================
# ENDPOINTS SUPER ADMIN
# =============================================================================


@routeur_ui_permissions.get(
    "",
    response_model=MatricePermissionsResponse,
    summary="Matrice complète des permissions UI",
    description=(
        "Retourne toute la matrice rôle × module UI. "
        "Utilisé par le Super Admin pour visualiser et configurer "
        "les accès aux interfaces de chaque profil."
    ),
)
async def obtenir_matrice_ui(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Retourne la matrice complète des permissions UI (rôle × module)."""
    modules = await service.obtenir_matrice_complete(session)
    return MatricePermissionsResponse(modules=modules, total=len(modules))


@routeur_ui_permissions.get(
    "/{role}",
    response_model=ModulesRoleResponse,
    summary="Modules UI d'un rôle spécifique",
    description="Retourne tous les modules UI configurés pour un rôle donné.",
)
async def obtenir_modules_role(
    role: str,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Retourne les modules UI configurés pour un rôle."""
    modules = await service.obtenir_modules_role(session, role)
    return ModulesRoleResponse(role=role, modules=modules, total=len(modules))


@routeur_ui_permissions.put(
    "/{role}",
    response_model=dict,
    summary="Modifier un module UI pour un rôle",
    description=(
        "Met à jour la configuration d'un module UI pour un rôle donné. "
        "Permet d'activer/désactiver un module ou de le passer en lecture seule. "
        "Chaque modification est tracée dans le journal d'audit."
    ),
)
async def modifier_module_role(
    requete: Request,
    role: str,
    donnees: MiseAJourModuleRequete,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    super_admin: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """Modifie la configuration d'un module UI pour un rôle."""
    return await service.mettre_a_jour_module_role(
        session=session,
        super_admin=super_admin,
        role=role,
        module_key=donnees.module_key,
        is_enabled=donnees.is_enabled,
        is_read_only=donnees.is_read_only,
        adresse_ip=obtenir_ip_client(requete),
    )


@routeur_ui_permissions.post(
    "/utilisateurs/{utilisateur_id}/overrides",
    response_model=OverridesUtilisateurResponse,
    summary="Modifier les overrides UI d'un utilisateur",
    description=(
        "Permet de définir des overrides individuels pour un utilisateur spécifique. "
        "Utile pour accorder ou restreindre des accès à titre exceptionnel."
    ),
)
async def modifier_overrides_utilisateur(
    requete: Request,
    utilisateur_id: UUID,
    donnees: OverridesUtilisateurRequete,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    super_admin: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """Modifie les overrides UI individuels d'un utilisateur."""
    return await service.mettre_a_jour_overrides_utilisateur(
        session=session,
        super_admin=super_admin,
        utilisateur_id=utilisateur_id,
        modules_overrides=donnees.modules_overrides,
        adresse_ip=obtenir_ip_client(requete),
    )


# =============================================================================
# ENDPOINT PUBLIC (utilisateur connecté)
# =============================================================================


# Routeur séparé pour l'endpoint publique (attaché à /api/v1/auth)
routeur_ui_config = APIRouter(
    tags=["Configuration UI"],
)


@routeur_ui_config.get(
    "/api/v1/auth/me/ui-config",
    response_model=ConfigUIUtilisateurResponse,
    summary="Configuration UI de l'utilisateur connecté",
    description=(
        "Retourne la configuration UI complète pour l'utilisateur connecté. "
        "Inclut les modules accessibles, leur statut (activé/lecture seule), "
        "et le layout préféré. Les overrides individuels sont fusionnés."
    ),
)
async def obtenir_config_ui(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """Retourne la configuration UI personnalisée de l'utilisateur connecté."""
    config = await service.obtenir_config_ui_utilisateur(session, utilisateur)
    return ConfigUIUtilisateurResponse(**config)
