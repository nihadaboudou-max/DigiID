# -*- coding: utf-8 -*-
"""Schémas Pydantic du module super_admin (gestion des admins)."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class CreerAdminRequete(BaseModel):
    """
    Données pour créer un nouvel administrateur.
    Seul le super administrateur peut faire cette action.
    """
    email: EmailStr = Field(..., description="Email du futur admin")
    mot_de_passe: str = Field(
        ...,
        min_length=12,
        max_length=128,
        description="12+ caractères, majuscule, minuscule, chiffre, caractère spécial",
    )
    prenom: str = Field(..., min_length=2, max_length=50)
    nom: str = Field(..., min_length=2, max_length=50)
    ville: Optional[str] = Field(default=None, max_length=100)

    @field_validator("mot_de_passe")
    @classmethod
    def valider_complexite(cls, v: str) -> str:
        """Vérifie la complexité minimale du mot de passe (même règle que pour les utilisateurs)."""
        if not any(c.islower() for c in v):
            raise ValueError("Le mot de passe doit contenir au moins une minuscule")
        if not any(c.isupper() for c in v):
            raise ValueError("Le mot de passe doit contenir au moins une majuscule")
        if not any(c.isdigit() for c in v):
            raise ValueError("Le mot de passe doit contenir au moins un chiffre")
        if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?/~`" for c in v):
            raise ValueError("Le mot de passe doit contenir au moins un caractère spécial")
        return v


class AdminApercu(BaseModel):
    """Vue d'un administrateur dans la liste."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    prenom: Optional[str]
    nom: Optional[str]
    role: str
    est_actif: bool
    deux_fa_active: bool
    est_email_verifie: bool
    date_creation: datetime
    date_derniere_connexion: Optional[datetime]


class ListeAdmins(BaseModel):
    administrateurs: list[AdminApercu]
    total: int
