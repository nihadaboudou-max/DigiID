# -*- coding: utf-8 -*-
"""Schémas Pydantic pour la vérification visuelle."""
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


VerificationStatut = Literal["en_attente", "approuve", "rejete"]


class SuppressionVerification(BaseModel):
    """Réponse après suppression d'une vérification."""
    id: UUID
    message: str = "Vérification supprimée avec succès. Elle est dans la corbeille."


class RestaurationVerification(BaseModel):
    """Réponse après restauration d'une vérification."""
    id: UUID
    message: str = "Vérification restaurée avec succès."


class VerificationVisuelleDetail(BaseModel):
    id: UUID
    statut: VerificationStatut
    raison: Optional[str] = None
    score_liveness: float = Field(..., ge=0.0, le=1.0)
    score_similarite: Optional[float] = Field(None, ge=0.0, le=1.0)
    date_upload: datetime
    date_verification: Optional[datetime] = None
    est_supprime: bool = False
    date_suppression: Optional[datetime] = None
    details: Optional[dict] = None


class ListeVerificationVisuelle(BaseModel):
    historique: list[VerificationVisuelleDetail]
    total: int
