# -*- coding: utf-8 -*-
"""Schémas Pydantic pour la Carte / Titre de Séjour.

Les champs correspondent DIRECTEMENT aux colonnes de la table `cartes_sejour`.
"""
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


StatutCarteSejour = Literal["en_attente", "approuve", "rejete", "expiree"]


class DonneesCarteSejourExtraites(BaseModel):
    """Données extraites d'une carte / titre de séjour."""
    type_titre: Optional[str] = None       # CARTE_SEJOUR / TITRE_SEJOUR / RECEPISSE / CARTE_RESIDENT
    numero_titre: Optional[str] = None
    categorie: Optional[str] = None

    nom_famille: Optional[str] = None
    prenoms: Optional[str] = None
    sexe: Optional[str] = None             # M / F
    date_naissance: Optional[str] = None
    lieu_naissance: Optional[str] = None
    nationalite: Optional[str] = None

    adresse: Optional[str] = None
    autorite_delivrance: Optional[str] = None
    pays_emetteur: Optional[str] = None

    date_delivrance: Optional[str] = None
    date_expiration: Optional[str] = None

    mrz_ligne_1: Optional[str] = None
    mrz_ligne_2: Optional[str] = None
    mrz_ligne_3: Optional[str] = None

    texte_brut: Optional[str] = None
    taux_confiance_moyen: Optional[float] = None


class ResultatOCRCarteSejour(BaseModel):
    """Résultat complet de l'OCR d'une carte de séjour."""
    succes: bool
    donnees: DonneesCarteSejourExtraites
    erreurs: list[str] = Field(default_factory=list)
    champs_extraits: int = 0
    temps_analyse_ms: Optional[int] = None


class ReponseUploadCarteSejour(BaseModel):
    """Réponse après upload d'une carte de séjour."""
    id: UUID
    statut: StatutCarteSejour
    resultat_ocr: ResultatOCRCarteSejour
    message: str


class VerificationCarteSejourDetail(BaseModel):
    """Détail d'une vérification de carte de séjour (historique)."""
    id: UUID
    utilisateur_id: UUID
    statut: StatutCarteSejour
    nom_fichier: str
    type_titre: Optional[str] = None
    numero_titre: Optional[str] = None
    nom_famille: Optional[str] = None
    prenoms: Optional[str] = None
    nationalite: Optional[str] = None
    date_naissance: Optional[str] = None
    date_delivrance: Optional[str] = None
    date_expiration: Optional[str] = None
    autorite_delivrance: Optional[str] = None
    taux_confiance_ocr: Optional[float] = None
    cree_le: datetime
    est_supprime: bool = False


class ListeVerificationsCarteSejour(BaseModel):
    """Liste des cartes de séjour scannées."""
    historique: list[VerificationCarteSejourDetail]
    total: int
