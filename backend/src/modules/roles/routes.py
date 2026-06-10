# -*- coding: utf-8 -*-
"""
Routes API du module Roles — Gestion des rôles RBAC.

Préfixe : /api/v1/utilisateur/role
"""
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import (
    obtenir_ip_client,
    utilisateur_courant,
)
from src.modules.roles import service
from src.modules.roles.schemas import (
    ChangementRoleAdmin,
    DemandeRoleRequete,
    DemandeRoleReponse,
)


routeur_roles = APIRouter(
    prefix="/api/v1/utilisateur/role",
    tags=["Roles & Permissions (RBAC)"],
)


@routeur_roles.post(
    "/demander",
    response_model=DemandeRoleReponse,
    summary="Demander un changement de rôle",
    description=(
        "Permet à un utilisateur de demander un nouveau rôle. "
        "Les rôles institutionnels (agent, police, médecin, ONG) nécessitent "
        "une vérification d'identité complète. Les rôles admin nécessitent la 2FA."
    ),
)
async def demander_role(
    requete: DemandeRoleRequete,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    ip_client: Annotated[str, Depends(obtenir_ip_client)],
):
    return await service.demander_changement_role(
        session=session,
        utilisateur=utilisateur,
        role_demande=requete.role_demande,
        adresse_ip=ip_client,
    )


@routeur_roles.post(
    "/approuver",
    response_model=dict,
    summary="[Admin] Approuver un changement de rôle",
    description="Réservé aux administrateurs. Permet de changer le rôle d'un utilisateur.",
)
async def approuver_role(
    commande: ChangementRoleAdmin,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    return await service.approuver_changement_role(
        session=session,
        administrateur=utilisateur,
        utilisateur_id=commande.utilisateur_id,
        nouveau_role=commande.nouveau_role,
        raison=commande.raison,
    )
