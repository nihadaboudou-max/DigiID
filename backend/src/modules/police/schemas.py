"""Schémas Pydantic pour le module Police — version complète."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class VerificationPoliceCreate(BaseModel):
    personne_digiid: str
    personne_nom: Optional[str] = None
    personne_email: Optional[str] = None
    personne_telephone: Optional[str] = None
    type_verification: str = "identite"
    motif_verification: Optional[str] = None
    notes: Optional[str] = None
    localisation_lat: Optional[float] = None
    localisation_lng: Optional[float] = None
    localisation_adresse: Optional[str] = None


class VerificationPoliceResponse(BaseModel):
    id: UUID
    officier_id: UUID
    personne_digiid: str
    personne_nom: Optional[str] = None
    personne_email: Optional[str] = None
    personne_telephone: Optional[str] = None
    type_verification: str
    motif_verification: Optional[str] = None
    resultat: Optional[str] = None
    notes: Optional[str] = None
    date_verification: datetime
    est_signalement_fraude: bool
    localisation_lat: Optional[float] = None
    localisation_lng: Optional[float] = None
    localisation_adresse: Optional[str] = None

    model_config = {"from_attributes": True}


class PersonneRechercheeResponse(BaseModel):
    digiid: str
    nom: str
    email: Optional[str] = None
    telephone: Optional[str] = None
    score: int
    est_actif: bool
    est_verifie: bool
    ville: str = ""
    pays: str = ""
    photo_url: Optional[str] = None
    numero_cni: Optional[str] = None
    a_permis: bool = False
    a_assurance: bool = False
    score_similarite: float = 0.0


class DocumentProfil(BaseModel):
    type_document: str
    numero: Optional[str] = None
    nom_complet: Optional[str] = None
    date_expiration: Optional[str] = None
    est_valide: bool = True
    photo_url: Optional[str] = None


class SignalementProfil(BaseModel):
    id: UUID
    officier_id: UUID
    personne_digiid: str
    motif: str
    description: Optional[str] = None
    statut: str
    priorite: str = "moyenne"
    date_signalement: datetime
    date_traitement: Optional[datetime] = None


class VerificationProfil(BaseModel):
    id: UUID
    officier_nom: Optional[str] = None
    type_verification: str
    resultat: Optional[str] = None
    motif_verification: Optional[str] = None
    date_verification: datetime
    notes: Optional[str] = None


class NoteProfil(BaseModel):
    id: UUID
    officier_id: UUID
    personne_digiid: str
    titre: str
    contenu: Optional[str] = None
    categorie: str = "general"
    est_important: bool = False
    est_partagee: bool = False
    date_creation: datetime
    date_modification: Optional[datetime] = None


class ProfilPersonneResponse(BaseModel):
    digiid: str
    nom: str
    email: Optional[str] = None
    telephone: Optional[str] = None
    ville: str = ""
    pays: str = ""
    photo_url: Optional[str] = None
    role: str = "citoyen"
    score: int = 0
    est_actif: bool = True
    est_email_verifie: bool = False
    est_visage_verifie: bool = False
    est_cni_verifiee: bool = False
    date_inscription: Optional[datetime] = None
    documents: list[DocumentProfil] = []
    signalements: list[SignalementProfil] = []
    verifications_precedentes: list[VerificationProfil] = []
    notes_internes: list[NoteProfil] = []


class SignalementFraudeCreate(BaseModel):
    personne_digiid: str
    motif: str = Field(..., min_length=10)
    description: Optional[str] = None
    priorite: str = "moyenne"


class TraiterSignalement(BaseModel):
    statut: str
    notes_traitement: Optional[str] = None


class SignalementFraudeResponse(BaseModel):
    id: UUID
    officier_id: UUID
    personne_digiid: str
    motif: str
    description: Optional[str] = None
    statut: str
    priorite: str = "moyenne"
    notes_traitement: Optional[str] = None
    traite_par_id: Optional[UUID] = None
    date_signalement: datetime
    date_traitement: Optional[datetime] = None

    model_config = {"from_attributes": True}


class NoteInterneCreate(BaseModel):
    personne_digiid: str
    titre: str = Field(..., min_length=2)
    contenu: Optional[str] = None
    categorie: str = "general"
    est_important: bool = False
    est_partagee: bool = False


class NoteInterneUpdate(BaseModel):
    titre: Optional[str] = None
    contenu: Optional[str] = None
    categorie: Optional[str] = None
    est_important: Optional[bool] = None
    est_partagee: Optional[bool] = None


class NoteInterneResponse(BaseModel):
    id: UUID
    officier_id: UUID
    personne_digiid: str
    titre: str
    contenu: Optional[str] = None
    categorie: str = "general"
    est_important: bool = False
    est_partagee: bool = False
    date_creation: datetime
    date_modification: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AlertePoliceCreate(BaseModel):
    type_alerte: str
    titre: str = Field(..., min_length=2)
    message: str = Field(..., min_length=2)
    niveau: str = "info"
    donnees_liees: Optional[dict[str, Any]] = None


class AlertePoliceResponse(BaseModel):
    id: UUID
    officier_id: UUID
    type_alerte: str
    titre: str
    message: str
    niveau: str = "info"
    est_lue: bool = False
    est_active: bool = True
    donnees_liees: Optional[dict[str, Any]] = None
    date_creation: datetime
    date_lecture: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AlerteMarquerLue(BaseModel):
    est_lue: bool = True


class StatistiquesPoliceResponse(BaseModel):
    total_verifications: int = 0
    verifications_aujourdhui: int = 0
    total_signalements: int = 0
    signalements_en_cours: int = 0
    signalements_traites: int = 0
    alertes_non_lues: int = 0
    notes_total: int = 0
    personnes_recherchees: int = 0
    taux_confirmation: Optional[float] = None
    verification_recents: list[dict[str, Any]] = []
    signalements_recents: list[dict[str, Any]] = []
    alertes_recents: list[dict[str, Any]] = []
    activite_dernieres_heures: list[dict[str, Any]] = []


class PointCarteResponse(BaseModel):
    lat: float
    lng: float
    adresse: Optional[str] = None
    titre: str
    type: str
    date: Optional[datetime] = None
    verification_id: UUID


class PointsCarteResponse(BaseModel):
    points: list[PointCarteResponse] = []
    total: int = 0
    centre_lat: Optional[float] = None
    centre_lng: Optional[float] = None


class ScanQRResponse(BaseModel):
    digiid: str
    nom: str
    email: Optional[str] = None
    photo_url: Optional[str] = None
    est_actif: bool
    est_verifie: bool
    documents: list[dict[str, Any]] = []


class HistoriqueResponse(BaseModel):
    verifications: Optional[list[dict[str, Any]]] = None
    signalements: Optional[list[dict[str, Any]]] = None
    recherches: Optional[list[dict[str, Any]]] = None
    total_verifications: Optional[int] = None
    total_signalements: Optional[int] = None
    total_recherches: Optional[int] = None


class RapportResponse(BaseModel):
    officier_id: str
    date_generation: str
    periode: dict[str, Any] = {}
    donnees: dict[str, Any] = {}


class ComparaisonPhotosResponse(BaseModel):
    score_similarite: float
    est_compatible: bool
    seuil_requis: float = 0.75
    temps_analyse_ms: float = 0
    details: dict[str, Any] = {}


class RechercheQuery(BaseModel):
    query: str = Field(..., min_length=2)
    type_recherche: str = "tout"
    filtre_statut: Optional[str] = None
    filtre_score_min: Optional[int] = None
    filtre_score_max: Optional[int] = None
    filtre_ville: Optional[str] = None
    limite: int = 20
    page: int = 1
