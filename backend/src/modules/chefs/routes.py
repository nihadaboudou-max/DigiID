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
from sqlalchemy import func
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
from src.modules.ong.schemas import (
    ProgrammeCreate,
    ProgrammeResponse,
    MissionCreate,  
    MissionResponse,    
)

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
    """Liste TOUS les agents ONG du domaine du chef."""
    chef = await verifier_est_chef(chef)

    if chef.role != "chef_ong":
        raise HTTPException(status_code=403, detail="Seul un chef ONG peut accéder à cette ressource")

    # ✅ CORRECTION : Récupérer TOUS les agents du domaine
    from sqlalchemy import select
    from src.modeles import Utilisateur
    
    # Compter le total d'abord
    stmt_count = select(func.count(Utilisateur.id)).where(
        Utilisateur.role.in_(["agent_ong", "ong"]),
        Utilisateur.domaine_id == chef.domaine_id,
        Utilisateur.est_actif == True,
    )
    result_count = await session.execute(stmt_count)
    total = result_count.scalar() or 0

    # Récupérer les agents avec pagination
    stmt = select(Utilisateur).where(
        Utilisateur.role.in_(["agent_ong", "ong"]),
        Utilisateur.domaine_id == chef.domaine_id,
        Utilisateur.est_actif == True,
    ).offset((page - 1) * par_page).limit(par_page)
    
    result = await session.execute(stmt)
    agents = result.scalars().all()

    agents_response = [_dechiffrer_agent(agent) for agent in agents]

    return ListeAgentsResponse(
        agents=agents_response,
        total=total,
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
# Dans backend/src/modules/chefs/routes.py

@routeur_chefs.get("/statistiques")
async def obtenir_statistiques_chef(
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Statistiques complètes pour le dashboard Chef."""
    from sqlalchemy import select, func
    from src.modeles import Utilisateur
    from src.noyau import dechiffrer_donnee
    from datetime import datetime
    
    # Rôles à compter (adapte selon tes besoins)
    roles_agents = ["agent_ong", "ong"]
    
    # Total des agents du domaine
    stmt_total = select(func.count(Utilisateur.id)).where(
        Utilisateur.domaine_id == chef.domaine_id,
        Utilisateur.role.in_(roles_agents),
    )
    total_agents = (await session.execute(stmt_total)).scalar() or 0
    
    # Agents actifs
    stmt_actifs = select(func.count(Utilisateur.id)).where(
        Utilisateur.domaine_id == chef.domaine_id,
        Utilisateur.role.in_(roles_agents),
        Utilisateur.est_actif == True,
    )
    agents_actifs = (await session.execute(stmt_actifs)).scalar() or 0
    
    # Agents inactifs
    agents_inactifs = total_agents - agents_actifs
    
    # Agents créés aujourd'hui
    aujourdhui = datetime.utcnow().date()
    stmt_aujourdhui = select(func.count(Utilisateur.id)).where(
        Utilisateur.domaine_id == chef.domaine_id,
        Utilisateur.role.in_(roles_agents),
        func.date(Utilisateur.cree_le) == aujourdhui,
    )
    agents_crees_aujourdhui = (await session.execute(stmt_aujourdhui)).scalar() or 0
    
    return {
        "total_agents": total_agents,
        "agents_actifs": agents_actifs,
        "agents_inactifs": agents_inactifs,
        "agents_crees_aujourdhui": agents_crees_aujourdhui,
        "dernier_agent_cree": None,  # À implémenter si besoin
    }


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
# PROGRAMMES (pour Chef ONG)
# =============================================================================

@routeur_chefs.get(
    "/ong/programmes",
    response_model=list[ProgrammeResponse],
)
async def lister_programmes_ong(
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Liste les programmes de l'ONG du chef."""
    chef = await verifier_est_chef(chef)
    if chef.role != "chef_ong":
        raise HTTPException(status_code=403, detail="Réservé aux chefs ONG")
    
    from src.modules.ong.service import obtenir_programmes
    programmes = await obtenir_programmes(session, chef)
    
    return [
        ProgrammeResponse(
            id=p.id, ong_id=p.ong_id, nom=p.nom, description=p.description,
            zone=p.zone, budget=p.budget, date_debut=p.date_debut,
            date_fin=p.date_fin, statut=p.statut,
            domaine_id=p.domaine_id, departement_id=p.departement_id,
        )
        for p in programmes
    ]


@routeur_chefs.post(
    "/ong/programmes",
    response_model=ProgrammeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def creer_programme_ong(
    data: ProgrammeCreate,
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Crée un programme pour l'ONG du chef."""
    chef = await verifier_est_chef(chef)
    if chef.role != "chef_ong":
        raise HTTPException(status_code=403, detail="Réservé aux chefs ONG")
    
    from src.modules.ong.service import creer_programme
    from src.noyau.journal import enregistrer_evenement_audit
    
    p = await creer_programme(session, chef, data.model_dump())
    
    await enregistrer_evenement_audit(
        session=session,
        type_evenement="chef_programme_creation",
        description=f"Programme {data.nom} créé par chef {chef.id}",
        utilisateur_id=chef.id,
        role_acteur=chef.role,
    )
    
    return ProgrammeResponse(
        id=p.id, ong_id=p.ong_id, nom=p.nom, description=p.description,
        zone=p.zone, budget=p.budget, date_debut=p.date_debut,
        date_fin=p.date_fin, statut=p.statut,
        domaine_id=p.domaine_id, departement_id=p.departement_id,
    )

# =============================================================================
# PROGRAMMES - Mise à jour et suppression (pour Chef ONG)
# =============================================================================

@routeur_chefs.patch(
    "/ong/programmes/{programme_id}",
    response_model=ProgrammeResponse,
)
async def mettre_a_jour_programme_ong(
    programme_id: UUID,
    data: ProgrammeCreate,
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Met à jour un programme pour l'ONG du chef."""
    chef = await verifier_est_chef(chef)
    if chef.role != "chef_ong":
        raise HTTPException(status_code=403, detail="Réservé aux chefs ONG")

    from src.modules.ong.service import mettre_a_jour_programme
    from src.noyau.journal import enregistrer_evenement_audit

    try:
        p = await mettre_a_jour_programme(session, programme_id, chef, data.model_dump())
        
        await enregistrer_evenement_audit(
            session=session,
            type_evenement="chef_programme_modification",
            description=f"Programme {data.nom} modifié par chef {chef.id}",
            utilisateur_id=chef.id,
            role_acteur=chef.role,
        )
        
        return ProgrammeResponse(
            id=p.id, ong_id=p.ong_id, nom=p.nom, description=p.description,
            zone=p.zone, budget=p.budget, date_debut=p.date_debut,
            date_fin=p.date_fin, statut=p.statut,
            domaine_id=p.domaine_id, departement_id=p.departement_id,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@routeur_chefs.delete(
    "/ong/programmes/{programme_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def supprimer_programme_ong(
    programme_id: UUID,
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Supprime un programme de l'ONG du chef."""
    chef = await verifier_est_chef(chef)
    if chef.role != "chef_ong":
        raise HTTPException(status_code=403, detail="Réservé aux chefs ONG")

    from src.modules.ong.service import supprimer_programme
    from src.noyau.journal import enregistrer_evenement_audit

    try:
        await supprimer_programme(session, programme_id, chef)
        
        await enregistrer_evenement_audit(
            session=session,
            type_evenement="chef_programme_suppression",
            description=f"Programme {programme_id} supprimé par chef {chef.id}",
            utilisateur_id=chef.id,
            role_acteur=chef.role,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# =============================================================================
# MISSIONS (pour Chef ONG)
# =============================================================================

@routeur_chefs.get(
    "/ong/missions",
    response_model=list,
)
async def lister_missions_ong(
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Liste les missions de l'ONG du chef."""
    chef = await verifier_est_chef(chef)
    if chef.role != "chef_ong":
        raise HTTPException(status_code=403, detail="Réservé aux chefs ONG")
    
    from src.modules.ong.service import obtenir_missions
    from src.modules.ong.schemas import MissionResponse
    
    missions = await obtenir_missions(session, chef)
    
    return [
        MissionResponse(
            id=m.id, ong_id=m.ong_id, programme_id=m.programme_id,
            titre=m.titre, zone=m.zone, date_depart=m.date_depart,
            date_retour=m.date_retour, objectifs=m.objectifs, statut=m.statut,
            domaine_id=m.domaine_id, departement_id=m.departement_id,
        )
        for m in missions
    ]


@routeur_chefs.post(
    "/ong/missions",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
)
async def creer_mission_ong(
    data: dict,
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Crée une mission pour l'ONG du chef."""
    chef = await verifier_est_chef(chef)
    if chef.role != "chef_ong":
        raise HTTPException(status_code=403, detail="Réservé aux chefs ONG")
    
    from src.modules.ong.service import creer_mission
    from src.modules.ong.schemas import MissionCreate
    from src.noyau.journal import enregistrer_evenement_audit
    
    try:
        mission_data = MissionCreate(**data)
        m = await creer_mission(session, chef, mission_data.model_dump())
        
        await enregistrer_evenement_audit(
            session=session,
            type_evenement="chef_mission_creation",
            description=f"Mission {data.get('titre')} créée par chef {chef.id}",
            utilisateur_id=chef.id,
            role_acteur=chef.role,
        )
        
        return {
            "id": str(m.id),
            "ong_id": str(m.ong_id),
            "programme_id": str(m.programme_id) if m.programme_id else None,
            "titre": m.titre,
            "zone": m.zone,
            "date_depart": m.date_depart.isoformat(),
            "date_retour": m.date_retour.isoformat() if m.date_retour else None,
            "objectifs": m.objectifs,
            "statut": m.statut,
            "domaine_id": str(m.domaine_id) if m.domaine_id else None,
            "departement_id": str(m.departement_id) if m.departement_id else None,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# =============================================================================
# MISSIONS - Modification et suppression (pour Chef ONG)
# =============================================================================

@routeur_chefs.patch(
    "/ong/missions/{mission_id}",
    response_model=dict,
)
async def mettre_a_jour_mission_ong(
    mission_id: UUID,
    data: dict,
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Met à jour une mission."""
    chef = await verifier_est_chef(chef)
    if chef.role != "chef_ong":
        raise HTTPException(status_code=403, detail="Réservé aux chefs ONG")

    from src.modules.ong.service import mettre_a_jour_mission
    
    try:
        mission = await mettre_a_jour_mission(session, mission_id, chef, data)
        
        return {
            "id": str(mission.id),
            "titre": mission.titre,
            "statut": mission.statut,
            "date_depart": mission.date_depart.isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@routeur_chefs.delete(
    "/ong/missions/{mission_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def supprimer_mission_ong(
    mission_id: UUID,
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Supprime une mission."""
    chef = await verifier_est_chef(chef)
    if chef.role != "chef_ong":
        raise HTTPException(status_code=403, detail="Réservé aux chefs ONG")

    from src.modules.ong.service import supprimer_mission
    
    try:
        await supprimer_mission(session, mission_id, chef)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@routeur_chefs.post(
    "/ong/missions/{mission_id}/assigner-agents",
    response_model=list,
)
async def assigner_agents_mission_ong(
    mission_id: UUID,
    data: dict,
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Assigne des agents à une mission."""
    chef = await verifier_est_chef(chef)
    if chef.role != "chef_ong":
        raise HTTPException(status_code=403, detail="Réservé aux chefs ONG")

    from src.modules.ong.service import assigner_agents_a_mission
    
    agent_ids = data.get("agent_ids", [])
    instructions = data.get("instructions")
    
    try:
        assignations = await assigner_agents_a_mission(
            session, mission_id, chef, agent_ids, instructions
        )
        return [{"agent_id": str(a.agent_id), "mission_id": str(a.mission_id)} for a in assignations]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@routeur_chefs.get(
    "/ong/missions/{mission_id}/agents",
    response_model=list,
)
async def obtenir_agents_mission_ong(
    mission_id: UUID,
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Récupère les agents assignés à une mission."""
    chef = await verifier_est_chef(chef)
    if chef.role != "chef_ong":
        raise HTTPException(status_code=403, detail="Réservé aux chefs ONG")

    from src.modules.ong.service import obtenir_agents_mission
    
    try:
        return await obtenir_agents_mission(session, mission_id, chef)
    except Exception as e:
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
    
# =============================================================================
# RAPPORTS (pour Chefs)
# =============================================================================

@routeur_chefs.get(
    "/{type_chef}/rapports",
    response_model=dict,
)
async def lister_rapports_chef(
    type_chef: str,
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    page: int = Query(1, ge=1),
    par_page: int = Query(20, ge=1, le=100),
    type_rapport: str | None = None,
    statut: str | None = None,
):
    """Liste les rapports du chef."""
    chef = await verifier_est_chef(chef)
    
    # Mapping des types
    mapping_roles = {
        "ong": "chef_ong",
        "police": "chef_police",
        "medical": "chef_medical",
        "enrolement": "chef_enrolement",
    }
    
    role_attendu = mapping_roles.get(type_chef)
    if not role_attendu:
        raise HTTPException(status_code=400, detail=f"Type de chef invalide: {type_chef}")
    
    if chef.role != role_attendu:
        raise HTTPException(status_code=403, detail=f"Réservé aux chefs {type_chef}")
    
    # Construire la requête
    from sqlalchemy import select, func
    from src.modeles import Rapport
    
    conditions = [
        Rapport.cree_par == chef.id,
    ]
    
    if type_rapport and type_rapport != "tous":
        conditions.append(Rapport.type_rapport == type_rapport)
    
    if statut and statut != "tous":
        conditions.append(Rapport.statut == statut)
    
    # Compter le total
    stmt_count = select(func.count(Rapport.id)).where(*conditions)
    result_count = await session.execute(stmt_count)
    total = result_count.scalar() or 0
    
    # Récupérer les rapports
    stmt = select(Rapport).where(*conditions).order_by(Rapport.date_creation.desc())
    stmt = stmt.offset((page - 1) * par_page).limit(par_page)
    
    result = await session.execute(stmt)
    rapports = result.scalars().all()
    
    # Charger les relations mission et programme si nécessaire
    rapports_data = []
    for rapport in rapports:
        rapport_dict = {
            "id": str(rapport.id),
            "titre": rapport.titre,
            "type": rapport.type_rapport,
            "description": rapport.description,
            "date_creation": rapport.date_creation.isoformat(),
            "statut": rapport.statut,
            "auteur": f"{rapport.cree_par_nom} {rapport.cree_par_prenom}" if hasattr(rapport, 'cree_par_nom') else "Chef",
            "mission_id": str(rapport.mission_id) if rapport.mission_id else None,
            "mission_titre": None,
            "programme_id": str(rapport.programme_id) if rapport.programme_id else None,
            "programme_nom": None,
            "periode_debut": rapport.periode_debut.isoformat() if rapport.periode_debut else None,
            "periode_fin": rapport.periode_fin.isoformat() if rapport.periode_fin else None,
        }
        
        # Charger mission si existe
        if rapport.mission_id:
            from src.modeles.ong import MissionTerrain
            stmt_mission = select(MissionTerrain).where(MissionTerrain.id == rapport.mission_id)
            result_mission = await session.execute(stmt_mission)
            mission = result_mission.scalar_one_or_none()
            if mission:
                rapport_dict["mission_titre"] = mission.titre
        
        # Charger programme si existe
        if rapport.programme_id:
            from src.modeles.ong import ProgrammeONG
            stmt_programme = select(ProgrammeONG).where(ProgrammeONG.id == rapport.programme_id)
            result_programme = await session.execute(stmt_programme)
            programme = result_programme.scalar_one_or_none()
            if programme:
                rapport_dict["programme_nom"] = programme.nom
        
        rapports_data.append(rapport_dict)
    
    return {
        "rapports": rapports_data,
        "total": total,
        "page": page,
        "par_page": par_page,
    }


@routeur_chefs.post(
    "/{type_chef}/rapports",
    status_code=status.HTTP_201_CREATED,
)
async def creer_rapport_chef(
    type_chef: str,
    data: dict,
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Crée un rapport."""
    chef = await verifier_est_chef(chef)
    
    from src.modeles import Rapport
    from datetime import datetime
    
    # Validation selon le type
    type_rapport = data.get("type")
    
    if type_rapport == "mission" and not data.get("mission_id"):
        raise HTTPException(status_code=400, detail="Mission requise pour ce type de rapport")
    
    if type_rapport == "programme" and not data.get("programme_id"):
        raise HTTPException(status_code=400, detail="Programme requis pour ce type de rapport")
    
    if type_rapport in ["hebdomadaire", "mensuel", "trimestriel"]:
        if not data.get("periode_debut") or not data.get("periode_fin"):
            raise HTTPException(status_code=400, detail="Période requise pour ce type de rapport")
    
    rapport = Rapport(
        titre=data["titre"],
        type_rapport=type_rapport,
        description=data.get("description"),
        statut="brouillon",
        cree_par=chef.id,
        mission_id=data.get("mission_id") if data.get("mission_id") else None,
        programme_id=data.get("programme_id") if data.get("programme_id") else None,
        periode_debut=datetime.fromisoformat(data["periode_debut"]) if data.get("periode_debut") else None,
        periode_fin=datetime.fromisoformat(data["periode_fin"]) if data.get("periode_fin") else None,
    )
    
    session.add(rapport)
    await session.commit()
    await session.refresh(rapport)
    
    return {
        "id": str(rapport.id),
        "titre": rapport.titre,
        "type": rapport.type_rapport,
        "statut": rapport.statut,
    }


@routeur_chefs.patch(
    "/{type_chef}/rapports/{rapport_id}/valider",
)
async def valider_rapport_chef(
    type_chef: str,
    rapport_id: str,
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Valide un rapport."""
    chef = await verifier_est_chef(chef)
    
    from sqlalchemy import select
    from src.modeles import Rapport
    from uuid import UUID
    
    stmt = select(Rapport).where(
        Rapport.id == UUID(rapport_id),
        Rapport.cree_par == chef.id,
    )
    result = await session.execute(stmt)
    rapport = result.scalar_one_or_none()
    
    if not rapport:
        raise HTTPException(status_code=404, detail="Rapport introuvable")
    
    rapport.statut = "valide"
    await session.commit()
    
    return {"message": "Rapport validé"}


@routeur_chefs.patch(
    "/{type_chef}/rapports/{rapport_id}/archiver",
)
async def archiver_rapport_chef(
    type_chef: str,
    rapport_id: str,
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Archive un rapport."""
    chef = await verifier_est_chef(chef)
    
    from sqlalchemy import select
    from src.modeles import Rapport
    from uuid import UUID
    
    stmt = select(Rapport).where(
        Rapport.id == UUID(rapport_id),
        Rapport.cree_par == chef.id,
    )
    result = await session.execute(stmt)
    rapport = result.scalar_one_or_none()
    
    if not rapport:
        raise HTTPException(status_code=404, detail="Rapport introuvable")
    
    rapport.statut = "archive"
    await session.commit()
    
    return {"message": "Rapport archivé"}


@routeur_chefs.delete(
    "/{type_chef}/rapports/{rapport_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def supprimer_rapport_chef(
    type_chef: str,
    rapport_id: str,
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Supprime un rapport."""
    chef = await verifier_est_chef(chef)
    
    from sqlalchemy import select
    from src.modeles import Rapport
    from uuid import UUID
    
    stmt = select(Rapport).where(
        Rapport.id == UUID(rapport_id),
        Rapport.cree_par == chef.id,
    )
    result = await session.execute(stmt)
    rapport = result.scalar_one_or_none()
    
    if not rapport:
        raise HTTPException(status_code=404, detail="Rapport introuvable")
    
    await session.delete(rapport)
    await session.commit()
    

@routeur_chefs.get(
    "/audit",
)
async def obtenir_audit_equipe(
    chef: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    date_debut: str | None = Query(None),
    date_fin: str | None = Query(None),
    agent_id: str | None = Query(None),
    type_action: str | None = Query(None),
    page: int = Query(1, ge=1),
    par_page: int = Query(50, ge=1, le=200),
):
    """
    Obtient le journal d'audit de tous les agents sous la supervision du chef.
    """
    chef = await verifier_est_chef(chef)
    
    dt_debut = datetime.fromisoformat(date_debut) if date_debut else None
    dt_fin = datetime.fromisoformat(date_fin) if date_fin else None
    uuid_agent = UUID(agent_id) if agent_id else None

    logs, total = await service.obtenir_audit_chef(
        session=session,
        chef=chef,
        date_debut=dt_debut,
        date_fin=dt_fin,
        agent_id=uuid_agent,
        type_action=type_action,
        page=page,
        par_page=par_page,
    )

    return {
        "logs": logs,
        "total": total,
        "page": page,
        "par_page": par_page,
    }