# -*- coding: utf-8 -*-
"""
Routes API du module Attestations Communautaires — Étape 4.

Endpoints :
  GET    /api/v1/utilisateur/attestations           → Lister mes attestations
  GET    /api/v1/utilisateur/attestations/statistiques → Mes statistiques
  POST   /api/v1/utilisateur/attestations           → Créer une attestation
  GET    /api/v1/utilisateur/attestations/{id}      → Détail d'une attestation
  PATCH  /api/v1/utilisateur/attestations/{id}      → Modifier une attestation
  DELETE /api/v1/utilisateur/attestations/{id}      → Supprimer une attestation
  POST   /api/v1/utilisateur/attestations/{id}/approuver  → Approuver
  POST   /api/v1/utilisateur/attestations/{id}/refuser    → Refuser

Tous les endpoints sont protégés (utilisateur authentifié).
"""
import logging
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Path, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.attestations_communautaires.service import ServiceAttestations
from src.modules.attestations_communautaires.schemas import (
    CreationAttestation,
    DecisionAttestation,
    MiseAJourAttestation,
    AttestationDetail,
    ListeAttestations,
    StatistiquesAttestations,
    ResultatCreation,
    ResultatDecision,
)

journal = logging.getLogger("digiid.attestations.routes")

# -----------------------------------------------------------------------------
# Routeur
# -----------------------------------------------------------------------------

routeur_attestations = APIRouter(
    prefix="/api/v1/utilisateur/attestations",
    tags=["Attestations communautaires"],
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

@routeur_attestations.get(
    "",
    response_model=ListeAttestations,
    summary="Lister mes attestations reçues ou envoyées",
    description=(
        "Retourne la liste paginée des attestations de l'utilisateur connecté. "
        "Paramètre 'direction' : 'recues' (défaut) ou 'envoyees'. "
        "Filtres optionnels par statut et type d'attestation."
    ),
)
async def lister_attestations(
    service: Annotated[ServiceAttestations, Depends(obtenir_service)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    direction: str = Query(
        default="recues",
        description="Direction : 'recues' (celles qu'on m'a envoyées) ou 'envoyees' (celles que j'ai écrites)",
        pattern=r"^(recues|envoyees)$",
    ),
    statut: Optional[str] = Query(
        default=None,
        description="Filtrer par statut : EN_ATTENTE, APPROUVEE, REFUSEE, EXPIREE",
    ),
    type_attestation: Optional[str] = Query(
        default=None,
        description="Filtrer par type d'attestation",
    ),
    page: int = Query(default=1, ge=1, description="Numéro de page"),
    limite: int = Query(default=20, ge=1, le=100, description="Éléments par page"),
):
    """Liste les attestations de l'utilisateur avec pagination et filtres."""
    return await service.lister_mes_attestations(
        utilisateur=utilisateur,
        statut=statut,
        type_attestation=type_attestation,
        direction=direction,
        page=page,
        limite=limite,
    )


@routeur_attestations.get(
    "/statistiques",
    response_model=StatistiquesAttestations,
    summary="Mes statistiques d'attestations",
    description=(
        "Retourne les statistiques complètes : nombre d'attestations reçues, "
        "envoyées, approuvées, refusées, score total, etc."
    ),
)
async def statistiques_attestations(
    service: Annotated[ServiceAttestations, Depends(obtenir_service)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """Calcule et retourne les statistiques d'attestation de l'utilisateur."""
    return await service.obtenir_statistiques(utilisateur)


@routeur_attestations.post(
    "",
    response_model=ResultatCreation,
    status_code=status.HTTP_201_CREATED,
    summary="Créer une nouvelle attestation",
    description=(
        "Crée une attestation communautaire envers un autre utilisateur. "
        "L'attestation est créée avec le statut EN_ATTENTE. "
        "L'utilisateur attesté devra l'approuver ou la refuser."
    ),
)
async def creer_attestation(
    service: Annotated[ServiceAttestations, Depends(obtenir_service)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    donnees: CreationAttestation,
):
    """Crée une nouvelle attestation communautaire."""
    try:
        return await service.creer_attestation(utilisateur, donnees)
    except ValueError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=str(e))


@routeur_attestations.get(
    "/{attestation_id}",
    response_model=AttestationDetail,
    summary="Détail d'une attestation",
    description=(
        "Retourne le détail complet d'une attestation. "
        "Accessible à l'attestant, l'attesté et aux super-administrateurs."
    ),
)
async def detail_attestation(
    service: Annotated[ServiceAttestations, Depends(obtenir_service)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    attestation_id: UUID = Path(..., description="UUID de l'attestation"),
):
    """Obtient le détail d'une attestation."""
    try:
        return await service.obtenir_detail_attestation(attestation_id, utilisateur)
    except ValueError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail=str(e))


@routeur_attestations.patch(
    "/{attestation_id}",
    response_model=AttestationDetail,
    summary="Modifier une attestation",
    description=(
        "Modifie le titre, la description, les forces ou la visibilité "
        "d'une attestation. Seul l'attestant peut modifier."
    ),
)
async def modifier_attestation(
    service: Annotated[ServiceAttestations, Depends(obtenir_service)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    donnees: MiseAJourAttestation,
    attestation_id: UUID = Path(..., description="UUID de l'attestation"),
):
    """Modifie une attestation existante."""
    try:
        return await service.mettre_a_jour_attestation(
            attestation_id, utilisateur, donnees
        )
    except ValueError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail=str(e))


@routeur_attestations.delete(
    "/{attestation_id}",
    status_code=status.HTTP_200_OK,
    summary="Supprimer une attestation",
    description=(
        "Supprime définitivement une attestation. "
        "Seul l'attestant ou un super-administrateur peut supprimer."
    ),
)
async def supprimer_attestation(
    service: Annotated[ServiceAttestations, Depends(obtenir_service)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    attestation_id: UUID = Path(..., description="UUID de l'attestation"),
):
    """Supprime une attestation."""
    try:
        return await service.supprimer_attestation(attestation_id, utilisateur)
    except ValueError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail=str(e))


@routeur_attestations.post(
    "/{attestation_id}/approuver",
    response_model=ResultatDecision,
    summary="Approuver une attestation reçue",
    description=(
        "Approuve une attestation reçue. "
        "L'utilisateur connecté doit être la personne attestée. "
        "Le score de confiance est automatiquement mis à jour."
    ),
)
async def approuver_attestation(
    service: Annotated[ServiceAttestations, Depends(obtenir_service)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    attestation_id: UUID = Path(..., description="UUID de l'attestation à approuver"),
):
    """Approuve une attestation reçue et met à jour le score."""
    try:
        return await service.approuver_attestation(attestation_id, utilisateur)
    except ValueError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail=str(e))


@routeur_attestations.post(
    "/{attestation_id}/refuser",
    response_model=ResultatDecision,
    summary="Refuser une attestation reçue",
    description=(
        "Refuse une attestation reçue avec un motif. "
        "L'utilisateur connecté doit être la personne attestée."
    ),
)
async def refuser_attestation(
    service: Annotated[ServiceAttestations, Depends(obtenir_service)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    decision: DecisionAttestation,
    attestation_id: UUID = Path(..., description="UUID de l'attestation à refuser"),
):
    """Refuse une attestation reçue avec un motif."""
    try:
        return await service.refuser_attestation(attestation_id, utilisateur, decision)
    except ValueError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail=str(e))
