# -*- coding: utf-8 -*-
"""Schémas Pydantic pour le Passeport.

Les champs correspondent DIRECTEMENT aux colonnes de la table `passeports`.
"""
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


StatutPasseport = Literal["en_attente", "approuve", "rejete", "expiree"]


class DonneesPasseportExtraites(BaseModel):
    """Données extraites d'un passeport (MRZ TD3 + repli texte)."""
    # --- Identification du titre ---
    numero_passeport: Optional[str] = None
    type_passeport: Optional[str] = None  # ORDINAIRE / DIPLOMATIQUE / SERVICE

    # --- Identité du titulaire ---
    nom_famille: Optional[str] = None
    prenoms: Optional[str] = None
    sexe: Optional[str] = None  # M / F / non_detecte
    date_naissance: Optional[str] = None
    lieu_naissance: Optional[str] = None
    nationalite: Optional[str] = None

    # --- Émission ---
    autorite_delivrance: Optional[str] = None
    pays_emetteur: Optional[str] = None
    date_delivrance: Optional[str] = None
    date_expiration: Optional[str] = None

    # --- MRZ & métadonnées ---
    mrz_ligne_1: Optional[str] = None
    mrz_ligne_2: Optional[str] = None
    mrz_valide: bool = False
    texte_brut: Optional[str] = None
    taux_confiance_moyen: Optional[float] = None


class ResultatOCRPasseport(BaseModel):
    """Résultat complet de l'OCR d'un passeport."""
    succes: bool
    donnees: DonneesPasseportExtraites
    erreurs: list[str] = Field(default_factory=list)
    champs_extraits: int = 0
    temps_analyse_ms: Optional[int] = None


class ReponseUploadPasseport(BaseModel):
    """Réponse après upload d'un passeport."""
    id: UUID
    statut: StatutPasseport
    resultat_ocr: ResultatOCRPasseport
    message: str


class VerificationPasseportDetail(BaseModel):
    """Détail d'une vérification de passeport (historique)."""
    id: UUID
    utilisateur_id: UUID
    statut: StatutPasseport
    nom_fichier: str
    numero_passeport: Optional[str] = None
    type_passeport: Optional[str] = None
    nom_famille: Optional[str] = None
    prenoms: Optional[str] = None
    sexe: Optional[str] = None
    nationalite: Optional[str] = None
    pays_emetteur: Optional[str] = None
    date_delivrance: Optional[str] = None
    date_expiration: Optional[str] = None
    mrz_valide: bool = False
    taux_confiance_ocr: Optional[float] = None
    cree_le: datetime
    est_supprime: bool = False


class ListeVerificationsPasseport(BaseModel):
    """Liste des passeports scannés."""
    historique: list[VerificationPasseportDetail]
    total: int
