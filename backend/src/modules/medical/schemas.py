# -*- coding: utf-8 -*-
"""Schémas Pydantic pour le module médical — avec cloisonnement."""
from datetime import date, datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


class DossierMedicalCreate(BaseModel):
    patient_nom: str = Field(..., description="Nom du patient")
    patient_prenom: Optional[str] = Field(None, description="Prénom du patient")
    patient_digiid: str = Field(..., description="DigiID du patient")
    patient_date_naissance: Optional[date] = None
    hopital: Optional[str] = Field(None, description="Hôpital ou clinique")
    motif: str = Field(..., description="Motif de la consultation")
    diagnostic: Optional[str] = None


class DossierMedicalUpdate(BaseModel):
    motif: Optional[str] = None
    diagnostic: Optional[str] = None
    hopital: Optional[str] = None
    statut: Optional[str] = None


class DossierMedicalResponse(BaseModel):
    id: UUID
    medecin_id: UUID
    patient_nom: str
    patient_prenom: Optional[str] = None
    patient_digiid: str
    patient_date_naissance: Optional[date] = None
    hopital: Optional[str] = None
    motif: str
    diagnostic: Optional[str] = None
    statut: str
    consultations_count: int = 0
    ordonnances_count: int = 0
    date_creation: datetime
    date_modification: datetime
    # --- Cloisonnement (NOUVEAU) ---
    domaine_id: Optional[UUID] = None
    departement_id: Optional[UUID] = None
    model_config = {"from_attributes": True}


class ConsultationCreate(BaseModel):
    dossier_id: UUID
    hopital: Optional[str] = None
    motif: str
    type_consultation: Optional[str] = Field(None, description="consultation, suivi, urgence, controle")
    poids: Optional[int] = Field(None, description="Poids en kg")
    taille: Optional[int] = Field(None, description="Taille en cm")
    temperature: Optional[int] = Field(None, description="Température en dixièmes de degré")
    pression_arterielle: Optional[str] = Field(None, description="Tension artérielle")
    observations: Optional[str] = None
    diagnostic: Optional[str] = None
    conclusion: Optional[str] = None
    date_controle: Optional[date] = Field(None, description="Date recommandée pour le contrôle")


class ConsultationResponse(BaseModel):
    id: UUID
    dossier_id: UUID
    medecin_id: UUID
    hopital: Optional[str] = None
    motif: str
    type_consultation: Optional[str] = None
    poids: Optional[int] = None
    taille: Optional[int] = None
    temperature: Optional[int] = None
    pression_arterielle: Optional[str] = None
    observations: Optional[str] = None
    diagnostic: Optional[str] = None
    conclusion: Optional[str] = None
    date_controle: Optional[date] = None
    date_consultation: datetime
    # --- Cloisonnement (NOUVEAU) ---
    domaine_id: Optional[UUID] = None
    departement_id: Optional[UUID] = None

    model_config = {"from_attributes": True}


class OrdonnanceCreate(BaseModel):
    dossier_id: UUID
    hopital: Optional[str] = Field(None, description="Hôpital ou clinique")
    medicaments: str = Field(..., description="Liste des médicaments")
    instructions: Optional[str] = None
    date_expiration: Optional[date] = None


class OrdonnanceUpdate(BaseModel):
    medicaments: Optional[str] = None
    instructions: Optional[str] = None
    date_expiration: Optional[date] = None


class OrdonnanceResponse(BaseModel):
    id: UUID
    dossier_id: UUID
    medecin_id: UUID
    numero_ordonnance: str
    hopital: Optional[str] = None
    medecin_nom: Optional[str] = None
    medicaments: str
    instructions: Optional[str] = None
    statut: str = "active"
    date_prescription: datetime
    date_expiration: Optional[date] = None
    # --- Cloisonnement (NOUVEAU) ---
    domaine_id: Optional[UUID] = None
    departement_id: Optional[UUID] = None

    model_config = {"from_attributes": True}


class VerificationDigiIDResponse(BaseModel):
    trouvé: bool = Field(..., description="True si le DigiID correspond à un citoyen")
    digiid: str = Field(..., description="Le DigiID recherché")
    nom: Optional[str] = Field(None, description="Nom du citoyen")
    prenom: Optional[str] = Field(None, description="Prénom du citoyen")
    email: Optional[str] = Field(None, description="Email du citoyen")


class SignalementCreate(BaseModel):
    motif: str = Field(..., min_length=10, max_length=500, description="Description du problème")


class DossierCompletResponse(BaseModel):
    """Dossier médical complet du patient."""
    dossier: DossierMedicalResponse
    consultations: list[ConsultationResponse]
    ordonnances: list[OrdonnanceResponse]

    model_config = {"from_attributes": True}