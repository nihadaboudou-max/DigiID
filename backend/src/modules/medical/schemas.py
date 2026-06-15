# -*- coding: utf-8 -*-
"""Schémas Pydantic pour le module médical."""
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class DossierMedicalCreate(BaseModel):
    patient_nom: str = Field(..., description="Nom complet du patient")
    patient_digiid: str = Field(..., description="DigiID du patient")
    patient_date_naissance: Optional[date] = None
    motif: str = Field(..., description="Motif de la consultation")
    diagnostic: Optional[str] = None


class DossierMedicalUpdate(BaseModel):
    motif: Optional[str] = None
    diagnostic: Optional[str] = None
    statut: Optional[str] = None


class DossierMedicalResponse(BaseModel):
    id: UUID
    medecin_id: UUID
    patient_nom: str
    patient_digiid: str
    patient_date_naissance: Optional[date] = None
    motif: str
    diagnostic: Optional[str] = None
    statut: str
    consultations_count: int = 0
    ordonnances_count: int = 0
    date_creation: datetime
    date_modification: datetime

    model_config = {"from_attributes": True}


class ConsultationCreate(BaseModel):
    dossier_id: UUID
    motif: str
    observations: Optional[str] = None
    diagnostic: Optional[str] = None


class ConsultationResponse(BaseModel):
    id: UUID
    dossier_id: UUID
    medecin_id: UUID
    motif: str
    observations: Optional[str] = None
    diagnostic: Optional[str] = None
    date_consultation: datetime

    model_config = {"from_attributes": True}


class OrdonnanceCreate(BaseModel):
    dossier_id: UUID
    medicaments: str = Field(..., description="Liste JSON des médicaments")
    instructions: Optional[str] = None
    date_expiration: Optional[date] = None


class OrdonnanceResponse(BaseModel):
    id: UUID
    dossier_id: UUID
    medecin_id: UUID
    medicaments: str
    instructions: Optional[str] = None
    date_prescription: datetime
    date_expiration: Optional[date] = None

    model_config = {"from_attributes": True}


class VerificationDigiIDResponse(BaseModel):
    trouvé: bool = Field(..., description="True si le DigiID correspond à un citoyen existant")
    digiid: str = Field(..., description="Le DigiID recherché")
    nom: Optional[str] = Field(None, description="Nom du citoyen")
    prenom: Optional[str] = Field(None, description="Prénom du citoyen")
    email: Optional[str] = Field(None, description="Email du citoyen")


class PatientSearchResponse(BaseModel):
    digiid: str
    nom: str
    email: Optional[str] = None
    telephone: Optional[str] = None
    score: Optional[int] = None
