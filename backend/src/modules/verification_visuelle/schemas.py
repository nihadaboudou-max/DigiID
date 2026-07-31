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
    """Détail d'une vérification visuelle."""
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
    """Liste des vérifications visuelles d'un utilisateur."""
    historique: list[VerificationVisuelleDetail]
    total: int


# ✅ NOUVEAU SCHÉMA : Résultat de la comparaison faciale
class ResultatComparaisonFaciale(BaseModel):
    """
    Résultat de la comparaison entre la photo de profil (selfie) 
    et la photo d'un document d'identité (CNI).
    """
    correspond: bool = Field(
        ..., 
        description="Indique si les visages correspondent selon le seuil défini."
    )
    score_confiance: float = Field(
        ..., 
        ge=0.0, 
        le=1.0, 
        description="Score de similarité brut entre 0.0 et 1.0."
    )
    message: str = Field(
        ..., 
        description="Message explicatif du résultat destiné à l'utilisateur."
    )
    seuil_utilise: float = Field(
        ..., 
        ge=0.0, 
        le=1.0, 
        description="Le seuil de similarité utilisé pour prendre la décision."
    )