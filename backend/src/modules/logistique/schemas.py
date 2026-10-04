
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


# ─── Ticket (QR + numéro en clair) ───────────────────────────────────

class TicketResponse(BaseModel):
    id: UUID
    code_clair: str
    qr_token: str
    qr_code_url: Optional[str] = None
    type: str
    reference_id: Optional[UUID] = None
    voyage_id: Optional[UUID] = None
    statut: str
    nb_scans: int
    premier_scan_le: Optional[datetime] = None
    imprime_le: Optional[datetime] = None
    cree_le: datetime
    modifie_le: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# ─── Colis ───────────────────────────────────────────────────────────

class ColisCreate(BaseModel):
    destinataire_nom: str = Field(..., min_length=2, max_length=150)
    destinataire_tel: str = Field(..., min_length=6, max_length=30)
    # Expéditeur saisi au guichet (souvent un tiers sans compte DigiID).
    expediteur_nom: Optional[str] = Field(None, max_length=150)
    expediteur_tel: Optional[str] = Field(None, max_length=30)
    gare_depart_id: UUID
    gare_arrivee_id: UUID
    description: Optional[str] = Field(None, max_length=500)
    poids_kg: Optional[float] = Field(None, ge=0)
    valeur_fcfa: Optional[int] = Field(None, ge=0)
    frais_fcfa: int = Field(100, ge=0)
    # Si non fournis, l'expéditeur ET le receveur = utilisateur courant (guichet).
    expediteur_id: Optional[UUID] = None
    receveur_id: Optional[UUID] = None
    voyage_id: Optional[UUID] = None
    chauffeur_id: Optional[UUID] = None

    @model_validator(mode="after")
    def _gares_distinctes(self):
        if self.gare_depart_id == self.gare_arrivee_id:
            raise ValueError("Les gares de départ et d'arrivée doivent être différentes")
        return self


class ColisResponse(BaseModel):
    id: UUID
    ticket_id: Optional[UUID] = None
    code_clair: Optional[str] = None
    qr_token: Optional[str] = None
    qr_code_url: Optional[str] = None
    expediteur_id: Optional[UUID] = None
    destinataire_nom: str
    destinataire_tel: str
    description: Optional[str] = None
    poids_kg: Optional[float] = None
    valeur_fcfa: Optional[int] = None
    gare_depart_id: UUID
    gare_arrivee_id: UUID
    voyage_id: Optional[UUID] = None
    receveur_id: Optional[UUID] = None
    chauffeur_id: Optional[UUID] = None
    statut: str
    frais_fcfa: int
    livre_le: Optional[datetime] = None
    cree_le: datetime
    modifie_le: Optional[datetime] = None
    # Champs enrichis (noms lisibles)
    gare_depart_nom: Optional[str] = None
    gare_arrivee_nom: Optional[str] = None
    expediteur_nom: Optional[str] = None
    expediteur_tel: Optional[str] = None
    receveur_nom: Optional[str] = None
    chauffeur_nom: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class ColisEnregistre(BaseModel):
    """Réponse d'enregistrement d'un colis : le colis + son ticket (QR + code)."""
    colis: ColisResponse
    ticket: TicketResponse


# ─── Événements (timeline) ───────────────────────────────────────────

class ColisEvenementResponse(BaseModel):
    id: UUID
    colis_id: UUID
    type_evenement: str
    acteur_id: Optional[UUID] = None
    acteur_nom: Optional[str] = None
    gare_id: Optional[UUID] = None
    localisation: Optional[str] = None
    horodatage: datetime
    idempotency_key: Optional[str] = None
    synchro_le: Optional[datetime] = None
    cree_le: datetime
    model_config = ConfigDict(from_attributes=True)


# ─── Scan ────────────────────────────────────────────────────────────

TypeEvenementScan = Literal["livraison", "depart", "mise_en_transit", "arrivee"]


class ScanCreate(BaseModel):
    """Payload d'un scan : soit un token QR, soit le code clair (repli manuel)."""
    token: Optional[str] = Field(None, max_length=200)
    code_clair: Optional[str] = Field(None, max_length=40)
    type_evenement: TypeEvenementScan = "livraison"
    gare_id: Optional[UUID] = None
    voyage_id: Optional[UUID] = None
    localisation: Optional[str] = Field(None, max_length=200)
    idempotency_key: Optional[str] = Field(None, max_length=120)
    horodatage: Optional[datetime] = None

    @model_validator(mode="after")
    def _cible_obligatoire(self):
        if not self.token and not self.code_clair:
            raise ValueError("Fournir soit 'token', soit 'code_clair'")
        return self


class ScanResponse(BaseModel):
    succes: bool
    deja_livre: bool = False
    deja_scanne: bool = False
    message: str
    statut_colis: Optional[str] = None
    colis: Optional[ColisResponse] = None
    ticket: Optional[TicketResponse] = None
    evenement: Optional[ColisEvenementResponse] = None
