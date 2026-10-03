
# -*- coding: utf-8 -*-
"""Schémas Pydantic du domaine logistique (référentiel)."""
from datetime import datetime
from typing import Generic, Literal, Optional, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

T = TypeVar("T")


class ReponseListe(BaseModel, Generic[T]):
    """Réponse paginée générique."""
    elements: list[T]
    total: int
    page: int
    par_page: int


# ─── Gare ────────────────────────────────────────────────────────────

class GareBase(BaseModel):
    nom: str = Field(..., min_length=2, max_length=150)
    code: str = Field(..., min_length=2, max_length=20, pattern=r"^[A-Z0-9-]+$")
    ville: str = Field(..., min_length=2, max_length=100)
    domain_id: Optional[UUID] = None
    actif: bool = True

    @field_validator("code")
    @classmethod
    def _normaliser_code(cls, v: str) -> str:
        return v.upper().strip()


class GareCreate(GareBase):
    pass


class GareUpdate(BaseModel):
    nom: Optional[str] = Field(None, min_length=2, max_length=150)
    ville: Optional[str] = Field(None, min_length=2, max_length=100)
    domain_id: Optional[UUID] = None
    actif: Optional[bool] = None


class GareResponse(GareBase):
    id: UUID
    cree_le: datetime
    modifie_le: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# ─── Ligne ───────────────────────────────────────────────────────────

class LigneCreate(BaseModel):
    gare_depart_id: UUID
    gare_arrivee_id: UUID
    distance_km: Optional[float] = Field(None, ge=0)
    duree_min: Optional[int] = Field(None, ge=0)
    actif: bool = True

    @model_validator(mode="after")
    def _gares_distinctes(self):
        if self.gare_depart_id == self.gare_arrivee_id:
            raise ValueError("Les gares de départ et d'arrivée doivent être différentes")
        return self


class LigneUpdate(BaseModel):
    gare_depart_id: Optional[UUID] = None
    gare_arrivee_id: Optional[UUID] = None
    distance_km: Optional[float] = Field(None, ge=0)
    duree_min: Optional[int] = Field(None, ge=0)
    actif: Optional[bool] = None


class LigneResponse(BaseModel):
    id: UUID
    gare_depart_id: UUID
    gare_arrivee_id: UUID
    distance_km: Optional[float] = None
    duree_min: Optional[int] = None
    actif: bool
    cree_le: datetime
    modifie_le: Optional[datetime] = None
    gare_depart_nom: Optional[str] = None
    gare_arrivee_nom: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# ─── Vehicule ────────────────────────────────────────────────────────

class VehiculeCreate(BaseModel):
    immatriculation: str = Field(..., min_length=2, max_length=30)
    marque: Optional[str] = Field(None, max_length=100)
    capacite: Optional[int] = Field(None, ge=0)
    gare_id: Optional[UUID] = None
    actif: bool = True

    @field_validator("immatriculation")
    @classmethod
    def _normaliser_immat(cls, v: str) -> str:
        return v.upper().strip()


class VehiculeUpdate(BaseModel):
    marque: Optional[str] = Field(None, max_length=100)
    capacite: Optional[int] = Field(None, ge=0)
    gare_id: Optional[UUID] = None
    actif: Optional[bool] = None


class VehiculeResponse(BaseModel):
    id: UUID
    immatriculation: str
    marque: Optional[str] = None
    capacite: Optional[int] = None
    gare_id: Optional[UUID] = None
    gare_nom: Optional[str] = None
    actif: bool
    cree_le: datetime
    modifie_le: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# ─── Voyage ──────────────────────────────────────────────────────────

StatutVoyage = Literal["planifie", "en_cours", "termine", "annule"]


class VoyageCreate(BaseModel):
    ligne_id: UUID
    vehicule_id: UUID
    chauffeur_id: Optional[UUID] = None
    date_depart: datetime
    date_arrivee: Optional[datetime] = None
    statut: StatutVoyage = "planifie"


class VoyageUpdate(BaseModel):
    vehicule_id: Optional[UUID] = None
    chauffeur_id: Optional[UUID] = None
    date_depart: Optional[datetime] = None
    date_arrivee: Optional[datetime] = None
    statut: Optional[StatutVoyage] = None


class VoyageResponse(BaseModel):
    id: UUID
    ligne_id: UUID
    vehicule_id: UUID
    chauffeur_id: Optional[UUID] = None
    date_depart: datetime
    date_arrivee: Optional[datetime] = None
    statut: str
    cree_le: datetime
    modifie_le: Optional[datetime] = None
    vehicule_immatriculation: Optional[str] = None
    chauffeur_nom: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# ─── Acteur logistique ───────────────────────────────────────────────

RoleActeur = Literal["receveur", "chauffeur", "gerant_gare", "commercant"]


class ActeurCreate(BaseModel):
    utilisateur_id: UUID
    role: RoleActeur
    gare_id: UUID
    numero_licence: Optional[str] = Field(None, max_length=50)
    actif: bool = True


class ActeurUpdate(BaseModel):
    role: Optional[RoleActeur] = None
    gare_id: Optional[UUID] = None
    numero_licence: Optional[str] = Field(None, max_length=50)
    actif: Optional[bool] = None


class ActeurResponse(BaseModel):
    id: UUID
    utilisateur_id: UUID
    role: str
    gare_id: UUID
    numero_licence: Optional[str] = None
    actif: bool
    cree_le: datetime
    modifie_le: Optional[datetime] = None
    utilisateur_nom: Optional[str] = None
    gare_nom: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)
