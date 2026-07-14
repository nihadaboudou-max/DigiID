# -*- coding: utf-8 -*-
"""Service métier pour le module ONG — avec cloisonnement."""
from uuid import UUID
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from src.modeles import Utilisateur
from src.modeles.ong import BeneficiaireONG, ProgrammeONG, MissionTerrain, MissionAgent
from src.noyau.exceptions import ErreurValidation, ErreurAutorisation


# ─── Fonctions utilitaires de cloisonnement ──────────────────────────

def _est_super_admin(utilisateur: Utilisateur) -> bool:
    """Vérifie si l'utilisateur est super admin."""
    return utilisateur.role in ["super_admin", "super_administrateur"]


def _appliquer_filtres_cloisonnement(
    query,
    utilisateur: Utilisateur,
    modele,
):
    """Applique les filtres de cloisonnement selon le rôle de l'utilisateur."""
    if _est_super_admin(utilisateur):
        return query  # Super admin voit tout
    
    conditions = []
    if utilisateur.domaine_id:
        conditions.append(modele.domaine_id == utilisateur.domaine_id)
    # Admin domaine voit tout son domaine
    if utilisateur.role not in ["admin_domaine"] and utilisateur.departement_id:
        conditions.append(modele.departement_id == utilisateur.departement_id)
    
    if conditions:
        query = query.where(and_(*conditions))
    
    return query


# =============================================================================
# BÉNÉFICIAIRES
# =============================================================================

async def creer_beneficiaire(
    session: AsyncSession,
    utilisateur: Utilisateur,
    data: dict,
) -> BeneficiaireONG:
    """Crée un nouveau bénéficiaire avec cloisonnement automatique."""
    beneficiaire = BeneficiaireONG(
        ong_id=utilisateur.id,
        domaine_id=utilisateur.domaine_id,
        departement_id=utilisateur.departement_id,
        **data
    )
    session.add(beneficiaire)
    await session.commit()
    await session.refresh(beneficiaire)
    return beneficiaire


async def obtenir_beneficiaires(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> list[BeneficiaireONG]:
    """Liste les bénéficiaires avec cloisonnement."""
    query = select(BeneficiaireONG).order_by(BeneficiaireONG.date_inscription.desc())
    
    # --- Cloisonnement ---
    query = _appliquer_filtres_cloisonnement(query, utilisateur, BeneficiaireONG)
    
    # Si ce n'est pas un super admin, on filtre aussi par ong_id
    if not _est_super_admin(utilisateur):
        query = query.where(BeneficiaireONG.ong_id == utilisateur.id)
    
    result = await session.execute(query)
    return list(result.scalars().all())


async def compter_beneficiaires(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> int:
    """Compte les bénéficiaires avec cloisonnement."""
    query = select(func.count(BeneficiaireONG.id))
    
    # --- Cloisonnement ---
    query = _appliquer_filtres_cloisonnement(query, utilisateur, BeneficiaireONG)
    
    if not _est_super_admin(utilisateur):
        query = query.where(BeneficiaireONG.ong_id == utilisateur.id)
    
    result = await session.execute(query)
    return result.scalar() or 0


# =============================================================================
# PROGRAMMES
# =============================================================================

async def creer_programme(
    session: AsyncSession,
    utilisateur: Utilisateur,
    data: dict,
) -> ProgrammeONG:
    """Crée un nouveau programme avec cloisonnement automatique."""
    programme = ProgrammeONG(
        ong_id=utilisateur.id,
        domaine_id=utilisateur.domaine_id,
        departement_id=utilisateur.departement_id,
        **data
    )
    session.add(programme)
    await session.commit()
    await session.refresh(programme)
    return programme


async def obtenir_programmes(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> list[ProgrammeONG]:
    """Liste les programmes avec cloisonnement."""
    query = select(ProgrammeONG).order_by(ProgrammeONG.date_debut.desc())
    
    # --- Cloisonnement ---
    query = _appliquer_filtres_cloisonnement(query, utilisateur, ProgrammeONG)
    
    if not _est_super_admin(utilisateur):
        query = query.where(ProgrammeONG.ong_id == utilisateur.id)
    
    result = await session.execute(query)
    return list(result.scalars().all())


async def obtenir_programme_par_id(
    session: AsyncSession,
    programme_id: UUID,
    utilisateur: Utilisateur,
) -> ProgrammeONG | None:
    """Récupère un programme par son ID avec vérification d'autorisation."""
    stmt = select(ProgrammeONG).where(ProgrammeONG.id == programme_id)
    result = await session.execute(stmt)
    programme = result.scalar_one_or_none()
    
    if not programme:
        return None
    
    # Vérifier que l'utilisateur a le droit de voir ce programme
    if not _est_super_admin(utilisateur):
        if programme.ong_id != utilisateur.id:
            raise ErreurAutorisation("Vous n'avez pas accès à ce programme")
        if utilisateur.domaine_id and programme.domaine_id != utilisateur.domaine_id:
            raise ErreurAutorisation("Ce programme n'appartient pas à votre domaine")
    
    return programme


async def mettre_a_jour_programme(
    session: AsyncSession,
    programme_id: UUID,
    utilisateur: Utilisateur,
    data: dict,
) -> ProgrammeONG:
    """Met à jour un programme existant avec vérification d'autorisation."""
    programme = await obtenir_programme_par_id(session, programme_id, utilisateur)
    
    if not programme:
        raise ErreurValidation(f"Programme {programme_id} introuvable")
    
    # Mise à jour des champs autorisés
    champs_autorises = ["nom", "description", "zone", "budget", "date_debut", "date_fin", "statut"]
    for key, value in data.items():
        if key in champs_autorises and value is not None:
            setattr(programme, key, value)
    
    await session.commit()
    await session.refresh(programme)
    return programme


async def supprimer_programme(
    session: AsyncSession,
    programme_id: UUID,
    utilisateur: Utilisateur,
) -> None:
    """Supprime un programme après vérification."""
    programme = await obtenir_programme_par_id(session, programme_id, utilisateur)
    
    if not programme:
        raise ErreurValidation(f"Programme {programme_id} introuvable")
    
    # Vérifier s'il y a des missions liées à ce programme
    stmt_missions = select(func.count(MissionTerrain.id)).where(
        MissionTerrain.programme_id == programme_id
    )
    result_missions = await session.execute(stmt_missions)
    nombre_missions = result_missions.scalar() or 0
    
    if nombre_missions > 0:
        raise ErreurValidation(
            f"Impossible de supprimer ce programme car {nombre_missions} mission(s) y sont associées. "
            "Veuillez d'abord supprimer ou réaffecter les missions."
        )
    
    await session.delete(programme)
    await session.commit()


# =============================================================================
# MISSIONS TERRAIN
# =============================================================================

async def creer_mission(
    session: AsyncSession,
    utilisateur: Utilisateur,
    data: dict,
) -> MissionTerrain:
    """Crée une nouvelle mission avec cloisonnement automatique."""
    mission = MissionTerrain(
        ong_id=utilisateur.id,
        domaine_id=utilisateur.domaine_id,
        departement_id=utilisateur.departement_id,
        **data
    )
    session.add(mission)
    await session.commit()
    await session.refresh(mission)
    return mission


async def obtenir_missions(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> list[MissionTerrain]:
    """Liste les missions avec cloisonnement."""
    query = select(MissionTerrain).order_by(MissionTerrain.date_depart.desc())
    
    # --- Cloisonnement ---
    query = _appliquer_filtres_cloisonnement(query, utilisateur, MissionTerrain)
    
    if not _est_super_admin(utilisateur):
        query = query.where(MissionTerrain.ong_id == utilisateur.id)
    
    result = await session.execute(query)
    return list(result.scalars().all())


async def obtenir_mission_par_id(
    session: AsyncSession,
    mission_id: UUID,
    utilisateur: Utilisateur,
) -> MissionTerrain | None:
    """Récupère une mission par son ID avec vérification d'autorisation."""
    stmt = select(MissionTerrain).where(MissionTerrain.id == mission_id)
    result = await session.execute(stmt)
    mission = result.scalar_one_or_none()
    
    if not mission:
        return None
    
    # Vérifier que l'utilisateur a le droit de voir cette mission
    if not _est_super_admin(utilisateur):
        if mission.ong_id != utilisateur.id:
            raise ErreurAutorisation("Vous n'avez pas accès à cette mission")
        if utilisateur.domaine_id and mission.domaine_id != utilisateur.domaine_id:
            raise ErreurAutorisation("Cette mission n'appartient pas à votre domaine")
    
    return mission


async def mettre_a_jour_mission(
    session: AsyncSession,
    mission_id: UUID,
    utilisateur: Utilisateur,
    data: dict,
) -> MissionTerrain:
    """Met à jour une mission existante avec vérification d'autorisation."""
    mission = await obtenir_mission_par_id(session, mission_id, utilisateur)
    
    if not mission:
        raise ErreurValidation(f"Mission {mission_id} introuvable")
    
    # Mise à jour des champs autorisés
    champs_autorises = ["titre", "objectifs", "zone", "date_depart", "date_retour", "statut", "programme_id"]
    for key, value in data.items():
        if key in champs_autorises and value is not None:
            setattr(mission, key, value)
    
    await session.commit()
    await session.refresh(mission)
    return mission


async def supprimer_mission(
    session: AsyncSession,
    mission_id: UUID,
    utilisateur: Utilisateur,
) -> None:
    """Supprime une mission et ses assignations d'agents."""
    mission = await obtenir_mission_par_id(session, mission_id, utilisateur)
    
    if not mission:
        raise ErreurValidation(f"Mission {mission_id} introuvable")
    
    # Supprimer d'abord les assignations d'agents liées à cette mission
    stmt_assignations = select(MissionAgent).where(MissionAgent.mission_id == mission_id)
    result_assignations = await session.execute(stmt_assignations)
    assignations = result_assignations.scalars().all()
    
    for assignation in assignations:
        await session.delete(assignation)
    
    # Puis supprimer la mission elle-même
    await session.delete(mission)
    await session.commit()


async def assigner_agents_a_mission(
    session: AsyncSession,
    mission_id: UUID,
    utilisateur: Utilisateur,
    agent_ids: list[UUID],
    instructions: str | None = None,
) -> list[MissionAgent]:
    """Assigne des agents à une mission."""
    mission = await obtenir_mission_par_id(session, mission_id, utilisateur)
    
    if not mission:
        raise ErreurValidation(f"Mission {mission_id} introuvable")
    
    # Vérifier que les agents existent et appartiennent au même domaine
    agents_assignes = []
    for agent_id in agent_ids:
        stmt_agent = select(Utilisateur).where(
            Utilisateur.id == agent_id,
            Utilisateur.domaine_id == utilisateur.domaine_id,
            Utilisateur.est_actif == True,
        )
        result_agent = await session.execute(stmt_agent)
        agent = result_agent.scalar_one_or_none()
        
        if not agent:
            raise ErreurValidation(f"Agent {agent_id} introuvable ou inactif")
        
        # Vérifier si l'agent n'est pas déjà assigné à cette mission
        stmt_exist = select(MissionAgent).where(
            MissionAgent.mission_id == mission_id,
            MissionAgent.agent_id == agent_id,
        )
        result_exist = await session.execute(stmt_exist)
        if result_exist.scalar_one_or_none():
            continue  # L'agent est déjà assigné, on passe
        
        # Créer l'assignation
        assignation = MissionAgent(
            mission_id=mission_id,
            agent_id=agent_id,
            instructions=instructions,
        )
        session.add(assignation)
        agents_assignes.append(assignation)
    
    await session.commit()
    
    # Rafraîchir les assignations
    for assignation in agents_assignes:
        await session.refresh(assignation)
    
    return agents_assignes


async def desassigner_agent_de_mission(
    session: AsyncSession,
    mission_id: UUID,
    agent_id: UUID,
    utilisateur: Utilisateur,
) -> None:
    """Retire un agent d'une mission."""
    mission = await obtenir_mission_par_id(session, mission_id, utilisateur)
    
    if not mission:
        raise ErreurValidation(f"Mission {mission_id} introuvable")
    
    stmt = select(MissionAgent).where(
        MissionAgent.mission_id == mission_id,
        MissionAgent.agent_id == agent_id,
    )
    result = await session.execute(stmt)
    assignation = result.scalar_one_or_none()
    
    if not assignation:
        raise ErreurValidation("Cet agent n'est pas assigné à cette mission")
    
    await session.delete(assignation)
    await session.commit()


async def obtenir_agents_mission(
    session: AsyncSession,
    mission_id: UUID,
    utilisateur: Utilisateur,
) -> list[dict]:
    """Récupère la liste des agents assignés à une mission."""
    mission = await obtenir_mission_par_id(session, mission_id, utilisateur)
    
    if not mission:
        raise ErreurValidation(f"Mission {mission_id} introuvable")
    
    stmt = (
        select(MissionAgent, Utilisateur)
        .join(Utilisateur, MissionAgent.agent_id == Utilisateur.id)
        .where(MissionAgent.mission_id == mission_id)
    )
    result = await session.execute(stmt)
    
    agents = []
    for assignation, agent in result.all():
        agents.append({
            "id": str(agent.id),
            "prenom": agent.prenom_dechiffre if hasattr(agent, 'prenom_dechiffre') else "",
            "nom": agent.nom_dechiffre if hasattr(agent, 'nom_dechiffre') else "",
            "email": agent.email_dechiffre if hasattr(agent, 'email_dechiffre') else "",
            "instructions": assignation.instructions,
            "statut_assignation": assignation.statut if hasattr(assignation, 'statut') else "assigne",
        })
    
    return agents