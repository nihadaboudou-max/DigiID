"""Schémas Pydantic pour le module ONG."""
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


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

    model_config = {"from_attributes": True}


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

    model_config = {"from_attributes": True}


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

    model_config = {"from_attributes": True}
