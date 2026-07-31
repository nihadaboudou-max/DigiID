# -*- coding: utf-8 -*-
"""Schémas Pydantic pour le Permis de Conduire."""
from datetime import date, datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


StatutPermis = Literal["en_attente", "approuve", "rejete"]
CategoriePermis = Literal["A", "B", "C", "D", "E", "F", "G"]


class DonneesPermisExtraites(BaseModel):
    """Données extraites d'un permis de conduire."""
    # --- Identité du titulaire ---
    nom_famille: Optional[str] = None
    prenoms: Optional[str] = None
    date_naissance: Optional[str] = None
    lieu_naissance: Optional[str] = None
    
    # --- Données du permis ---
    numero_permis: Optional[str] = None
    categories: list[str] = Field(default_factory=list)
    date_premiere_delivrance: Optional[str] = None
    date_delivrance: Optional[str] = None
    date_expiration: Optional[str] = None
    autorite_delivrance: Optional[str] = None
    pays_emetteur: Optional[str] = None
    
    # --- MRZ & Métadonnées ---
    mrz_ligne_1: Optional[str] = None
    mrz_ligne_2: Optional[str] = None
    texte_brut: Optional[str] = None
    taux_confiance_moyen: Optional[float] = None


class ResultatOCRPermis(BaseModel):
    """Résultat complet de l'OCR d'un permis."""
    succes: bool
    donnees: DonneesPermisExtraites
    erreurs: list[str] = Field(default_factory=list)
    champs_extraits: int = 0
    temps_analyse_ms: Optional[int] = None


class ValidationPermisResultat(BaseModel):
    """Résultat de la validation du permis."""
    est_valide: bool
    scores_validation: dict[str, bool] = Field(default_factory=dict)
    message: str


class ReponseUploadPermis(BaseModel):
    """Réponse après upload d'un permis."""
    id: UUID
    statut: StatutPermis
    resultat_ocr: ResultatOCRPermis
    message: str


class VerificationPermisDetail(BaseModel):
    """Détail d'une vérification de permis."""
    id: UUID
    utilisateur_id: UUID
    statut: StatutPermis
    face: Literal["recto", "verso"]
    nom_fichier: str
    
    # Données extraites
    nom_famille: Optional[str] = None
    prenoms: Optional[str] = None
    numero_permis: Optional[str] = None
    categories: list[str] = Field(default_factory=list)
    date_delivrance: Optional[str] = None
    date_expiration: Optional[str] = None
    
    # Métadonnées
    taux_confiance_ocr: Optional[float] = None
    cree_le: datetime
    est_supprime: bool = False


class ListeVerificationsPermis(BaseModel):
    """Liste des vérifications de permis."""
    historique: list[VerificationPermisDetail]
    total: int