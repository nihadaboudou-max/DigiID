# -*- coding: utf-8 -*-
"""Schémas Pydantic pour le Certificat d'Identification Personnelle (CIP)."""
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


StatutCIP = Literal["en_attente", "approuve", "rejete", "expiree"]


class DonneesCIPExtraites(BaseModel):
    """Données extraites d'un CIP béninois."""
    npi: Optional[str] = None
    numero_document: Optional[str] = None  # alias du NPI (réponse unifiée)
    numero_serie: Optional[str] = None

    nom_famille: Optional[str] = None
    prenoms: Optional[str] = None
    date_naissance: Optional[str] = None
    lieu_naissance: Optional[str] = None
    nationalite: Optional[str] = None
    telephone: Optional[str] = None

    adresse: Optional[str] = None
    commune: Optional[str] = None
    arrondissement: Optional[str] = None
    quartier: Optional[str] = None

    nom_pere: Optional[str] = None
    nom_mere: Optional[str] = None

    pays_emetteur: Optional[str] = "Bénin"
    date_delivrance: Optional[str] = None
    date_expiration: Optional[str] = None

    qr_code_detecte: bool = False
    qr_code_contenu: Optional[str] = None
    embedding_visage_present: bool = False

    texte_brut: Optional[str] = None
    taux_confiance_moyen: Optional[float] = None


class ResultatOCRCIP(BaseModel):
    """Résultat OCR complet d'un CIP."""
    succes: bool
    donnees: DonneesCIPExtraites
    erreurs: list[str] = Field(default_factory=list)
    champs_extraits: int = 0
    temps_analyse_ms: Optional[int] = None


class ReponseUploadCIP(BaseModel):
    """Réponse après upload d'un CIP."""
    id: UUID
    statut: StatutCIP
    resultat_ocr: ResultatOCRCIP
    message: str


class VerificationCIPDetail(BaseModel):
    """Détail d'une vérification CIP (historique)."""
    id: UUID
    utilisateur_id: UUID
    statut: StatutCIP
    nom_fichier: str
    npi: Optional[str] = None
    numero_document: Optional[str] = None
    nom_famille: Optional[str] = None
    prenoms: Optional[str] = None
    nationalite: Optional[str] = None
    date_delivrance: Optional[str] = None
    date_expiration: Optional[str] = None
    qr_code_detecte: Optional[bool] = None
    taux_confiance_ocr: Optional[float] = None
    cree_le: datetime
    est_supprime: bool = False


class ListeVerificationsCIP(BaseModel):
    """Liste des CIP scannés."""
    historique: list[VerificationCIPDetail]
    total: int
