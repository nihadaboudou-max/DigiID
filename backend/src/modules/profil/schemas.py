# -*- coding: utf-8 -*-
"""Schémas Pydantic du module profil."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AttestationApercu(BaseModel):
    """Aperçu d'une attestation communautaire dans le profil."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type_attestation: str
    titre: str
    statut: str
    date_soumission: datetime
    date_expiration: Optional[datetime] = None
    poids_score: float
    est_active: bool


class AttestationRecue(AttestationApercu):
    """Attestation reçue (quelqu'un atteste pour moi)."""
    attestant_id: UUID
    lien_connu_depuis: Optional[str] = None
    lien_nature: Optional[str] = None
    forces: Optional[str] = None


class AttestationEmise(AttestationApercu):
    """Attestation émise (j'atteste pour quelqu'un)."""
    atteste_id: UUID


class ProfilDetail(BaseModel):
    """Réponse complète de consultation du profil utilisateur."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    digiid_public: Optional[str]
    email: str
    prenom: Optional[str]
    nom: Optional[str]
    telephone: Optional[str]
    operateur_telephone: Optional[str] = None
    quartier: Optional[str] = None
    ville: Optional[str]
    pays: Optional[str]
    role: str
    deux_fa_active: bool
    est_email_verifie: bool
    score_actuel: Optional[int]
    date_dernier_calcul_score: Optional[datetime]
    date_creation: datetime
    date_derniere_connexion: Optional[datetime]

    # --- Vérifications identité ---
    est_visage_verifie: bool = False
    date_verification_visage: Optional[datetime] = None
    est_cni_verifiee: bool = False
    date_verification_cni: Optional[datetime] = None
    date_derniere_mise_a_jour_verifications: Optional[datetime] = None

    # --- Statistiques de vérification ---
    niveau_verification: str = "aucune"
    progres_verifications: int = 0

    # --- Attestations communautaires ---
    attestations_recues: list[AttestationRecue] = []
    attestations_emises: list[AttestationEmise] = []


class ProfilModification(BaseModel):
    """Données acceptées pour modifier un profil."""
    prenom: Optional[str] = Field(default=None, min_length=2, max_length=50)
    nom: Optional[str] = Field(default=None, min_length=2, max_length=50)
    telephone: Optional[str] = Field(default=None, max_length=20)
    operateur_telephone: Optional[str] = Field(default=None, max_length=50)
    quartier: Optional[str] = Field(default=None, max_length=100)
    ville: Optional[str] = Field(default=None, max_length=100)
    pays: Optional[str] = Field(default=None, max_length=50)


class ExportDonnees(BaseModel):
    """Export complet RGPD — portabilité des données personnelles."""
    utilisateur: ProfilDetail
    consentements: list[dict]
    historique_audit: list[dict]
    date_export: datetime
    format: str = "JSON v1.0"


class ReponseSuppression(BaseModel):
    """Réponse après suppression du compte."""
    message: str
    utilisateur_id: UUID
    date_suppression_effective: datetime
    delai_purge_complete_jours: int = 30


class Code2FARequete(BaseModel):
    """Code TOTP à 6 chiffres pour confirmer une action 2FA."""
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


class Preparation2FAReponse(BaseModel):
    """Données pour configurer une app d'authentification (étape 1)."""
    uri_provisioning: str
    secret_manuel: str
    qr_code_base64: str


class Activation2FAReponse(BaseModel):
    """Réponse après activation ou désactivation de la 2FA."""
    message: str
    deux_fa_active: bool
