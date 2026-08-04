# -*- coding: utf-8 -*-
"""Schémas Pydantic pour l'Assurance Automobile."""
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


StatutAssurance = Literal["en_attente", "approuve", "rejete", "expiree"]


class DonneesAssuranceExtraites(BaseModel):
    """Données extraites d'une carte verte ou attestation d'assurance."""
    # --- Assureur ---
    compagnie_assurance: Optional[str] = None
    numero_contrat: Optional[str] = None
    numero_police: Optional[str] = None
    
    # --- Véhicule assuré ---
    immatriculation_vehicule: Optional[str] = None
    marque_vehicule: Optional[str] = None
    modele_vehicule: Optional[str] = None
    annee_vehicule: Optional[str] = None
    type_vehicule: Optional[str] = None  # "Tourisme", "Utilitaire", etc.
    
    # --- Assuré ---
    nom_assure: Optional[str] = None
    prenoms_assure: Optional[str] = None
    date_naissance: Optional[str] = None
    lieu_naissance: Optional[str] = None
    
    # --- Couverture ---
    type_couverture: Optional[str] = None  # "Responsabilité Civile", "Tous risques"
    date_effet: Optional[str] = None
    date_expiration: Optional[str] = None
    pays_couverture: Optional[str] = None
    
    # --- Métadonnées ---
    texte_brut: Optional[str] = None
    taux_confiance_moyen: Optional[float] = None


class ResultatOCRAssurance(BaseModel):
    """Résultat complet de l'OCR d'une assurance."""
    succes: bool
    donnees: DonneesAssuranceExtraites
    erreurs: list[str] = Field(default_factory=list)
    champs_extraits: int = 0
    temps_analyse_ms: Optional[int] = None


class ReponseUploadAssurance(BaseModel):
    """Réponse après upload d'un document d'assurance."""
    id: UUID
    statut: StatutAssurance
    resultat_ocr: ResultatOCRAssurance
    message: str


class VerificationAssuranceDetail(BaseModel):
    """Détail d'une vérification d'assurance."""
    id: UUID
    utilisateur_id: UUID
    statut: StatutAssurance
    nom_fichier: str
    # Données extraites
    nom_famille: Optional[str] = None
    prenoms: Optional[str] = None
    date_naissance: Optional[str] = None
    lieu_naissance: Optional[str] = None
    compagnie_assurance: Optional[str] = None
    numero_contrat: Optional[str] = None
    immatriculation_vehicule: Optional[str] = None
    marque_vehicule: Optional[str] = None
    modele_vehicule: Optional[str] = None
    date_effet: Optional[str] = None
    date_expiration: Optional[str] = None

    # Métadonnées
    taux_confiance_ocr: Optional[float] = None
    cree_le: datetime
    est_supprime: bool = False


class ListeVerificationsAssurance(BaseModel):
    """Liste des vérifications d'assurance."""
    historique: list[VerificationAssuranceDetail]
    total: int


class AssuranceModification(BaseModel):
    """Champs NON SENSIBLES modifiables d'une assurance (whitelist stricte).

    Seuls les champs liés au véhicule (marque / modèle) sont corrigeables.
    L'identité (nom, prénom, dates, N° contrat) reste verrouillée pour
    garantir l'authenticité du document.
    """
    marque_vehicule: Optional[str] = None
    modele_vehicule: Optional[str] = None