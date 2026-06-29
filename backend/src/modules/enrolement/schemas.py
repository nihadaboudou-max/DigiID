# -*- coding: utf-8 -*-
"""Schémas Pydantic pour le module d'enrôlement — avec cloisonnement."""
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


class EnrolementCreate(BaseModel):
    citoyen_nom: str
    citoyen_prenom: str
    citoyen_telephone: str = Field(..., description="Numéro de téléphone obligatoire")
    citoyen_email: Optional[str] = None
    notes: Optional[str] = None


class EnrolementUpdate(BaseModel):
    statut: Optional[str] = None
    scan_cni: Optional[bool] = None
    capture_biometrique: Optional[bool] = None
    notes: Optional[str] = None


class EnrolementResponse(BaseModel):
    id: UUID
    agent_id: UUID
    citoyen_nom: str
    citoyen_prenom: str
    citoyen_digiid: Optional[str] = None
    citoyen_telephone: Optional[str] = None
    citoyen_email: Optional[str] = None
    statut: str
    notes: Optional[str] = None
    scan_cni: bool
    capture_biometrique: bool
    date_enrolement: datetime
    date_validation: Optional[datetime] = None
    # --- Cloisonnement (NOUVEAU) ---
    domaine_id: Optional[UUID] = None
    departement_id: Optional[UUID] = None

    model_config = {"from_attributes": True}