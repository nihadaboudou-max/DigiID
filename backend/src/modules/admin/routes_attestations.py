# -*- coding: utf-8 -*-
"""
Routes admin pour le module Attestations Communautaires.

Endpoints réservés aux administrateurs et super-administrateurs :
  GET    /api/v1/admin/attestations                    → Lister TOUTES les attestations
  GET    /api/v1/admin/attestations/statistiques       → Statistiques globales
  DELETE /api/v1/admin/attestations/{id}               → Supprimer une attestation (modération)

Ces endpoints permettent aux admins de modérer le réseau de confiance
sans avoir à utiliser les mêmes endpoints que les utilisateurs standards.
"""
import logging
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import admin_courant
from src.modules.attestations_communautaires.service import ServiceAttestations
from src.modules.attestations_communautaires.schemas import (
    AttestationDetail,
    ListeAttestations,
)

journal = logging.getLogger("digiid.admin.attestations")

# -----------------------------------------------------------------------------
# Routeur
# -----------------------------------------------------------------------------

routeur_admin_attestations = APIRouter(
    prefix="/api/v1/admin/attestations",
    tags=["Admin - Attestations communautaires"],
    dependencies=[Depends(admin_courant)],
)


# -------------------------------------------------------------------------
# Dépendance : service
# -------------------------------------------------------------------------

async def obtenir_service(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
) -> ServiceAttestations:
    """Injecte le service d'attestations dans les endpoints."""
    return ServiceAttestations(session)


# -------------------------------------------------------------------------
# Endpoints
# -------------------------------------------------------------------------

@routeur_admin_attestations.get(
    "",
    response_model=ListeAttestations,
    summary="[Admin] Lister toutes les attestations",
    description=(
        "Retourne la liste paginée de TOUTES les attestations du système. "
        "Permet aux administrateurs de modérer le réseau de confiance. "
        "Filtres optionnels par statut, type d'attestation et utilisateur."
    ),
)
async def lister_toutes_attestations(
    service: Annotated[ServiceAttestations, Depends(obtenir_service)],
    admin: Annotated[Utilisateur, Depends(admin_courant)],
    statut: Optional[str] = Query(
        default=None,
        description="Filtrer par statut : EN_ATTENTE, APPROUVEE, REFUSEE, EXPIREE",
    ),
    type_attestation: Optional[str] = Query(
        default=None,
        description="Filtrer par type d'attestation",
    ),
    utilisateur_id: Optional[UUID] = Query(
        default=None,
        description="Filtrer par utilisateur (attestant ou attesté)",
    ),
    page: int = Query(default=1, ge=1, description="Numéro de page"),
    limite: int = Query(default=20, ge=1, le=100, description="Éléments par page"),
):
    """
    Liste toutes les attestations du système avec pagination et filtres.
    Réservé aux administrateurs et super-administrateurs.
    """
    try:
        return await service.lister_toutes_attestations(
            utilisateur=admin,
            statut=statut,
            type_attestation=type_attestation,
            utilisateur_id=utilisateur_id,
            page=page,
            limite=limite,
        )
    except PermissionError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail=str(e))


@routeur_admin_attestations.get(
    "/statistiques",
    summary="[Admin] Statistiques globales des attestations",
    description=(
        "Retourne les statistiques globales du système d'attestations : "
        "nombre total, répartition par statut, poids moyen, "
        "nombre d'attestants/attestés uniques, créations du jour, "
        "et répartition par type d'attestation."
    ),
)
async def statistiques_globales(
    service: Annotated[ServiceAttestations, Depends(obtenir_service)],
    admin: Annotated[Utilisateur, Depends(admin_courant)],
):
    """
    Calcule et retourne les statistiques globales des attestations.
    Réservé aux administrateurs et super-administrateurs.
    """
    try:
        return await service.obtenir_statistiques_globales(utilisateur=admin)
    except PermissionError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail=str(e))


@routeur_admin_attestations.delete(
    "/{attestation_id}",
    status_code=status.HTTP_200_OK,
    summary="[Admin] Supprimer une attestation (modération)",
    description=(
        "Supprime définitivement une attestation. "
        "Action de modération réservée aux administrateurs et super-administrateurs. "
        "L'action est tracée dans le journal d'audit."
    ),
)
async def supprimer_attestation_admin(
    service: Annotated[ServiceAttestations, Depends(obtenir_service)],
    admin: Annotated[Utilisateur, Depends(admin_courant)],
    attestation_id: UUID = Path(..., description="UUID de l'attestation à supprimer"),
):
    """
    Supprime une attestation (modération administrative).
    Réservé aux administrateurs et super-administrateurs.
    """
    try:
        # Appel direct au service qui gère déjà les permissions admin
        return await service.supprimer_attestation(attestation_id, admin)
    except ValueError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail=str(e))
