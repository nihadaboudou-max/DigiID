# -*- coding: utf-8 -*-
"""
Schémas Pydantic du module Sécurité Renforcée — Phase 8.

Changement de rôle, validation email institutionnel, alertes de fraude.
"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from src.config.constantes import RolesUtilisateur


class ChangerRoleRequete(BaseModel):
    """
    Requête pour changer le rôle d'un utilisateur.
    Seul le super administrateur peut faire cette action.
    """
    nouveau_role: str = Field(
        ...,
        description="Nouveau rôle parmi : " + ", ".join(r.value for r in RolesUtilisateur),
    )
    raison: str = Field(
        ...,
        min_length=10,
        max_length=500,
        description="Motif détaillé du changement de rôle (obligatoire, 10-500 caractères)",
    )
    confirmer_verification_identite: bool = Field(
        ...,
        description="Confirmer que l'identité de l'utilisateur cible a été vérifiée",
    )

    @field_validator("nouveau_role")
    @classmethod
    def valider_role_existe(cls, v: str) -> str:
        """Vérifie que le rôle fait partie de l'énumération."""
        roles_valides = [r.value for r in RolesUtilisateur]
        if v not in roles_valides:
            raise ValueError(
                f"Rôle invalide : '{v}'. "
                f"Rôles acceptés : {', '.join(roles_valides)}"
            )
        return v

    @field_validator("confirmer_verification_identite")
    @classmethod
    def exiger_confirmation(cls, v: bool) -> bool:
        """La confirmation est obligatoire — pas de changement sans vérification."""
        if not v:
            raise ValueError(
                "Tu dois confirmer que l'identité de l'utilisateur cible a été vérifiée. "
                "Cette confirmation est une protection anti-usurpation."
            )
        return v


class ChangerRoleReponse(BaseModel):
    """Réponse après changement de rôle réussi."""
    utilisateur_id: UUID
    email: str
    ancien_role: str
    nouveau_role: str
    date_changement: datetime
    sessions_revoquees: int
    message: str


class VerificationEmailInstitutionnel(BaseModel):
    """Résultat de la validation d'un email institutionnel."""
    email: str
    domaine: str
    est_valide: bool
    role_cible: str
    raison: Optional[str] = None


class AlerteUsurpation(BaseModel):
    """Alerte de tentative d'usurpation détectée."""
    type_alerte: str = "TENTATIVE_USURPATION"
    utilisateur_id: UUID
    role_actuel: str
    route_tentee: str
    adresse_ip: str
    agent_utilisateur: Optional[str] = None
    date_detection: datetime
    score_risque: int
