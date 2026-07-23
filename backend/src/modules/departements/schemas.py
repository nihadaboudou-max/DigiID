# -*- coding: utf-8 -*-
"""Schémas Pydantic pour les départements."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class DepartementBase(BaseModel):
    """Schéma de base pour un département."""
    nom: str = Field(..., min_length=3, max_length=150)
    type_departement: str = Field(..., pattern=r"^(police|medical|ong|agent|admin)$")
    description: Optional[str] = Field(None, max_length=1000)
    capacite_max: int = Field(0, ge=0, description="0 = illimité")


class DepartementCreate(DepartementBase):
    """Schéma pour créer un département."""
    domaine_id: UUID
    chef_id: Optional[UUID] = None


class DepartementUpdate(BaseModel):
    """Schéma pour mettre à jour un département."""
    nom: Optional[str] = Field(None, min_length=3, max_length=150)
    type_departement: Optional[str] = Field(None, pattern=r"^(police|medical|ong|agent|admin)$")
    description: Optional[str] = Field(None, max_length=1000)
    domaine_id: Optional[UUID] = None
    chef_id: Optional[UUID] = None
    capacite_max: Optional[int] = Field(None, ge=0)
    est_actif: Optional[bool] = None


class DepartementResponse(DepartementBase):
    """Schéma de réponse pour un département."""
    id: UUID
    domaine_id: UUID
    domaine_nom: Optional[str] = None
    chef_id: Optional[UUID] = None
    chef_nom: Optional[str] = None
    est_actif: bool
    date_creation: datetime
    date_modification: Optional[datetime] = None

    class Config:
        from_attributes = True


class DepartementListResponse(BaseModel):
    """Réponse paginée pour la liste des départements."""
    departements: list[DepartementResponse]
    total: int
    page: int
    par_page: int