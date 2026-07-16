# -*- coding: utf-8 -*-
"""
Schémas Pydantic du module Roles — demandes de changement de rôle RBAC.
"""
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


RoleDemandable = Literal[
    "citoyen",
    "agent_police", "agent_medical", "agent_terrain","agent_ong",
    "chef_police", "chef_ong", "chef_agent", "chef_medical",
    "admin_domaine", "administrateur", "super_administrateur",
]


class DemandeRoleRequete(BaseModel):
    """Requête de changement de rôle."""
    role_demande: RoleDemandable = Field(..., description="Rôle demandé")


class DemandeRoleReponse(BaseModel):
    """Réponse après une demande de changement de rôle."""
    message: str
    role_actuel: str
    role_demande: str
    statut: str = "en_attente"
    date_demande: datetime


class ChangementRoleAdmin(BaseModel):
    """Changement de rôle par un administrateur."""
    utilisateur_id: UUID
    nouveau_role: RoleDemandable
    raison: Optional[str] = None
