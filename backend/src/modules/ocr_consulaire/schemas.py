# -*- coding: utf-8 -*-
"""Schémas Pydantic pour la Carte d'Immatriculation Consulaire.

Les champs correspondent DIRECTEMENT aux colonnes de la table `cartes_consulaires`.
"""
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


StatutConsulaire = Literal["en_attente", "approuve", "rejete", "expiree"]


class DonneesConsulaireExtraites(BaseModel):
    """Données extraites d'une carte d'immatriculation consulaire."""
    numero_immatriculation_consulaire: Optional[str] = None
    numero_passeport: Optional[str] = None

    nom_famille: Optional[str] = None
    prenoms: Optional[str] = None
    date_naissance: Optional[str] = None
    lieu_naissance: Optional[str] = None
    nationalite: Optional[str] = None
    profession: Optional[str] = None
    situation_matrimoniale: Optional[str] = None  # CELIBATAIRE / MARIE / DIVORCE / VEUF

    adresse: Optional[str] = None
    poste_consulaire: Optional[str] = None
    pays_emetteur: Optional[str] = None

    personnes_a_charge: Optional[int] = None
    date_delivrance: Optional[str] = None
    date_expiration: Optional[str] = None

    texte_brut: Optional[str] = None
    taux_confiance_moyen: Optional[float] = None


class ResultatOCRConsulaire(BaseModel):
    """Résultat complet de l'OCR d'une carte consulaire."""
    succes: bool
    donnees: DonneesConsulaireExtraites
    erreurs: list[str] = Field(default_factory=list)
    champs_extraits: int = 0
    temps_analyse_ms: Optional[int] = None


class ReponseUploadConsulaire(BaseModel):
    """Réponse après upload d'une carte consulaire."""
    id: UUID
    statut: StatutConsulaire
    resultat_ocr: ResultatOCRConsulaire
    message: str


class VerificationConsulaireDetail(BaseModel):
    """Détail d'une vérification de carte consulaire (historique)."""
    id: UUID
    utilisateur_id: UUID
    statut: StatutConsulaire
    nom_fichier: str
    numero_immatriculation_consulaire: Optional[str] = None
    numero_passeport: Optional[str] = None
    nom_famille: Optional[str] = None
    prenoms: Optional[str] = None
    nationalite: Optional[str] = None
    poste_consulaire: Optional[str] = None
    date_delivrance: Optional[str] = None
    date_expiration: Optional[str] = None
    taux_confiance_ocr: Optional[float] = None
    cree_le: datetime
    est_supprime: bool = False


class ListeVerificationsConsulaire(BaseModel):
    """Liste des cartes consulaires scannées."""
    historique: list[VerificationConsulaireDetail]
    total: int
