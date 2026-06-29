# -*- coding: utf-8 -*-
"""Schémas Pydantic pour les équipes."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class EquipeCreate(BaseModel):
    """Schéma pour créer une équipe."""
    nom: str = Field(..., min_length=1, max_length=150, description="Nom de l'équipe")
    description: Optional[str] = Field(None, description="Description optionnelle")
    departement_id: UUID = Field(..., description="Département parent")
    chef_id: Optional[UUID] = Field(None, description="Chef de l'équipe")


class EquipeUpdate(BaseModel):
    """Schéma pour modifier une équipe."""
    nom: Optional[str] = Field(None, min_length=1, max_length=150)
    description: Optional[str] = None
    chef_id: Optional[UUID] = None
    est_actif: Optional[bool] = None


class EquipeResponse(BaseModel):
    """Schéma de réponse pour une équipe."""
    id: UUID
    nom: str
    description: Optional[str]
    departement_id: UUID
    chef_id: Optional[UUID]
    est_actif: bool
    date_creation: datetime
    date_modification: Optional[datetime]

    class Config:
        from_attributes = True


class EquipeListResponse(BaseModel):
    """Schéma de réponse pour une liste d'équipes."""
    equipes: list[EquipeResponse]
    total: int
    page: int
    par_page: int


class EquipeMembreAdd(BaseModel):
    """Schéma pour ajouter un membre à une équipe."""
    utilisateur_id: UUID = Field(..., description="ID de l'utilisateur à ajouter")


class EquipeMembreResponse(BaseModel):
    """Schéma de réponse pour un membre d'équipe."""
    equipe_id: UUID
    utilisateur_id: UUID
    date_ajout: datetime