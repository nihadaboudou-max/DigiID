# -*- coding: utf-8 -*-
"""Schémas Pydantic pour la gestion de tous les utilisateurs (super admin)."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


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
