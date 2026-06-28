# -*- coding: utf-8 -*-
"""Schémas Pydantic pour les domaines."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class DomaineBase(BaseModel):
    """Schéma de base pour un domaine."""
    nom: str = Field(..., min_length=3, max_length=150, description="Nom du domaine")
    code: str = Field(..., min_length=3, max_length=20, pattern=r"^[A-Z0-9-]+$",
                      description="Code unique (ex: DOM-NORD)")
    description: Optional[str] = Field(None, max_length=1000)
    region: Optional[str] = Field(None, max_length=100)

    @field_validator("code")
    @classmethod
    def valider_code(cls, v: str) -> str:
        return v.upper().strip()


class DomaineCreate(DomaineBase):
    """Schéma pour créer un domaine."""
    pass


class DomaineUpdate(BaseModel):
    """Schéma pour mettre à jour un domaine."""
    nom: Optional[str] = Field(None, min_length=3, max_length=150)
    description: Optional[str] = Field(None, max_length=1000)
    region: Optional[str] = Field(None, max_length=100)
    est_actif: Optional[bool] = None


class DomaineResponse(DomaineBase):
    """Schéma de réponse pour un domaine."""
    id: UUID
    admin_id: Optional[UUID] = None
    est_actif: bool
    date_creation: datetime
    date_modification: Optional[datetime] = None
    date_suspension: Optional[datetime] = None
    motif_suspension: Optional[str] = None

    class Config:
        from_attributes = True


class DomaineListResponse(BaseModel):
    """Réponse paginée pour la liste des domaines."""
    domaines: list[DomaineResponse]
    total: int
    page: int
    par_page: int