# -*- coding: utf-8 -*-
"""
Routes API pour le module Chefs.
Permet aux chefs de créer et gérer leurs agents.
"""
from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.chefs.schemas import (
    AgentPoliceCreate,
    AgentResponse,
    AgentONGCreate,
    AgentEnrolementCreate,
    ListeAgentsResponse,
    MedecinCreate,
    StatistiquesChefResponse,
)
from src.modules.chefs import service
from src.noyau.constantes_roles import ROLES_CHEF
from src.noyau.exceptions import ErreurAutorisation, ErreurValidation

routeur_chefs = APIRouter(prefix="/api/v1/chefs", tags=["Chefs"])


# =============================================================================
# Middleware de vérification
# =============================================================================

async def verifier_est_chef(utilisateur: Utilisateur):
    """Vérifie que l'utilisateur est un chef de département."""
    if utilisateur.role not in ROLES_CHEF:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les chefs de département peuvent accéder à ces endpoints."
        )
    return utilisateur


# =============================================================================
# Création d'agents
# =============================================================================

@routeur_chefs.post(
    "/police/agents",
    response_model=AgentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def creer_agent_police(
    data: AgentPoliceCreate,
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """
    Crée un agent police.
    Réservé aux chefs police.
    """
    chef = await verifier_est_chef(chef)
    
    try:
        agent = await service.creer_agent_police(session, chef, data.model_dump())
        return AgentResponse(
            id=agent.id,
            digiid_public=agent.digiid_public or "",
            email=agent.email_chiffre,  # TODO: déchiffrer
            prenom=agent.prenom_chiffre,  # TODO: déchiffrer
            nom=agent.nom_chiffre,  # TODO: déchiffrer
            role=agent.role,
            domaine_id=agent.domaine_id,
            departement_id=agent.departement_id,
            superieur_id=agent.superieur_id,
            est_actif=agent.est_actif,
            date_creation=agent.cree_le,
        )
    except ErreurAutorisation as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ErreurValidation as e:
        raise HTTPException(status_code=400, detail=str(e))


@routeur_chefs.post(
    "/medical/medecins",
    response_model=AgentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def creer_medecin(
    data: MedecinCreate,
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """
    Crée un médecin.
    Réservé aux chefs médicaux.
    """
    chef = await verifier_est_chef(chef)
    
    try:
        agent = await service.creer_medecin(session, chef, data.model_dump())
        return AgentResponse(
            id=agent.id,
            digiid_public=agent.digiid_public or "",
            email=agent.email_chiffre,
            prenom=agent.prenom_chiffre,
            nom=agent.nom_chiffre,
            role=agent.role,
            domaine_id=agent.domaine_id,
            departement_id=agent.departement_id,
            superieur_id=agent.superieur_id,
            est_actif=agent.est_actif,
            date_creation=agent.cree_le,
        )
    except ErreurAutorisation as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ErreurValidation as e:
        raise HTTPException(status_code=400, detail=str(e))


@routeur_chefs.post(
    "/ong/agents",
    response_model=AgentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def creer_agent_ong(
    data: AgentONGCreate,
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """
    Crée un agent ONG.
    Réservé aux chefs ONG.
    """
    chef = await verifier_est_chef(chef)
    
    try:
        agent = await service.creer_agent_ong(session, chef, data.model_dump())
        return AgentResponse(
            id=agent.id,
            digiid_public=agent.digiid_public or "",
            email=agent.email_chiffre,
            prenom=agent.prenom_chiffre,
            nom=agent.nom_chiffre,
            role=agent.role,
            domaine_id=agent.domaine_id,
            departement_id=agent.departement_id,
            superieur_id=agent.superieur_id,
            est_actif=agent.est_actif,
            date_creation=agent.cree_le,
        )
    except ErreurAutorisation as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ErreurValidation as e:
        raise HTTPException(status_code=400, detail=str(e))


@routeur_chefs.post(
    "/enrolement/agents",
    response_model=AgentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def creer_agent_enrolement(
    data: AgentEnrolementCreate,
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """
    Crée un agent enrôlement.
    Réservé aux chefs enrôlement.
    """
    chef = await verifier_est_chef(chef)
    
    try:
        agent = await service.creer_agent_enrolement(session, chef, data.model_dump())
        return AgentResponse(
            id=agent.id,
            digiid_public=agent.digiid_public or "",
            email=agent.email_chiffre,
            prenom=agent.prenom_chiffre,
            nom=agent.nom_chiffre,
            role=agent.role,
            domaine_id=agent.domaine_id,
            departement_id=agent.departement_id,
            superieur_id=agent.superieur_id,
            est_actif=agent.est_actif,
            date_creation=agent.cree_le,
        )
    except ErreurAutorisation as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ErreurValidation as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# Liste des agents
# =============================================================================

@routeur_chefs.get(
    "/equipe",
    response_model=ListeAgentsResponse,
)
async def lister_mon_equipe(
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    page: int = Query(1, ge=1),
    par_page: int = Query(20, ge=1, le=100),
):
    """Liste les agents créés par le chef."""
    chef = await verifier_est_chef(chef)
    
    agents, total = await service.lister_agents_chef(session, chef, page, par_page)
    
    agents_response = []
    for agent in agents:
        from src.noyau import dechiffrer_donnee
        agents_response.append(AgentResponse(
            id=agent.id,
            digiid_public=agent.digiid_public or "",
            email=dechiffrer_donnee(agent.email_chiffre) if agent.email_chiffre else "",
            prenom=dechiffrer_donnee(agent.prenom_chiffre) if agent.prenom_chiffre else "",
            nom=dechiffrer_donnee(agent.nom_chiffre) if agent.nom_chiffre else "",
            role=agent.role,
            domaine_id=agent.domaine_id,
            departement_id=agent.departement_id,
            superieur_id=agent.superieur_id,
            est_actif=agent.est_actif,
            date_creation=agent.cree_le,
        ))
    
    return ListeAgentsResponse(
        agents=agents_response,
        total=total,
        page=page,
        par_page=par_page,
    )


# =============================================================================
# Statistiques
# =============================================================================

@routeur_chefs.get(
    "/statistiques",
    response_model=StatistiquesChefResponse,
)
async def obtenir_statistiques(
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Obtient les statistiques pour le dashboard du chef."""
    chef = await verifier_est_chef(chef)
    
    stats = await service.obtenir_statistiques_chef(session, chef)
    
    dernier_agent_response = None
    if stats.get("dernier_agent_cree"):
        agent = stats["dernier_agent_cree"]
        from src.noyau import dechiffrer_donnee
        dernier_agent_response = AgentResponse(
            id=agent.id,
            digiid_public=agent.digiid_public or "",
            email=dechiffrer_donnee(agent.email_chiffre) if agent.email_chiffre else "",
            prenom=dechiffrer_donnee(agent.prenom_chiffre) if agent.prenom_chiffre else "",
            nom=dechiffrer_donnee(agent.nom_chiffre) if agent.nom_chiffre else "",
            role=agent.role,
            domaine_id=agent.domaine_id,
            departement_id=agent.departement_id,
            superieur_id=agent.superieur_id,
            est_actif=agent.est_actif,
            date_creation=agent.cree_le,
        )
    
    return StatistiquesChefResponse(
        total_agents=stats["total_agents"],
        agents_actifs=stats["agents_actifs"],
        agents_inactifs=stats["agents_inactifs"],
        agents_crees_aujourdhui=stats["agents_crees_aujourdhui"],
        agents_crees_ce_mois=stats["agents_crees_ce_mois"],
        dernier_agent_cree=dernier_agent_response,
    )