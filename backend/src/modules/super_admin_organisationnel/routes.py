# -*- coding: utf-8 -*-
"""Routes API Super Admin — Gestion organisationnelle (Domaines, Départements, Invitations, Équipes)."""
from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant

from .schemas import (
    DomaineCreate, DomaineUpdate, DomaineResponse, ListeDomaines,
    DepartementCreate, DepartementUpdate, DepartementResponse, ListeDepartements,
    InvitationCreate, InvitationResponse, ListeInvitations,
    EquipeCreate, EquipeUpdate, EquipeResponse, ListeEquipes,
)
from . import service

routeur = APIRouter(prefix="/api/v1/super-admin", tags=["Super Admin Organisationnel"])


# ============ DOMAINES ============

@routeur.get("/domaines", response_model=ListeDomaines)
async def lister_domaines(
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Liste tous les domaines."""
    if utilisateur.role != "super_administrateur":
        raise HTTPException(403, "Accès réservé au super administrateur")
    domaines = await service.lister_domaines(session)
    return ListeDomaines(domaines=domaines, total=len(domaines))


@routeur.post("/domaines", response_model=DomaineResponse, status_code=201)
async def creer_domaine(
    data: DomaineCreate,
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Crée un nouveau domaine."""
    if utilisateur.role != "super_administrateur":
        raise HTTPException(403, "Accès réservé au super administrateur")
    return await service.creer_domaine(session, data)


@routeur.patch("/domaines/{domaine_id}", response_model=DomaineResponse)
async def modifier_domaine(
    domaine_id: UUID,
    data: DomaineUpdate,
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Modifie un domaine."""
    if utilisateur.role != "super_administrateur":
        raise HTTPException(403, "Accès réservé au super administrateur")
    domaine = await service.modifier_domaine(session, domaine_id, data)
    if not domaine:
        raise HTTPException(404, "Domaine introuvable")
    return domaine


@routeur.delete("/domaines/{domaine_id}", status_code=204)
async def supprimer_domaine(
    domaine_id: UUID,
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Supprime un domaine."""
    if utilisateur.role != "super_administrateur":
        raise HTTPException(403, "Accès réservé au super administrateur")
    success = await service.supprimer_domaine(session, domaine_id)
    if not success:
        raise HTTPException(404, "Domaine introuvable")


# ============ DEPARTEMENTS ============

@routeur.get("/departements", response_model=ListeDepartements)
async def lister_departements(
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Liste tous les départements."""
    if utilisateur.role != "super_administrateur":
        raise HTTPException(403, "Accès réservé au super administrateur")
    departements = await service.lister_departements(session)
    # Ajouter domaine_nom à la réponse
    result = []
    for d in departements:
        dep_dict = DepartementResponse.model_validate(d)
        dep_dict.domaine_nom = d.domaine.nom if d.domaine else None
        result.append(dep_dict)
    return ListeDepartements(departements=result, total=len(result))


@routeur.post("/departements", response_model=DepartementResponse, status_code=201)
async def creer_departement(
    data: DepartementCreate,
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Crée un nouveau département."""
    if utilisateur.role != "super_administrateur":
        raise HTTPException(403, "Accès réservé au super administrateur")
    departement = await service.creer_departement(session, data)
    response = DepartementResponse.model_validate(departement)
    response.domaine_nom = departement.domaine.nom if departement.domaine else None
    return response


@routeur.patch("/departements/{departement_id}", response_model=DepartementResponse)
async def modifier_departement(
    departement_id: UUID,
    data: DepartementUpdate,
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Modifie un département."""
    if utilisateur.role != "super_administrateur":
        raise HTTPException(403, "Accès réservé au super administrateur")
    departement = await service.modifier_departement(session, departement_id, data)
    if not departement:
        raise HTTPException(404, "Département introuvable")
    response = DepartementResponse.model_validate(departement)
    response.domaine_nom = departement.domaine.nom if departement.domaine else None
    return response


@routeur.delete("/departements/{departement_id}", status_code=204)
async def supprimer_departement(
    departement_id: UUID,
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Supprime un département."""
    if utilisateur.role != "super_administrateur":
        raise HTTPException(403, "Accès réservé au super administrateur")
    success = await service.supprimer_departement(session, departement_id)
    if not success:
        raise HTTPException(404, "Département introuvable")


# ============ INVITATIONS ============

@routeur.get("/invitations", response_model=ListeInvitations)
async def lister_invitations(
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Liste toutes les invitations."""
    if utilisateur.role != "super_administrateur":
        raise HTTPException(403, "Accès réservé au super administrateur")
    invitations = await service.lister_invitations(session)
    return ListeInvitations(invitations=invitations, total=len(invitations))


@routeur.post("/invitations", response_model=InvitationResponse, status_code=201)
async def creer_invitation(
    data: InvitationCreate,
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Crée une nouvelle invitation."""
    if utilisateur.role != "super_administrateur":
        raise HTTPException(403, "Accès réservé au super administrateur")
    return await service.creer_invitation(session, data, utilisateur.id)


@routeur.delete("/invitations/{invitation_id}", status_code=204)
async def annuler_invitation(
    invitation_id: UUID,
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Annule une invitation."""
    if utilisateur.role != "super_administrateur":
        raise HTTPException(403, "Accès réservé au super administrateur")
    success = await service.annuler_invitation(session, invitation_id)
    if not success:
        raise HTTPException(404, "Invitation introuvable")


@routeur.post("/invitations/{invitation_id}/renvoyer", response_model=InvitationResponse)
async def renvoyer_invitation(
    invitation_id: UUID,
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Renvoie une invitation."""
    if utilisateur.role != "super_administrateur":
        raise HTTPException(403, "Accès réservé au super administrateur")
    invitation = await service.renvoyer_invitation(session, invitation_id)
    if not invitation:
        raise HTTPException(404, "Invitation introuvable")
    return invitation


# ============ EQUIPES ============

@routeur.get("/equipes", response_model=ListeEquipes)
async def lister_equipes(
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Liste toutes les équipes."""
    if utilisateur.role != "super_administrateur":
        raise HTTPException(403, "Accès réservé au super administrateur")
    equipes = await service.lister_equipes(session)
    result = []
    for e in equipes:
        eq_dict = EquipeResponse.model_validate(e)
        eq_dict.departement_nom = e.departement.nom if e.departement else None
        result.append(eq_dict)
    return ListeEquipes(equipes=result, total=len(result))


@routeur.post("/equipes", response_model=EquipeResponse, status_code=201)
async def creer_equipe(
    data: EquipeCreate,
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Crée une nouvelle équipe."""
    if utilisateur.role != "super_administrateur":
        raise HTTPException(403, "Accès réservé au super administrateur")
    equipe = await service.creer_equipe(session, data)
    response = EquipeResponse.model_validate(equipe)
    response.departement_nom = equipe.departement.nom if equipe.departement else None
    return response


@routeur.patch("/equipes/{equipe_id}", response_model=EquipeResponse)
async def modifier_equipe(
    equipe_id: UUID,
    data: EquipeUpdate,
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Modifie une équipe."""
    if utilisateur.role != "super_administrateur":
        raise HTTPException(403, "Accès réservé au super administrateur")
    equipe = await service.modifier_equipe(session, equipe_id, data)
    if not equipe:
        raise HTTPException(404, "Équipe introuvable")
    response = EquipeResponse.model_validate(equipe)
    response.departement_nom = equipe.departement.nom if equipe.departement else None
    return response


@routeur.delete("/equipes/{equipe_id}", status_code=204)
async def supprimer_equipe(
    equipe_id: UUID,
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Supprime une équipe."""
    if utilisateur.role != "super_administrateur":
        raise HTTPException(403, "Accès réservé au super administrateur")
    success = await service.supprimer_equipe(session, equipe_id)
    if not success:
        raise HTTPException(404, "Équipe introuvable")