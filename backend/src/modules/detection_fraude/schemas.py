# -*- coding: utf-8 -*-
"""Schémas Pydantic pour la détection de fraude."""
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ActionFraudeRequete(BaseModel):
    """Requête de simulation d'une action à risque."""
    type_action: Literal["connexion", "transaction", "profil", "document", "autre"] = "autre"
    tentatives_connexion_echec: int = Field(0, ge=0)
    ip: Optional[str] = Field(None, description="Adresse IP de la requête")
    pays: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    latitude_precedente: Optional[float] = None
    longitude_precedente: Optional[float] = None
    appareil: Optional[str] = None
    metadonnees: Optional[dict] = None


class SignalFraude(BaseModel):
    nom: str
    severite: int = Field(..., ge=0, le=100)
    description: str


class ScoreRisque(BaseModel):
    score_total: int = Field(..., ge=0, le=100)
    niveau: str
    interpretation: str
    facteurs: list[SignalFraude]


class IncidentFraude(BaseModel):
    id: UUID
    utilisateur_id: UUID
    type_action: str
    score_risque: int
    niveau: str
    description: str
    adresse_ip: Optional[str] = None
    appareil: Optional[str] = None
    details: Optional[dict] = None
    date_evenement: datetime


class ListeIncidentsFraude(BaseModel):
    incidents: list[IncidentFraude]
    total: int
