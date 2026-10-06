# -*- coding: utf-8 -*-
"""
Schémas Pydantic du module Identité DigiID.

Trois usages concrets sur le terrain :

1. **Carte citoyenne** : le citoyen affiche un QR **durable** (sa carte DigiID).
   Le guichet le scanne → la fiche est pré-remplie (nom, téléphone, ville,
   adresse) → plus de ressaisie, plus d'erreur de numéro de téléphone (ce qui
   faisait échouer les SMS de suivi).

2. **Profil logistique** : le chauffeur/receveur déclare sa pièce d'identité,
   son permis et son véhicule ; un gérant de gare valide le dossier.

3. **Manifeste & voyages du citoyen** : le chauffeur voit d'un écran ce qu'il
   transporte ; le citoyen retrouve ses envois et les voyages de ses proches.
"""
from datetime import date, datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ─── Carte citoyenne (QR durable) ────────────────────────────────────

class CarteDigiIDResponse(BaseModel):
    """Contenu de la carte DigiID affichée par le citoyen."""
    utilisateur_id: UUID
    digiid_public: Optional[str] = None
    nom_complet: str
    telephone: Optional[str] = None
    ville: Optional[str] = None
    adresse: Optional[str] = None
    role: str
    # Jeton durable + URL à encoder dans le QR (page frontend navigable).
    qr_token: str
    qr_code_url: str
    # Le jeton existe-t-il déjà (True) ou vient-il d'être créé (False) ?
    deja_genere: bool = True
    model_config = ConfigDict(from_attributes=True)


class RechercheDigiIDRequest(BaseModel):
    """Recherche guichet : le client présente sa carte DigiID."""
    # ``digiid`` accepte : l'identifiant public (12 caractères), le téléphone
    # complet ou l'URL complète du QR scannée (``?token=...``).
    digiid: str = Field(..., min_length=3, max_length=300)


class ContactDigiIDResponse(BaseModel):
    """Fiche minimale renvoyée au guichet pour pré-remplir un formulaire.

    Aucune donnée sensible n'est exposée : ni email, ni photo, ni documents.
    """
    utilisateur_id: UUID
    digiid_public: Optional[str] = None
    nom_complet: str
    telephone: Optional[str] = None
    ville: Optional[str] = None
    adresse: Optional[str] = None
    role: str
    # Origine de la correspondance : utile pour la traçabilité du guichet.
    # (Pas de recherche par téléphone : les numéros sont chiffrés au repos —
    # le guichet scanne donc le QR ou saisit le DigiID public.)
    correspondance: Literal["digiid", "qr"] = "digiid"


# ─── Profil logistique (dossier professionnel) ───────────────────────

class ProfilLogistiqueCreate(BaseModel):
    type_profil: Literal["chauffeur", "receveur"]
    type_piece: Optional[str] = Field(None, max_length=30)
    numero_piece: Optional[str] = Field(None, max_length=60)
    permis_numero: Optional[str] = Field(None, max_length=60)
    permis_categorie: Optional[str] = Field(None, max_length=30)
    permis_expiration: Optional[date] = None
    vehicule_immatriculation: Optional[str] = Field(None, max_length=30)
    vehicule_marque: Optional[str] = Field(None, max_length=60)
    vehicule_modele: Optional[str] = Field(None, max_length=60)
    vehicule_capacite: Optional[int] = Field(None, ge=0, le=200)


class ProfilLogistiqueResponse(BaseModel):
    id: UUID
    utilisateur_id: UUID
    identifiant_public: str
    type_profil: str
    type_piece: Optional[str] = None
    numero_piece: Optional[str] = None
    piece_verifiee: bool
    permis_numero: Optional[str] = None
    permis_categorie: Optional[str] = None
    permis_expiration: Optional[date] = None
    permis_verifie: bool
    vehicule_immatriculation: Optional[str] = None
    vehicule_marque: Optional[str] = None
    vehicule_modele: Optional[str] = None
    vehicule_capacite: Optional[int] = None
    photo_verifiee: bool
    statut_verification: str
    est_verifie: bool
    verifie_le: Optional[datetime] = None
    verifie_par_id: Optional[UUID] = None
    notes: Optional[str] = None
    cree_le: datetime
    modifie_le: Optional[datetime] = None
    # Enrichissements (non persistés)
    utilisateur_nom: Optional[str] = None
    verifie_par_nom: Optional[str] = None
    # Champs encore manquants pour obtenir la validation (pilotage du terrain).
    champs_manquants: list[str] = []
    model_config = ConfigDict(from_attributes=True)


class VerificationProfilRequest(BaseModel):
    """Validation métier d'un dossier par un gérant de gare / administrateur."""
    piece_verifiee: bool = False
    permis_verifie: bool = False
    photo_verifiee: bool = False
    notes: Optional[str] = Field(None, max_length=1000)


# ─── Manifeste du chauffeur ──────────────────────────────────────────

class LigneManifeste(BaseModel):
    """Une ligne du manifeste : un colis ou un passager."""
    id: UUID
    type: Literal["colis", "passager"]
    code: str
    libelle: str                     # destinataire (colis) ou nom du passager
    contact_masque: Optional[str] = None
    gare_depart_nom: Optional[str] = None
    gare_arrivee_nom: Optional[str] = None
    statut: str
    nombre_bagages: int = 1
    nombre_articles: int = 1
    mode_enregistrement: str = "guichet"
    enregistre_le: Optional[datetime] = None


class VoyageChauffeurResponse(BaseModel):
    """Voyage affecté à un chauffeur, avec les volumes à transporter."""
    id: UUID
    date_depart: Optional[datetime] = None
    date_arrivee: Optional[datetime] = None
    statut: str
    vehicule_immatriculation: Optional[str] = None
    gare_depart_nom: Optional[str] = None
    gare_arrivee_nom: Optional[str] = None
    nb_colis: int = 0
    nb_passagers: int = 0
    model_config = ConfigDict(from_attributes=True)


class ManifesteVoyageResponse(BaseModel):
    voyage_id: UUID
    date_depart: Optional[datetime] = None
    statut: str
    vehicule_immatriculation: Optional[str] = None
    gare_depart_nom: Optional[str] = None
    gare_arrivee_nom: Optional[str] = None
    nb_colis: int = 0
    nb_passagers: int = 0
    nb_bagages: int = 0
    colis: list[LigneManifeste] = []
    passagers: list[LigneManifeste] = []


# ─── Voyages du citoyen (ses envois + les voyages de ses proches) ────

class VoyageCitoyen(BaseModel):
    id: UUID
    type: Literal["colis", "passager"]
    code: str
    libelle: str
    statut: str
    gare_depart_nom: Optional[str] = None
    gare_arrivee_nom: Optional[str] = None
    date_depart: Optional[datetime] = None
    vehicule_immatriculation: Optional[str] = None
    chauffeur_nom: Optional[str] = None
    nombre_bagages: int = 1
    lien: Optional[str] = None


class MesVoyagesResponse(BaseModel):
    """Vue « mes voyages » du citoyen : ses envois et les passagers qu'il suit."""
    colis: list[VoyageCitoyen] = []
    passagers: list[VoyageCitoyen] = []
