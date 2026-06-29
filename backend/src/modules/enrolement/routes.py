# -*- coding: utf-8 -*-
"""Routes API pour l'enrôlement citoyen — avec cloisonnement."""
from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.enrolement.schemas import (
    EnrolementCreate,
    EnrolementResponse,
    EnrolementUpdate,
)
from src.modules.enrolement import service

routeur_enrolement = APIRouter(prefix="/api/v1/enrolement", tags=["Enrôlement"])


@routeur_enrolement.get("/liste", response_model=list[EnrolementResponse])
async def lister_enrolements(
    agent: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    statut: str = Query("tous"),
):
    """Liste les enrôlements avec cloisonnement."""
    enrolements = await service.obtenir_enrolements(session, agent, statut)
    return [
        EnrolementResponse(
            id=e.id,
            agent_id=e.agent_id,
            citoyen_nom=e.citoyen_nom,
            citoyen_prenom=e.citoyen_prenom,
            citoyen_digiid=e.citoyen_digiid,
            citoyen_telephone=e.citoyen_telephone,
            citoyen_email=e.citoyen_email,
            statut=e.statut,
            notes=e.notes,
            scan_cni=e.scan_cni,
            capture_biometrique=e.capture_biometrique,
            date_enrolement=e.date_enrolement,
            date_validation=e.date_validation,
            domaine_id=e.domaine_id,
            departement_id=e.departement_id,
        )
        for e in enrolements
    ]


@routeur_enrolement.post("/creer", response_model=EnrolementResponse, status_code=201)
async def creer_enrolement(
    data: EnrolementCreate,
    agent: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Crée un enrôlement avec cloisonnement automatique."""
    e = await service.creer_enrolement(session, agent, data.model_dump())
    return EnrolementResponse(
        id=e.id,
        agent_id=e.agent_id,
        citoyen_nom=e.citoyen_nom,
        citoyen_prenom=e.citoyen_prenom,
        citoyen_digiid=e.citoyen_digiid,
        citoyen_telephone=e.citoyen_telephone,
        citoyen_email=e.citoyen_email,
        statut=e.statut,
        notes=e.notes,
        scan_cni=e.scan_cni,
        capture_biometrique=e.capture_biometrique,
        date_enrolement=e.date_enrolement,
        date_validation=e.date_validation,
        domaine_id=e.domaine_id,
        departement_id=e.departement_id,
    )


@routeur_enrolement.get("/{enrolement_id}", response_model=EnrolementResponse)
async def obtenir_enrolement(
    enrolement_id: UUID,
    agent: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Récupère un enrôlement par son ID."""
    e = await service.obtenir_enrolement(session, enrolement_id)
    if not e:
        raise HTTPException(404, "Enrôlement introuvable")
    return EnrolementResponse(
        id=e.id,
        agent_id=e.agent_id,
        citoyen_nom=e.citoyen_nom,
        citoyen_prenom=e.citoyen_prenom,
        citoyen_digiid=e.citoyen_digiid,
        citoyen_telephone=e.citoyen_telephone,
        citoyen_email=e.citoyen_email,
        statut=e.statut,
        notes=e.notes,
        scan_cni=e.scan_cni,
        capture_biometrique=e.capture_biometrique,
        date_enrolement=e.date_enrolement,
        date_validation=e.date_validation,
        domaine_id=e.domaine_id,
        departement_id=e.departement_id,
    )


@routeur_enrolement.patch("/{enrolement_id}", response_model=EnrolementResponse)
async def modifier_enrolement(
    enrolement_id: UUID,
    data: EnrolementUpdate,
    agent: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Modifie un enrôlement."""
    e = await service.mettre_a_jour_enrolement(session, enrolement_id, data.model_dump(exclude_none=True))
    if not e:
        raise HTTPException(404, "Enrôlement introuvable")
    return EnrolementResponse(
        id=e.id,
        agent_id=e.agent_id,
        citoyen_nom=e.citoyen_nom,
        citoyen_prenom=e.citoyen_prenom,
        citoyen_digiid=e.citoyen_digiid,
        citoyen_telephone=e.citoyen_telephone,
        citoyen_email=e.citoyen_email,
        statut=e.statut,
        notes=e.notes,
        scan_cni=e.scan_cni,
        capture_biometrique=e.capture_biometrique,
        date_enrolement=e.date_enrolement,
        date_validation=e.date_validation,
        domaine_id=e.domaine_id,
        departement_id=e.departement_id,
    )