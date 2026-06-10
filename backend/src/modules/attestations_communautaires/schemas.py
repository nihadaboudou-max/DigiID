# -*- coding: utf-8 -*-
"""
Schémas Pydantic du module Attestations Communautaires — Étape 4.

Définit les contrats de données pour :
  - Création d'une attestation (requête)
  - Détail d'une attestation (réponse)
  - Liste d'attestations (réponse)
  - Statistiques d'attestation (réponse)
  - Décision (approbation/refus) d'une attestation (requête)
"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ============================================================================
# Énumérations (constantes)
# ============================================================================

TYPES_ATTESTATION = [
    "identite",      # Confirmation d'identité et de connaissance réelle
    "competence",    # Certificat de compétence professionnelle
    "moralite",      # Attestation de bonne moralité
    "residence",     # Confirmation d'adresse de résidence
    "activite",      # Confirmation d'activité/emploi
    "personnalise",  # Attestation personnalisée
]

STATUTS_ATTESTATION = [
    "EN_ATTENTE",    # En attente de décision par l'attesté
    "APPROUVEE",     # Approuvée par l'attesté
    "REFUSEE",       # Refusée par l'attesté
    "EXPIREE",       # Expirée (1 an après approbation)
]

LIENS_NATURE = [
    "famille",       # Lien familial
    "ami",           # Ami proche
    "collegue",      # Collègue de travail
    "voisin",        # Voisinage
    "associatif",    # Membre d'une même association
    "religieux",     # Membre d'une même communauté religieuse
    "professionnel", # Relation professionnelle
    "academique",    # Relation académique/études
    "autre",         # Autre type de relation
]


# ============================================================================
# Requêtes
# ============================================================================

class CreationAttestation(BaseModel):
    """
    Requête de création d'une nouvelle attestation communautaire.
    """
    atteste_digiid: str = Field(
        ...,
        min_length=8,
        max_length=50,
        description="DigiID public de l'utilisateur à attester (ex: DIGIID-A1B2C3D4)",
        examples=["DIGIID-A1B2C3D4"],
    )
    type_attestation: str = Field(
        default="identite",
        description=f"Type d'attestation. Valeurs possibles : {TYPES_ATTESTATION}",
        examples=["identite"],
    )
    titre: str = Field(
        ...,
        min_length=3,
        max_length=200,
        description="Titre court et descriptif de l'attestation",
        examples=["Attestation de connaissance - Jean Dupont"],
    )
    description: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="Description détaillée de l'attestation (contexte, raison)",
        examples=["Je confirme connaître Jean Dupont depuis 5 ans. C'est une personne de confiance."],
    )
    forces: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Forces et qualités observées chez la personne attestée",
        examples=["Personne intègre, fiable, ponctuelle."],
    )
    lien_connu_depuis: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Depuis quand connaissez-vous cette personne ?",
        examples=["5 ans", "enfance", "depuis 2019"],
    )
    lien_nature: Optional[str] = Field(
        default=None,
        description=f"Nature du lien. Valeurs : {LIENS_NATURE}",
        examples=["collegue"],
    )
    poids_score: float = Field(
        default=5.0,
        ge=1.0,
        le=20.0,
        description="Points de score attribués si l'attestation est approuvée (1-20)",
    )
    est_visible_public: bool = Field(
        default=False,
        description="Rendre cette attestation visible sur le profil public",
    )

    @field_validator("type_attestation")
    @classmethod
    def valider_type(cls, v: str) -> str:
        """Valide que le type d'attestation est autorisé."""
        v_lower = v.lower()
        if v_lower not in TYPES_ATTESTATION:
            raise ValueError(
                f"Type d'attestation invalide. Choisir parmi : {TYPES_ATTESTATION}"
            )
        return v_lower

    @field_validator("lien_nature")
    @classmethod
    def valider_lien(cls, v: Optional[str]) -> Optional[str]:
        """Valide que la nature du lien est autorisée."""
        if v is not None and v.lower() not in LIENS_NATURE:
            raise ValueError(
                f"Nature du lien invalide. Choisir parmi : {LIENS_NATURE}"
            )
        return v.lower() if v else v


class DecisionAttestation(BaseModel):
    """
    Requête de décision (approbation ou refus) d'une attestation reçue.
    """
    decision: str = Field(
        ...,
        description="Décision : 'APPROUVER' ou 'REFUSER'",
        pattern=r"^(APPROUVER|REFUSER)$",
        examples=["APPROUVER"],
    )
    motif_refus: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Motif du refus (obligatoire si décision = REFUSER)",
        examples=["Je ne connais pas suffisamment cette personne."],
    )

    @field_validator("motif_refus")
    @classmethod
    def valider_motif_refus(cls, v: Optional[str], info) -> Optional[str]:
        """Le motif est obligatoire si la décision est REFUSER."""
        valeurs = info.data
        if valeurs.get("decision") == "REFUSER" and (not v or not v.strip()):
            raise ValueError("Le motif de refus est obligatoire.")
        return v


class MiseAJourAttestation(BaseModel):
    """
    Requête de mise à jour d'une attestation (titre, description, forces).
    """
    titre: Optional[str] = Field(default=None, min_length=3, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    forces: Optional[str] = Field(default=None, max_length=1000)
    est_visible_public: Optional[bool] = None


# ============================================================================
# Réponses
# ============================================================================

class AttestationDetail(BaseModel):
    """
    Détail complet d'une attestation communautaire (réponse API).
    """
    model_config = {"from_attributes": True}

    id: UUID
    attestant_id: UUID
    attestant_nom: str = ""
    attestant_prenom: str = ""
    attestant_digiid: str = ""
    atteste_id: UUID
    atteste_nom: str = ""
    atteste_prenom: str = ""
    atteste_digiid: str = ""
    type_attestation: str
    titre: str
    description: Optional[str] = None
    forces: Optional[str] = None
    lien_connu_depuis: Optional[str] = None
    lien_nature: Optional[str] = None
    statut: str
    motif_refus: Optional[str] = None
    poids_score: float
    est_visible_public: bool
    est_active: bool
    date_soumission: datetime
    date_decision: Optional[datetime] = None
    date_expiration: Optional[datetime] = None


class AttestationResume(BaseModel):
    """
    Version résumée d'une attestation pour les listes.
    """
    model_config = {"from_attributes": True}

    id: UUID
    attestant_nom_complet: str = ""
    atteste_nom_complet: str = ""
    type_attestation: str
    titre: str
    statut: str
    poids_score: float
    est_active: bool
    date_soumission: datetime
    date_decision: Optional[datetime] = None
    date_expiration: Optional[datetime] = None


class ListeAttestations(BaseModel):
    """Liste paginée d'attestations."""
    attestations: list[AttestationResume]
    total: int
    page: int
    limite: int
    pages_totales: int


class StatistiquesAttestations(BaseModel):
    """Statistiques des attestations pour un utilisateur."""
    total_recues: int = 0
    total_envoyees: int = 0
    approuvees_recues: int = 0
    approuvees_envoyees: int = 0
    en_attente_recues: int = 0
    en_attente_envoyees: int = 0
    refusees_recues: int = 0
    expirees_recues: int = 0
    score_total_attestations: float = 0.0
    attestants_uniques: int = 0


class ResultatCreation(BaseModel):
    """Résultat de la création d'une attestation."""
    message: str
    attestation: AttestationDetail


class ResultatDecision(BaseModel):
    """Résultat d'une décision sur une attestation."""
    message: str
    attestation: AttestationDetail
    score_mis_a_jour: Optional[float] = None
