# -*- coding: utf-8 -*-
"""
Routes API pour le module Chefs.
Permet aux chefs de créer et gérer leurs agents, envoyer des invitations,
gérer les missions et les rapports.
"""
from datetime import datetime, timezone
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
from src.noyau import dechiffrer_donnee

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


def _dechiffrer_agent(agent: Utilisateur) -> AgentResponse:
    """Convertit un objet Utilisateur en AgentResponse avec déchiffrement."""
    return AgentResponse(
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
        ville=agent.ville,
    )


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
    """Crée un agent police. Réservé aux chefs police."""
    chef = await verifier_est_chef(chef)
    
    try:
        agent = await service.creer_agent_police(session, chef, data.model_dump())
        return _dechiffrer_agent(agent)
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
    """Crée un médecin. Réservé aux chefs médicaux."""
    chef = await verifier_est_chef(chef)
    
    try:
        agent = await service.creer_medecin(session, chef, data.model_dump())
        return _dechiffrer_agent(agent)
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
    """Crée un agent ONG. Réservé aux chefs ONG."""
    chef = await verifier_est_chef(chef)
    
    try:
        agent = await service.creer_agent_ong(session, chef, data.model_dump())
        return _dechiffrer_agent(agent)
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
    """Crée un agent enrôlement. Réservé aux chefs enrôlement."""
    chef = await verifier_est_chef(chef)
    
    try:
        agent = await service.creer_agent_enrolement(session, chef, data.model_dump())
        return _dechiffrer_agent(agent)
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
    par_page: int = Query(20, ge=1, le=1000),
):
    """Liste les agents créés par le chef."""
    chef = await verifier_est_chef(chef)
    
    agents, total = await service.lister_agents_chef(session, chef, page, par_page)
    
    agents_response = [_dechiffrer_agent(agent) for agent in agents]
    
    return ListeAgentsResponse(
        agents=agents_response,
        total=total,
        page=page,
        par_page=par_page,
    )


@routeur_chefs.get(
    "/ong/agents",
    response_model=ListeAgentsResponse,
)
async def lister_agents_ong(
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    page: int = Query(1, ge=1),
    par_page: int = Query(20, ge=1, le=1000),
):
    """Liste les agents ONG créés par le chef ONG."""
    chef = await verifier_est_chef(chef)
    
    if chef.role != "chef_ong":
        raise HTTPException(status_code=403, detail="Seul un chef ONG peut accéder à cette ressource")
    
    # ✅ CORRECTION : Pas de type_agent, on filtre après récupération
    agents, total = await service.lister_agents_chef(session, chef, page, par_page)
    
    # Filtrer pour ne garder que les agents ONG
    agents = [a for a in agents if a.role in ("agent_ong", "ong")]
    
    agents_response = [_dechiffrer_agent(agent) for agent in agents]
    
    return ListeAgentsResponse(
        agents=agents_response,
        total=len(agents_response),
        page=page,
        par_page=par_page,
    )


@routeur_chefs.get(
    "/police/agents",
    response_model=ListeAgentsResponse,
)
async def lister_agents_police(
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    page: int = Query(1, ge=1),
    par_page: int = Query(20, ge=1, le=1000),
):
    """Liste les agents police créés par le chef police."""
    chef = await verifier_est_chef(chef)
    
    if chef.role != "chef_police":
        raise HTTPException(status_code=403, detail="Seul un chef police peut accéder à cette ressource")
    
    # ✅ CORRECTION : Pas de type_agent, on filtre après récupération
    agents, total = await service.lister_agents_chef(session, chef, page, par_page)
    
    # Filtrer pour ne garder que les agents police
    agents = [a for a in agents if a.role in ("agent_police", "police")]
    
    agents_response = [_dechiffrer_agent(agent) for agent in agents]
    
    return ListeAgentsResponse(
        agents=agents_response,
        total=len(agents_response),
        page=page,
        par_page=par_page,
    )


@routeur_chefs.get(
    "/medical/medecins",
    response_model=ListeAgentsResponse,
)
async def lister_medecins(
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    page: int = Query(1, ge=1),
    par_page: int = Query(20, ge=1, le=1000),
):
    """Liste les médecins créés par le chef médical."""
    chef = await verifier_est_chef(chef)
    
    if chef.role != "chef_medical":
        raise HTTPException(status_code=403, detail="Seul un chef médical peut accéder à cette ressource")
    
    # ✅ CORRECTION : Pas de type_agent, on filtre après récupération
    agents, total = await service.lister_agents_chef(session, chef, page, par_page)
    
    # Filtrer pour ne garder que les médecins
    agents = [a for a in agents if a.role in ("agent_medical", "medecin")]
    
    agents_response = [_dechiffrer_agent(agent) for agent in agents]
    
    return ListeAgentsResponse(
        agents=agents_response,
        total=len(agents_response),
        page=page,
        par_page=par_page,
    )


@routeur_chefs.get(
    "/enrolement/agents",
    response_model=ListeAgentsResponse,
)
async def lister_agents_enrolement(
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    page: int = Query(1, ge=1),
    par_page: int = Query(20, ge=1, le=1000),
):
    """Liste les agents enrôlement créés par le chef enrôlement."""
    chef = await verifier_est_chef(chef)
    
    if chef.role != "chef_agent":
        raise HTTPException(status_code=403, detail="Seul un chef enrôlement peut accéder à cette ressource")
    
    # ✅ CORRECTION : Pas de type_agent, on filtre après récupération
    agents, total = await service.lister_agents_chef(session, chef, page, par_page)
    
    # Filtrer pour ne garder que les agents d'enrôlement
    agents = [a for a in agents if a.role in ("agent_terrain", "agent")]
    
    agents_response = [_dechiffrer_agent(agent) for agent in agents]
    
    return ListeAgentsResponse(
        agents=agents_response,
        total=len(agents_response),
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
        dernier_agent_response = _dechiffrer_agent(stats["dernier_agent_cree"])
    
    return StatistiquesChefResponse(
        total_agents=stats["total_agents"],
        agents_actifs=stats["agents_actifs"],
        agents_inactifs=stats["agents_inactifs"],
        agents_crees_aujourdhui=stats["agents_crees_aujourdhui"],
        agents_crees_ce_mois=stats["agents_crees_ce_mois"],
        dernier_agent_cree=dernier_agent_response,
    )


# =============================================================================
# Gestion des agents (suspendre, réactiver, supprimer)
# =============================================================================

@routeur_chefs.patch(
    "/agents/{agent_id}/suspendre",
    response_model=AgentResponse,
)
async def suspendre_agent(
    agent_id: UUID,
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Suspend un agent de l'équipe."""
    chef = await verifier_est_chef(chef)
    
    try:
        agent = await service.suspendre_agent(session, chef, agent_id)
        return _dechiffrer_agent(agent)
    except ErreurAutorisation as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ErreurValidation as e:
        raise HTTPException(status_code=400, detail=str(e))


@routeur_chefs.patch(
    "/agents/{agent_id}/reactiver",
    response_model=AgentResponse,
)
async def reactiver_agent(
    agent_id: UUID,
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Réactive un agent suspendu."""
    chef = await verifier_est_chef(chef)
    
    try:
        agent = await service.reactiver_agent(session, chef, agent_id)
        return _dechiffrer_agent(agent)
    except ErreurAutorisation as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ErreurValidation as e:
        raise HTTPException(status_code=400, detail=str(e))


@routeur_chefs.delete(
    "/agents/{agent_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def supprimer_agent(
    agent_id: UUID,
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Supprime un agent de l'équipe (soft delete)."""
    chef = await verifier_est_chef(chef)
    
    try:
        await service.supprimer_agent(session, chef, agent_id)
    except ErreurAutorisation as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ErreurValidation as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# Invitations
# =============================================================================

@routeur_chefs.post(
    "/{type_chef}/invitations",
    status_code=status.HTTP_201_CREATED,
)
async def creer_invitation_chef(
    type_chef: str,
    data: dict,
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """
    Crée une invitation pour un futur agent.
    type_chef: "ong", "police", "medical", "enrolement"
    """
    chef = await verifier_est_chef(chef)
    
    # Mapping des types de chefs vers les rôles
    mapping_roles = {
        "ong": "agent_ong",
        "police": "agent_police",
        "medical": "agent_medical",
        "enrolement": "agent_terrain",
    }
    
    role = mapping_roles.get(type_chef)
    if not role:
        raise HTTPException(status_code=400, detail=f"Type de chef invalide: {type_chef}")
    
    # Vérifier que le chef a le bon rôle
    if chef.role != f"chef_{type_chef}":
        raise HTTPException(
            status_code=403,
            detail=f"Seuls les chefs {type_chef} peuvent créer des invitations pour ce type."
        )
    
    try:
        # Utiliser le service d'invitation existant
        from src.modules.invitations.service import creer_invitation
        from src.modules.invitations.schemas import InvitationCreate
        
        invitation_data = InvitationCreate(
            email=data["email"],
            role=role,
            domaine_id=chef.domaine_id,
            departement_id=chef.departement_id,
            message=data.get("message"),
            duree_jours=7,
        )
        
        invitation = await creer_invitation(session, invitation_data, chef.id)
        
        # Envoyer l'email d'invitation
        from src.noyau.notification import envoyer_email_invitation
        
        nom_invitant = f"{dechiffrer_donnee(chef.prenom_chiffre) if chef.prenom_chiffre else ''} {dechiffrer_donnee(chef.nom_chiffre) if chef.nom_chiffre else ''}".strip()
        
        envoyer_email_invitation(
            destinataire=invitation.email,
            role=invitation.role,
            token=invitation.token,
            nom_invitant=nom_invitant,
            nom_domaine=None,
            message_personnalise=data.get("message"),
        )
        
        return {
            "id": str(invitation.id),
            "email": invitation.email,
            "role": invitation.role,
            "statut": invitation.statut,
            "date_creation": invitation.date_creation.isoformat(),
            "date_expiration": invitation.date_expiration.isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@routeur_chefs.get(
    "/invitations",
)
async def lister_invitations_chef(
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    page: int = Query(1, ge=1),
    par_page: int = Query(20, ge=1, le=1000),
    statut: str | None = None,
):
    """Liste les invitations envoyées par le chef."""
    chef = await verifier_est_chef(chef)
    
    from src.modules.invitations.service import lister_invitations
    
    invitations, total = await lister_invitations(
        session,
        cree_par=chef.id,
        statut=statut,
        page=page,
        par_page=par_page,
    )
    
    return {
        "invitations": [
            {
                "id": str(inv.id),
                "email": inv.email,
                "role": inv.role,
                "statut": inv.statut,
                "date_creation": inv.date_creation.isoformat(),
                "date_expiration": inv.date_expiration.isoformat(),
                "date_acceptation": inv.date_acceptation.isoformat() if inv.date_acceptation else None,
            }
            for inv in invitations
        ],
        "total": total,
    }


@routeur_chefs.delete(
    "/invitations/{invitation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def annuler_invitation_chef(
    invitation_id: UUID,
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Annule une invitation en attente."""
    chef = await verifier_est_chef(chef)
    
    from src.modules.invitations.service import obtenir_invitation_par_id, annuler_invitation
    
    invitation = await obtenir_invitation_par_id(session, invitation_id)
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation introuvable")
    
    if invitation.cree_par != chef.id:
        raise HTTPException(status_code=403, detail="Vous ne pouvez annuler que vos propres invitations")
    
    await annuler_invitation(session, invitation)


@routeur_chefs.post(
    "/invitations/{invitation_id}/renvoyer",
)
async def renvoyer_invitation_chef(
    invitation_id: UUID,
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Renvoie une invitation."""
    chef = await verifier_est_chef(chef)
    
    from src.modules.invitations.service import obtenir_invitation_par_id
    import secrets
    from datetime import timedelta
    
    invitation = await obtenir_invitation_par_id(session, invitation_id)
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation introuvable")
    
    if invitation.cree_par != chef.id:
        raise HTTPException(status_code=403, detail="Vous ne pouvez renvoyer que vos propres invitations")
    
    if invitation.statut != "en_attente":
        raise HTTPException(status_code=400, detail="Seules les invitations en attente peuvent être renvoyées")
    
    # Générer un nouveau token
    invitation.token = secrets.token_urlsafe(48)
    invitation.date_expiration = datetime.now(timezone.utc) + timedelta(days=7)
    await session.commit()
    await session.refresh(invitation)
    
    # Renvoyer l'email
    from src.noyau.notification import envoyer_email_renvoyer_invitation
    
    nom_invitant = f"{dechiffrer_donnee(chef.prenom_chiffre) if chef.prenom_chiffre else ''} {dechiffrer_donnee(chef.nom_chiffre) if chef.nom_chiffre else ''}".strip()
    
    envoyer_email_renvoyer_invitation(
        destinataire=invitation.email,
        role=invitation.role,
        token=invitation.token,
        nom_invitant=nom_invitant,
    )
    
    return {
        "id": str(invitation.id),
        "email": invitation.email,
        "statut": invitation.statut,
        "date_expiration": invitation.date_expiration.isoformat(),
    }