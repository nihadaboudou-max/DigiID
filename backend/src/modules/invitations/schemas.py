# -*- coding: utf-8 -*-
"""Schémas Pydantic pour les invitations."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class InvitationCreate(BaseModel):
    """Schéma pour créer une invitation."""
    email: EmailStr = Field(..., description="Email du destinataire")
    role: str = Field(..., description="Rôle proposé")
    domaine_id: Optional[UUID] = Field(None, description="Domaine d'affectation")
    departement_id: Optional[UUID] = Field(None, description="Département d'affectation")
    message: Optional[str] = Field(None, max_length=500, description="Message personnalisé")
    duree_jours: int = Field(7, ge=1, le=30, description="Durée de validité en jours")


class InvitationResponse(BaseModel):
    """Schéma de réponse pour une invitation."""
    id: UUID
    email: str
    role: str
    domaine_id: Optional[UUID]
    departement_id: Optional[UUID]
    statut: str
    message: Optional[str]
    date_creation: datetime
    date_expiration: datetime
    date_acceptation: Optional[datetime]
    cree_par: UUID

    class Config:
        from_attributes = True


class InvitationListResponse(BaseModel):
    """Schéma de réponse pour une liste d'invitations."""
    invitations: list[InvitationResponse]
    total: int
    page: int
    par_page: int


class InvitationValiderResponse(BaseModel):
    """Schéma de réponse après validation d'une invitation."""
    message: str
    invitation: InvitationResponse
    token_inscription: str  # Token à utiliser pour compléter l'inscription