"""Schémas Pydantic pour le module Police."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class VerificationPoliceCreate(BaseModel):
    personne_digiid: str
    personne_nom: Optional[str] = None
    type_verification: str = "identite"
    notes: Optional[str] = None


class VerificationPoliceResponse(BaseModel):
    id: UUID
    officier_id: UUID
    personne_digiid: str
    personne_nom: Optional[str] = None
    type_verification: str
    resultat: Optional[str] = None
    notes: Optional[str] = None
    date_verification: datetime
    est_signalement_fraude: bool

    model_config = {"from_attributes": True}


class SignalementFraudeCreate(BaseModel):
    personne_digiid: str
    motif: str = Field(..., min_length=10)
    description: Optional[str] = None


class SignalementFraudeResponse(BaseModel):
    id: UUID
    officier_id: UUID
    personne_digiid: str
    motif: str
    description: Optional[str] = None
    statut: str
    date_signalement: datetime
    date_traitement: Optional[datetime] = None

    model_config = {"from_attributes": True}
