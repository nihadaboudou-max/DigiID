# -*- coding: utf-8 -*-
"""Routes API pour le module ONG — avec cloisonnement."""
from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles.ong import MissionTerrain
from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.ong.schemas import (
    BeneficiaireCreate, BeneficiaireResponse,
    ProgrammeCreate, ProgrammeResponse,
    MissionCreate, MissionResponse,
    StatsONGResponse,
    AssignationMissionCreate, AssignationResponse,
    AgentInfo, StatsChefONG,
)
from src.noyau.journal import enregistrer_evenement_audit
from src.noyau import dechiffrer_donnee
from src.noyau.exceptions import ErreurValidation, ErreurAutorisation
from src.modules.ong import service

# Préfixe cohérent avec les autres modules
routeur_ong = APIRouter(prefix="/api/v1/ong", tags=["ONG"])


# =============================================================================
# BÉNÉFICIAIRES
# =============================================================================

@routeur_ong.get("/beneficiaires", response_model=list[BeneficiaireResponse])
async def lister_beneficiaires(
    ong: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Liste les bénéficiaires avec cloisonnement."""
    beneficiaires = await service.obtenir_beneficiaires(session, ong)
    return [
        BeneficiaireResponse(
            id=b.id, ong_id=b.ong_id, nom=b.nom, digiid=b.digiid,
            programme=b.programme, zone=b.zone,
            date_inscription=b.date_inscription, statut=b.statut, notes=b.notes,
            domaine_id=b.domaine_id, departement_id=b.departement_id,
        )
        for b in beneficiaires
    ]


@routeur_ong.post("/beneficiaires", response_model=BeneficiaireResponse, status_code=201)
async def creer_beneficiaire(
    data: BeneficiaireCreate,
    ong: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Crée un bénéficiaire avec cloisonnement automatique."""
    b = await service.creer_beneficiaire(session, ong, data.model_dump())
    await enregistrer_evenement_audit(
        session=session,
        type_evenement="ong_beneficiaire_creation",
        description=f"Bénéficiaire {data.nom} créé (programme: {data.programme})",
        utilisateur_id=ong.id,
        role_acteur=ong.role,
    )
    return BeneficiaireResponse(
        id=b.id, ong_id=b.ong_id, nom=b.nom, digiid=b.digiid,
        programme=b.programme, zone=b.zone,
        date_inscription=b.date_inscription, statut=b.statut, notes=b.notes,
        domaine_id=b.domaine_id, departement_id=b.departement_id,
    )


# =============================================================================
# PROGRAMMES
# =============================================================================

@routeur_ong.get("/programmes", response_model=list[ProgrammeResponse])
async def lister_programmes(
    ong: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Liste les programmes avec cloisonnement."""
    programmes = await service.obtenir_programmes(session, ong)
    return [
        ProgrammeResponse(
            id=p.id, ong_id=p.ong_id, nom=p.nom, description=p.description,
            zone=p.zone, budget=p.budget, date_debut=p.date_debut,
            date_fin=p.date_fin, statut=p.statut,
            domaine_id=p.domaine_id, departement_id=p.departement_id,
        )
        for p in programmes
    ]

@routeur_ong.post("/programmes", response_model=ProgrammeResponse, status_code=201)
async def creer_programme(
    data: ProgrammeCreate,
    ong: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Crée un programme avec cloisonnement automatique."""
    p = await service.creer_programme(session, ong, data.model_dump())
    await enregistrer_evenement_audit(
        session=session,
        type_evenement="ong_programme_creation",
        description=f"Programme {data.nom} créé (zone: {data.zone})",
        utilisateur_id=ong.id,
        role_acteur=ong.role,
    )
    return ProgrammeResponse(
        id=p.id, ong_id=p.ong_id, nom=p.nom, description=p.description,
        zone=p.zone, budget=p.budget, date_debut=p.date_debut,
        date_fin=p.date_fin, statut=p.statut,
        domaine_id=p.domaine_id, departement_id=p.departement_id,
    )


# =============================================================================
# MISSIONS
# =============================================================================

@routeur_ong.get("/missions", response_model=list[MissionResponse])
async def lister_missions(
    ong: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Liste les missions : toutes pour le chef, seulement assignées pour l'agent."""
    from sqlalchemy import select
    from src.modeles.ong import MissionAgent
    
    # ✅ Si c'est un agent ONG (pas chef), on filtre par assignation
    if ong.role in ("agent_ong", "ong"):
        # Récupérer les IDs des missions où l'agent est assigné
        stmt_assignations = select(MissionAgent.mission_id).where(
            MissionAgent.agent_id == ong.id,
            MissionAgent.statut != "annulee",
        )
        result_assignations = await session.execute(stmt_assignations)
        mission_ids = [row[0] for row in result_assignations.all()]
        
        if not mission_ids:
            return []
        
        # Récupérer les missions correspondantes
        stmt = select(MissionTerrain).where(
            MissionTerrain.id.in_(mission_ids)
        ).order_by(MissionTerrain.date_depart.desc())
        
        result = await session.execute(stmt)
        missions = result.scalars().all()
    else:
        # ✅ Chef ONG ou admin : toutes les missions (comportement existant)
        missions = await service.obtenir_missions(session, ong)
    
    return [
        MissionResponse(
            id=m.id, ong_id=m.ong_id, programme_id=m.programme_id,
            titre=m.titre, zone=m.zone, date_depart=m.date_depart,
            date_retour=m.date_retour, objectifs=m.objectifs, statut=m.statut,
            domaine_id=m.domaine_id, departement_id=m.departement_id,
        )
        for m in missions
    ]


# =============================================================================
# STATISTIQUES DE BASE
# =============================================================================

@routeur_ong.get("/stats", response_model=StatsONGResponse)
async def stats_ong(
    ong: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Statistiques du module ONG avec cloisonnement."""
    nb_beneficiaires = await service.compter_beneficiaires(session, ong)
    programmes = await service.obtenir_programmes(session, ong)
    missions = await service.obtenir_missions(session, ong)
    
    return StatsONGResponse(
        nb_beneficiaires=nb_beneficiaires,
        nb_programmes=len(programmes),
        nb_missions=len(missions),
        zones=list(set(p.zone for p in programmes if p.zone)),
    )


# =============================================================================
# AGENTS - Liste des agents de l'équipe (CHEF ONG UNIQUEMENT)
# =============================================================================

@routeur_ong.get("/agents", response_model=list[AgentInfo])
async def lister_agents(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    ong: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """Liste tous les agents de l'équipe du chef ONG."""
    if ong.role != "chef_ong":
        raise HTTPException(status_code=403, detail="Accès réservé aux chefs ONG")
    
    agents = await service.obtenir_agents_equipe(session, ong)
    
    resultats = []
    for agent in agents:
        prenom = dechiffrer_donnee(agent.prenom_chiffre) if agent.prenom_chiffre else ""
        nom = dechiffrer_donnee(agent.nom_chiffre) if agent.nom_chiffre else ""
        email = dechiffrer_donnee(agent.email_chiffre) if agent.email_chiffre else ""
        
        resultats.append(
            AgentInfo(
                id=agent.id,
                email=email,
                prenom=prenom,
                nom=nom,
                ville=agent.ville,
                est_actif=agent.est_actif,
                date_creation=agent.cree_le,
                missions_assignees=0,
                missions_terminees=0,
            )
        )
    
    return resultats


# =============================================================================
# ASSIGNATION DE MISSIONS (CHEF ONG UNIQUEMENT)
# =============================================================================

@routeur_ong.post("/missions/assigner", response_model=AssignationResponse)
async def assigner_mission(
    data: AssignationMissionCreate,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    ong: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """Assigne une mission à un agent par email ou ID (réservé au chef ONG)."""
    if ong.role != "chef_ong":
        raise HTTPException(status_code=403, detail="Accès réservé aux chefs ONG")
    
    if not data.agent_email and not data.agent_id:
        raise HTTPException(
            status_code=400,
            detail="Vous devez fournir soit agent_email, soit agent_id"
        )
    
    # Vérifier que l'agent existe
    agent = await service.verifier_agent_existe(
        session,
        agent_id=data.agent_id,
        agent_email=data.agent_email,
    )
    
    if not agent:
        raise HTTPException(
            status_code=404,
            detail=f"Agent introuvable. "
                   f"{'Email: ' + data.agent_email if data.agent_email else 'ID: ' + str(data.agent_id)}"
        )
    
    # Assigner la mission
    try:
        resultat = await service.assigner_mission_a_agent(
            session=session,
            chef=ong,
            mission_id=data.mission_id,
            agent=agent,
            instructions=data.instructions,
            date_limite=data.date_limite,
        )
        
        prenom = dechiffrer_donnee(agent.prenom_chiffre) if agent.prenom_chiffre else ""
        nom = dechiffrer_donnee(agent.nom_chiffre) if agent.nom_chiffre else ""
        email = dechiffrer_donnee(agent.email_chiffre) if agent.email_chiffre else ""
        
        return AssignationResponse(
            id=resultat["id"],
            mission_id=resultat["mission"].id,
            mission_titre=resultat["mission"].titre,
            agent_id=agent.id,
            agent_nom=f"{prenom} {nom}".strip(),
            agent_email=email,
            instructions=data.instructions,
            date_limite=data.date_limite,
            statut="assignee",
            date_assignation=resultat["date_assignation"],
            date_completion=None,
        )
        
    except ErreurValidation as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ErreurAutorisation as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@routeur_ong.get("/missions/{mission_id}/assignations", response_model=list[AssignationResponse])
async def lister_assignations_mission(
    mission_id: UUID,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    ong: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """Liste toutes les assignations d'une mission."""
    from src.modeles.ong import MissionAgent
    
    if ong.role != "chef_ong":
        raise HTTPException(status_code=403, detail="Accès réservé aux chefs ONG")
    
    assignations = await service.obtenir_assignations_mission(session, ong, mission_id)
    
    resultats = []
    for assignation, agent in assignations:
        prenom = dechiffrer_donnee(agent.prenom_chiffre) if agent.prenom_chiffre else ""
        nom = dechiffrer_donnee(agent.nom_chiffre) if agent.nom_chiffre else ""
        email = dechiffrer_donnee(agent.email_chiffre) if agent.email_chiffre else ""
        
        resultats.append(
            AssignationResponse(
                id=assignation.id,
                mission_id=assignation.mission_id,
                mission_titre="",
                agent_id=agent.id,
                agent_nom=f"{prenom} {nom}".strip(),
                agent_email=email,
                instructions=assignation.instructions,
                date_limite=assignation.date_limite,
                statut=assignation.statut,
                date_assignation=assignation.date_assignation,
                date_completion=assignation.date_completion,
            )
        )
    
    return resultats


# =============================================================================
# STATISTIQUES CHEF ONG
# =============================================================================

@routeur_ong.get("/statistiques/chef", response_model=StatsChefONG)
async def statistiques_chef_ong(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    ong: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """Obtient les statistiques complètes pour le chef ONG."""
    if ong.role != "chef_ong":
        raise HTTPException(status_code=403, detail="Accès réservé aux chefs ONG")
    
    stats = await service.obtenir_statistiques_chef_ong(session, ong)
    return StatsChefONG(**stats)