# -*- coding: utf-8 -*-
"""Schémas Pydantic pour les invitations."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from src.config.constantes import RolesUtilisateur


class InvitationCreate(BaseModel):
    """Schéma pour créer une invitation."""
    email: EmailStr = Field(..., description="Email du destinataire")
    role: str = Field(..., description="Rôle proposé")
    domaine_id: Optional[UUID] = Field(None, description="Domaine d'affectation")
    departement_id: Optional[UUID] = Field(None, description="Département d'affectation")
    message: Optional[str] = Field(None, max_length=500, description="Message personnalisé")
    duree_jours: int = Field(7, ge=1, le=30, description="Durée de validité en jours")

    @field_validator("role")
    @classmethod
    def valider_role_invitable(cls, v: str) -> str:
        """
        Vérifie que le rôle proposé est bien un rôle professionnel invitable.

        On refuse notamment ``citoyen`` (auto-inscription) et tout rôle inconnu,
        pour éviter les fautes de frappe de l'interface ou les appels API forgés.
        """
        roles_invitables = [
            # Chefs de département
            RolesUtilisateur.CHEF_POLICE.value,
            RolesUtilisateur.CHEF_MEDICAL.value,
            RolesUtilisateur.CHEF_ONG.value,
            RolesUtilisateur.CHEF_AGENT.value,
            # Agents de terrain
            RolesUtilisateur.AGENT_POLICE.value,
            RolesUtilisateur.AGENT_MEDICAL.value,
            RolesUtilisateur.AGENT_TERRAIN.value,
            RolesUtilisateur.AGENT_ONG.value,
            # ─── Pivot logistique (Plan B) ───
            # Gérant de gare : référentiel + supervision du guichet.
            # Receveur : guichet (colis + scan/livraison).
            # Chauffeur : scan des colis en route (S4).
            # Commerçant : expédition de colis (S6).
            RolesUtilisateur.GERANT_GARE.value,
            RolesUtilisateur.RECEVEUR.value,
            RolesUtilisateur.CHAUFFEUR.value,
            RolesUtilisateur.COMMERCANT.value,
            # Administration
            RolesUtilisateur.ADMIN_DOMAINE.value,
            RolesUtilisateur.ADMINISTRATEUR.value,
            RolesUtilisateur.SUPER_ADMINISTRATEUR.value,
        ]
        if v not in roles_invitables:
            raise ValueError(
                f"Rôle '{v}' non invitable. Rôles disponibles : "
                f"{', '.join(roles_invitables)}"
            )
        return v


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

    # ─── Statut réel de l'envoi de l'email ───────────────────────────────
    # L'invitation est créée même si l'email échoue (ex : service email non
    # configuré → mode mock). Ces champs permettent à l'interface d'afficher
    # un avertissement au lieu d'un faux « Invitation envoyée ! ».
    email_envoye: Optional[bool] = None
    email_detail: Optional[str] = None

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
    
class InvitationAcceptationSchema(BaseModel):
    """Données pour accepter une invitation."""
    prenom: str
    nom: str
    mot_de_passe: str
    ville: str | None = None
    telephone: str | None = None