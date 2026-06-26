# -*- coding: utf-8 -*-
"""
Schémas Pydantic pour les requêtes et réponses d'authentification.

Sépare strictement les schémas d'entrée (ce que reçoit l'API)
des schémas de sortie (ce que retourne l'API), pour éviter de
divulguer accidentellement des données sensibles.
"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from src.config.constantes import RolesUtilisateur


# =============================================================================
# REQUÊTES — données reçues depuis le client
# =============================================================================

class InscriptionRequete(BaseModel):
    """Données envoyées par un utilisateur qui s'inscrit."""

    email: EmailStr = Field(..., description="Adresse email valide")
    mot_de_passe: str = Field(
        ...,
        min_length=12,
        max_length=128,
        description="Minimum 12 caractères, avec majuscule, minuscule, chiffre et caractère spécial"
    )
    prenom: str = Field(..., min_length=2, max_length=50)
    nom: str = Field(..., min_length=2, max_length=50)
    telephone: Optional[str] = Field(
        default=None,
        max_length=20,
        description="Numéro de téléphone au format international (ex: +221771234567)"
    )
    ville: Optional[str] = Field(default=None, max_length=100)
    code_parrainage: Optional[str] = Field(
        default=None,
        min_length=8,
        max_length=8,
        description="Code de parrainage du parrain, si l'utilisateur en a un"
    )
    accepte_cgu: bool = Field(..., description="Doit être true pour valider l'inscription")

    @field_validator("code_parrainage", mode="before")
    @classmethod
    def normaliser_code_parrainage(cls, valeur):
        if valeur is None:
            return None
        valeur = valeur.strip().upper()
        return valeur or None

    @field_validator("mot_de_passe")
    @classmethod
    def valider_complexite_mot_de_passe(cls, valeur: str) -> str:
        """Vérifie la complexité minimale du mot de passe."""
        if not any(c.islower() for c in valeur):
            raise ValueError("Le mot de passe doit contenir au moins une minuscule")
        if not any(c.isupper() for c in valeur):
            raise ValueError("Le mot de passe doit contenir au moins une majuscule")
        if not any(c.isdigit() for c in valeur):
            raise ValueError("Le mot de passe doit contenir au moins un chiffre")
        if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?/~`" for c in valeur):
            raise ValueError("Le mot de passe doit contenir au moins un caractère spécial")
        return valeur

    @field_validator("accepte_cgu")
    @classmethod
    def valider_cgu(cls, valeur: bool) -> bool:
        if not valeur:
            raise ValueError("Vous devez accepter les conditions générales d'utilisation")
        return valeur


class ConnexionRequete(BaseModel):
    """Données envoyées pour se connecter."""
    email: EmailStr
    mot_de_passe: str = Field(..., min_length=1)
    code_2fa: Optional[str] = Field(default=None, min_length=6, max_length=6)


class RafraichissementRequete(BaseModel):
    """Données pour rafraîchir un token d'accès expiré."""
    refresh_token: str


class ChangementMotDePasseRequete(BaseModel):
    """Changement de mot de passe par un utilisateur connecté."""
    mot_de_passe_actuel: str
    nouveau_mot_de_passe: str = Field(..., min_length=12, max_length=128)

    _valider_complexite = field_validator("nouveau_mot_de_passe")(
        InscriptionRequete.valider_complexite_mot_de_passe.__func__
    )


# =============================================================================
# RÉPONSES — données envoyées au client
# =============================================================================

class JetonsReponse(BaseModel):
    """Tokens retournés après une connexion réussie."""
    token_acces: str
    token_rafraichissement: str
    type_token: str = "Bearer"
    duree_validite_secondes: int


class UtilisateurReponse(BaseModel):
    """Représentation publique d'un utilisateur — données sûres uniquement."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    digiid_public: Optional[str]
    email: str
    prenom: Optional[str]
    nom: Optional[str]
    telephone: Optional[str] = None
    ville: Optional[str]
    role: str
    deux_fa_active: bool
    est_email_verifie: bool
    score_actuel: Optional[int]
    date_creation: Optional[datetime] = None


class ConnexionReponse(BaseModel):
    """Réponse complète après connexion : utilisateur + jetons."""
    utilisateur: UtilisateurReponse
    jetons: JetonsReponse


class InscriptionReponse(BaseModel):
    """Réponse après inscription — l'utilisateur est automatiquement connecté."""
    utilisateur: UtilisateurReponse
    jetons: Optional[JetonsReponse] = None
    message: str = "Inscription réussie. Bienvenue sur DigiID !"
    verification_requise: bool = True


# =============================================================================
# VÉRIFICATION EMAIL
# =============================================================================

class VerificationEnvoyerRequete(BaseModel):
    """Requête pour envoyer/renvoyer un code de vérification."""
    canal: str = Field(default="email", description="Canal : 'email', 'sms' ou 'appel'")


class VerificationEnvoyerReponse(BaseModel):
    """Réponse après envoi du code de vérification."""
    succes: bool
    message: str
    destination_masquee: str
    duree_validite_minutes: int
    code_dev: Optional[str] = Field(
        default=None,
        description="Code de vérification visible uniquement en mode développement",
    )


class VerificationVerifierRequete(BaseModel):
    """Requête pour vérifier un code saisi."""
    code: str = Field(..., min_length=6, max_length=6)
    canal: str = Field(default="email")


class VerificationVerifierReponse(BaseModel):
    """Réponse après vérification du code."""
    succes: bool
    message: str
    est_email_verifie: bool


class VerificationStatutReponse(BaseModel):
    """Statut de vérification actuel."""
    est_email_verifie: bool
    doit_verifier: bool


# =============================================================================
# MOT DE PASSE OUBLIÉ / RÉINITIALISATION
# =============================================================================

class MotDePasseOublieRequete(BaseModel):
    """Requête pour demander un lien de réinitialisation de mot de passe."""
    email: EmailStr = Field(..., description="Adresse email du compte")
    frontend_url: Optional[str] = Field(
        default=None,
        description="URL du frontend pour construire le lien de réinitialisation. "
        "Si non fourni, utilise la valeur configurée côté serveur.",
    )


class MotDePasseOublieReponse(BaseModel):
    """Réponse après demande de réinitialisation.
    
    Le message est identique que l'email existe ou non pour
    éviter l'énumération de comptes.
    """
    succes: bool
    message: str
    destination_masquee: Optional[str] = Field(
        default=None,
        description="Email partiellement masqué si le compte existe",
    )
    duree_validite_minutes: int = Field(
        default=30,
        description="Durée de validité du lien en minutes",
    )
    token_dev: Optional[str] = Field(
        default=None,
        description="Token visible uniquement en mode développement",
    )


class MotDePasseReinitialisationRequete(BaseModel):
    """Requête pour réinitialiser le mot de passe avec un token."""
    token: str = Field(..., description="Token de réinitialisation reçu par email")
    nouveau_mot_de_passe: str = Field(
        ...,
        min_length=12,
        max_length=128,
        description="Minimum 12 caractères, avec majuscule, minuscule, chiffre et caractère spécial"
    )

    @field_validator("nouveau_mot_de_passe")
    @classmethod
    def valider_complexite_mot_de_passe(cls, valeur: str) -> str:
        """Vérifie la complexité minimale du mot de passe."""
        if not any(c.islower() for c in valeur):
            raise ValueError("Le mot de passe doit contenir au moins une minuscule")
        if not any(c.isupper() for c in valeur):
            raise ValueError("Le mot de passe doit contenir au moins une majuscule")
        if not any(c.isdigit() for c in valeur):
            raise ValueError("Le mot de passe doit contenir au moins un chiffre")
        if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?/~`" for c in valeur):
            raise ValueError("Le mot de passe doit contenir au moins un caractère spécial")
        return valeur


class MotDePasseReinitialisationReponse(BaseModel):
    """Réponse après réinitialisation réussie du mot de passe."""
    succes: bool
    message: str
