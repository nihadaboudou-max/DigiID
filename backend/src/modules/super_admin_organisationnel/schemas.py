# -*- coding: utf-8 -*-
"""Schémas Pydantic pour le module Super Admin Organisationnel."""
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


# ============ DOMAINES ============

class DomaineBase(BaseModel):
    nom: str
    code: str
    description: Optional[str] = None
    region: Optional[str] = None


class DomaineCreate(DomaineBase):
    pass


class DomaineUpdate(BaseModel):
    nom: Optional[str] = None
    description: Optional[str] = None
    region: Optional[str] = None
    admin_id: Optional[UUID] = None


class DomaineResponse(DomaineBase):
    id: UUID
    admin_id: Optional[UUID] = None
    est_actif: bool
    date_creation: datetime
    date_modification: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ListeDomaines(BaseModel):
    domaines: list[DomaineResponse]
    total: int


# ============ DEPARTEMENTS ============

class DepartementBase(BaseModel):
    nom: str
    type_departement: str
    description: Optional[str] = None
    capacite_max: int = 50
    domaine_id: UUID


class DepartementCreate(DepartementBase):
    chef_id: Optional[UUID] = None


class DepartementUpdate(BaseModel):
    nom: Optional[str] = None
    description: Optional[str] = None
    capacite_max: Optional[int] = None
    chef_id: Optional[UUID] = None


class DepartementResponse(DepartementBase):
    id: UUID
    domaine_nom: Optional[str] = None
    chef_id: Optional[UUID] = None
    est_actif: bool
    date_creation: datetime
    date_modification: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ListeDepartements(BaseModel):
    departements: list[DepartementResponse]
    total: int


# ============ INVITATIONS ============

class InvitationCreate(BaseModel):
    email: str = Field(..., description="Email de l'invité")
    role: str
    domaine_id: Optional[UUID] = None
    departement_id: Optional[UUID] = None
    message: Optional[str] = None


class InvitationResponse(BaseModel):
    id: UUID
    email: str
    role: str
    domaine_id: Optional[UUID] = None
    departement_id: Optional[UUID] = None
    statut: str
    message: Optional[str] = None
    cree_par: UUID
    date_creation: datetime
    date_expiration: datetime
    date_acceptation: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ListeInvitations(BaseModel):
    invitations: list[InvitationResponse]
    total: int


# ============ EQUIPES ============

class EquipeBase(BaseModel):
    nom: str
    description: Optional[str] = None
    departement_id: UUID


class EquipeCreate(EquipeBase):
    chef_id: Optional[UUID] = None


class EquipeUpdate(BaseModel):
    nom: Optional[str] = None
    description: Optional[str] = None
    chef_id: Optional[UUID] = None
    est_actif: Optional[bool] = None


class EquipeResponse(EquipeBase):
    id: UUID
    departement_nom: Optional[str] = None
    chef_id: Optional[UUID] = None
    chef_nom: Optional[str] = None
    est_actif: bool
    date_creation: datetime
    date_modification: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ListeEquipes(BaseModel):
    equipes: list[EquipeResponse]
    total: int