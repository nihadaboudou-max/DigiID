# -*- coding: utf-8 -*-
"""Schémas Pydantic pour la gestion de tous les utilisateurs (super admin)."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


from src.config.constantes import RolesUtilisateur


class CreerProfilRequete(BaseModel):
    """
    Données pour créer un compte avec un rôle spécifique (hors citoyen).
    Le super administrateur peut créer des profils pour :
      - ong, medecin, agent, police
      - administrateur, super_administrateur
    """
    email: str = Field(
        ...,
        min_length=5, max_length=255,
        description="Email du futur utilisateur",
    )
    mot_de_passe: str = Field(
        ...,
        min_length=12, max_length=128,
        description="12+ caractères, majuscule, minuscule, chiffre, caractère spécial",
    )
    prenom: str = Field(..., min_length=2, max_length=50, description="Prénom") 
    nom: str = Field(..., min_length=2, max_length=50, description="Nom")
    role: str = Field(
        ...,
        description="Rôle à attribuer (ong, medecin, agent, police, administrateur, super_administrateur)",
    )
    ville: Optional[str] = Field(default=None, max_length=100, description="Ville (optionnelle)")

    @field_validator("role")
    @classmethod
    def valider_role_creation(cls, v: str) -> str:
        """Vérifie que le rôle est autorisé à la création (pas citoyen)."""
        roles_autorises = [
            RolesUtilisateur.ONG.value,
            RolesUtilisateur.MEDECIN.value,
            RolesUtilisateur.AGENT.value,
            RolesUtilisateur.POLICE.value,
            RolesUtilisateur.ADMINISTRATEUR.value,
            RolesUtilisateur.SUPER_ADMINISTRATEUR.value,
        ]
        if v not in roles_autorises:
            raise ValueError(
                f"Rôle '{v}' non autorisé. Rôles disponibles : {', '.join(roles_autorises)}"
            )
        return v

    @field_validator("mot_de_passe")
    @classmethod
    def valider_complexite(cls, v: str) -> str:
        """Vérifie la complexité minimale du mot de passe."""
        if not any(c.islower() for c in v):
            raise ValueError("Le mot de passe doit contenir au moins une minuscule")
        if not any(c.isupper() for c in v):
            raise ValueError("Le mot de passe doit contenir au moins une majuscule")
        if not any(c.isdigit() for c in v):
            raise ValueError("Le mot de passe doit contenir au moins un chiffre")
        if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?/~`" for c in v):
            raise ValueError("Le mot de passe doit contenir au moins un caractère spécial")
        return v


class UtilisateurApercu(BaseModel):
    """Vue complète d'un utilisateur (tous rôles)."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    prenom: Optional[str] = None
    nom: Optional[str] = None
    role: str
    est_actif: bool
    est_verrouille: bool
    est_supprime: bool
    deux_fa_active: bool
    est_email_verifie: bool
    ville: Optional[str] = None
    domaine_id: Optional[UUID] = Field(None, description="ID du domaine assigné")
    score_actuel: Optional[int] = None
    date_creation: datetime
    date_derniere_connexion: Optional[datetime] = None
    date_verrouillage: Optional[datetime] = None
    date_suppression: Optional[datetime] = None
    motif_suspension: Optional[str] = None
    sessions_actives: int = 0
    roles_autorises: list[str] = []


class ListeUtilisateurs(BaseModel):
    """Liste paginée des utilisateurs."""
    utilisateurs: list[UtilisateurApercu]
    total: int
    page: int = 1
    pages: int = 1
    limite: int = 20


class NombreUtilisateurs(BaseModel):
    """Compteurs globaux pour le dashboard."""
    total: int
    actifs: int
    verrouilles: int
    supprimes: int
    avec_2fa: int
    sans_2fa: int


class ModifierUtilisateurRequete(BaseModel):
    """Données modifiables d'un utilisateur."""
    prenom: Optional[str] = None
    nom: Optional[str] = None
    ville: Optional[str] = None
    domaine_id: Optional[UUID] = Field(None, description="ID du domaine assigné")
