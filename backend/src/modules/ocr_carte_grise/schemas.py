# -*- coding: utf-8 -*-
"""Schémas Pydantic pour la Carte Grise (certificat d'immatriculation).

Les noms de champs correspondent DIRECTEMENT aux colonnes de la table
`cartes_grises` : la réponse unifiée expose donc les champs de la table
sans traduction supplémentaire.
"""
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


StatutCarteGrise = Literal["en_attente", "approuve", "rejete", "expiree"]


class DonneesCarteGriseExtraites(BaseModel):
    """Données extraites d'un certificat d'immatriculation (carte grise)."""
    # --- Véhicule ---
    numero_immatriculation: Optional[str] = None
    numero_chassis: Optional[str] = None
    numero_moteur: Optional[str] = None
    marque: Optional[str] = None            # case D.1
    modele: Optional[str] = None            # case D.3
    genre: Optional[str] = None
    carrosserie: Optional[str] = None
    energie: Optional[str] = None
    puissance_fiscale_cv: Optional[int] = None   # case P.6
    nombre_places: Optional[int] = None          # case S.1
    poids_total_kg: Optional[int] = None         # case F.2
    date_premiere_mise_circulation: Optional[str] = None  # case B
    annee_vehicule: Optional[int] = None
    numero_formule: Optional[str] = None          # case E

    # --- Titulaire ---
    titulaire_nom: Optional[str] = None
    titulaire_prenoms: Optional[str] = None
    titulaire_adresse: Optional[str] = None

    # --- Document ---
    pays_emetteur: Optional[str] = None
    date_delivrance: Optional[str] = None
    date_expiration: Optional[str] = None

    # --- Métadonnées ---
    texte_brut: Optional[str] = None
    taux_confiance_moyen: Optional[float] = None


class ResultatOCRCarteGrise(BaseModel):
    """Résultat complet de l'OCR d'une carte grise."""
    succes: bool
    donnees: DonneesCarteGriseExtraites
    erreurs: list[str] = Field(default_factory=list)
    champs_extraits: int = 0
    temps_analyse_ms: Optional[int] = None


class ReponseUploadCarteGrise(BaseModel):
    """Réponse après upload d'une carte grise."""
    id: UUID
    statut: StatutCarteGrise
    resultat_ocr: ResultatOCRCarteGrise
    message: str


class VerificationCarteGriseDetail(BaseModel):
    """Détail d'une verification de carte grise (historique)."""
    id: UUID
    utilisateur_id: UUID
    statut: StatutCarteGrise
    nom_fichier: str
    numero_immatriculation: Optional[str] = None
    numero_chassis: Optional[str] = None
    marque: Optional[str] = None
    modele: Optional[str] = None
    energie: Optional[str] = None
    puissance_fiscale_cv: Optional[int] = None
    date_premiere_mise_circulation: Optional[str] = None
    titulaire_nom: Optional[str] = None
    titulaire_prenoms: Optional[str] = None
    date_expiration: Optional[str] = None
    taux_confiance_ocr: Optional[float] = None
    cree_le: datetime
    est_supprime: bool = False


class ListeVerificationsCarteGrise(BaseModel):
    """Liste des cartes grises scannées."""
    historique: list[VerificationCarteGriseDetail]
    total: int
