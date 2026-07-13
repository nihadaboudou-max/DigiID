# -*- coding: utf-8 -*-
"""Schémas Pydantic pour le module ONG — avec cloisonnement."""
from datetime import date, datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field


# =============================================================================
# BÉNÉFICIAIRES
# =============================================================================

class BeneficiaireCreate(BaseModel):
    nom: str
    digiid: Optional[str] = None
    programme: str
    zone: Optional[str] = None
    notes: Optional[str] = None


class BeneficiaireResponse(BaseModel):
    id: UUID
    ong_id: UUID
    nom: str
    digiid: Optional[str] = None
    programme: str
    zone: Optional[str] = None
    date_inscription: datetime
    statut: str
    notes: Optional[str] = None
    domaine_id: Optional[UUID] = None
    departement_id: Optional[UUID] = None

    model_config = {"from_attributes": True}


# =============================================================================
# PROGRAMMES
# =============================================================================

class ProgrammeCreate(BaseModel):
    nom: str
    description: Optional[str] = None
    zone: Optional[str] = None
    budget: Optional[float] = None
    date_debut: date
    date_fin: Optional[date] = None


class ProgrammeResponse(BaseModel):
    id: UUID
    ong_id: UUID
    nom: str
    description: Optional[str] = None
    zone: Optional[str] = None
    budget: Optional[float] = None
    date_debut: date
    date_fin: Optional[date] = None
    statut: str
    domaine_id: Optional[UUID] = None
    departement_id: Optional[UUID] = None

    model_config = {"from_attributes": True}


# =============================================================================
# MISSIONS
# =============================================================================

class MissionCreate(BaseModel):
    programme_id: Optional[UUID] = None
    titre: str
    zone: Optional[str] = None
    date_depart: date
    date_retour: Optional[date] = None
    objectifs: Optional[str] = None


class MissionResponse(BaseModel):
    id: UUID
    ong_id: UUID
    programme_id: Optional[UUID] = None
    titre: str
    zone: Optional[str] = None
    date_depart: date
    date_retour: Optional[date] = None
    objectifs: Optional[str] = None
    statut: str
    domaine_id: Optional[UUID] = None
    departement_id: Optional[UUID] = None

    model_config = {"from_attributes": True}


# =============================================================================
# ASSIGNATION DE MISSIONS
# =============================================================================

class AssignationMissionCreate(BaseModel):
    """Assignation d'une mission à un agent."""
    mission_id: UUID = Field(..., description="ID de la mission à assigner")
    agent_email: Optional[EmailStr] = Field(None, description="Email de l'agent")
    agent_id: Optional[UUID] = Field(None, description="ID de l'agent")
    instructions: Optional[str] = Field(None, max_length=1000, description="Instructions spécifiques")
    date_limite: Optional[date] = Field(None, description="Date limite de réalisation")


class AssignationResponse(BaseModel):
    """Réponse d'assignation."""
    id: UUID
    mission_id: UUID
    mission_titre: str
    agent_id: UUID
    agent_nom: str
    agent_email: str
    instructions: Optional[str] = None
    date_limite: Optional[date] = None
    statut: str
    date_assignation: datetime
    date_completion: Optional[datetime] = None

    model_config = {"from_attributes": True}


# =============================================================================
# AGENTS
# =============================================================================

class AgentInfo(BaseModel):
    """Informations sur un agent."""
    id: UUID
    email: str
    prenom: str
    nom: str
    ville: Optional[str] = None
    est_actif: bool
    date_creation: datetime
    missions_assignees: int = 0
    missions_terminees: int = 0


# =============================================================================
# STATISTIQUES
# =============================================================================

class StatsONGResponse(BaseModel):
    nb_beneficiaires: int = 0
    nb_programmes: int = 0
    nb_missions: int = 0
    zones: list[str] = []


class StatsChefONG(BaseModel):
    """Statistiques pour le chef ONG."""
    nb_agents: int
    nb_programmes: int
    nb_missions: int
    nb_missions_en_cours: int
    nb_beneficiaires_total: int
    zones_actives: list[str]
    taux_completion_missions: float
    agents_actifs: int
    agents_inactifs: int