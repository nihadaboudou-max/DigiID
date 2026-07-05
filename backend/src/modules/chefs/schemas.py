# -*- coding: utf-8 -*-
"""Schémas Pydantic pour le module Chefs."""
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, EmailStr


class AgentPoliceCreate(BaseModel):
    """Création d'un agent police par un chef police."""
    email: EmailStr
    prenom: str = Field(..., min_length=2, max_length=100)
    nom: str = Field(..., min_length=2, max_length=100)
    telephone: Optional[str] = None
    ville: Optional[str] = None
    pays: str = "Sénégal"


class MedecinCreate(BaseModel):
    """Création d'un médecin par un chef médical."""
    email: EmailStr
    prenom: str = Field(..., min_length=2, max_length=100)
    nom: str = Field(..., min_length=2, max_length=100)
    telephone: Optional[str] = None
    ville: Optional[str] = None
    pays: str = "Sénégal"
    specialite: Optional[str] = None


class AgentONGCreate(BaseModel):
    """Création d'un agent ONG par un chef ONG."""
    email: EmailStr
    prenom: str = Field(..., min_length=2, max_length=100)
    nom: str = Field(..., min_length=2, max_length=100)
    telephone: Optional[str] = None
    ville: Optional[str] = None
    pays: str = "Sénégal"
    mission: Optional[str] = None


class AgentEnrolementCreate(BaseModel):
    """Création d'un agent enrôlement par un chef enrôlement."""
    email: EmailStr
    prenom: str = Field(..., min_length=2, max_length=100)
    nom: str = Field(..., min_length=2, max_length=100)
    telephone: Optional[str] = None
    ville: Optional[str] = None
    pays: str = "Sénégal"


class AgentResponse(BaseModel):
    """Réponse après création d'un agent."""
    id: UUID
    digiid_public: str
    email: str
    prenom: str
    nom: str
    role: str
    domaine_id: Optional[UUID] = None
    departement_id: Optional[UUID] = None
    superieur_id: Optional[UUID] = None
    est_actif: bool = True
    date_creation: datetime
    
    class Config:
        from_attributes = True


class ListeAgentsResponse(BaseModel):
    """Liste des agents d'un chef."""
    agents: list[AgentResponse]
    total: int
    page: int
    par_page: int


class StatistiquesChefResponse(BaseModel):
    """Statistiques pour le dashboard d'un chef."""
    total_agents: int
    agents_actifs: int
    agents_inactifs: int
    agents_crees_aujourdhui: int
    agents_crees_ce_mois: int
    dernier_agent_cree: Optional[AgentResponse] = None