# -*- coding: utf-8 -*-
"""
Exceptions personnalisées DigiID.

Toutes les exceptions métier héritent de `ErreurDigiID` pour faciliter
le traitement uniforme par les handlers FastAPI.

Chaque exception porte :
  - un message technique (pour les logs)
  - un message utilisateur (sûr à afficher)
  - un code d'erreur métier (constantes.CodesErreur)
  - un code HTTP approprié

Cela permet de séparer ce qu'on dit en interne (logs) de ce qu'on
expose à l'utilisateur (API).
"""
from typing import Optional

from src.config.constantes import CodesErreur


class ErreurDigiID(Exception):
    """Exception de base de toutes les erreurs métier DigiID."""

    code_http: int = 500
    code_erreur: str = "ERREUR_GENERIQUE"
    message_utilisateur: str = "Une erreur est survenue. Veuillez réessayer."

    def __init__(
        self,
        message_technique: str,
        message_utilisateur: Optional[str] = None,
        code_erreur: Optional[str] = None,
        donnees_supplementaires: Optional[dict] = None,
    ):
        super().__init__(message_technique)
        self.message_technique = message_technique
        if message_utilisateur is not None:
            self.message_utilisateur = message_utilisateur
        if code_erreur is not None:
            self.code_erreur = code_erreur
        self.donnees_supplementaires = donnees_supplementaires or {}


# -----------------------------------------------------------------------------
# Authentification (HTTP 401)
# -----------------------------------------------------------------------------

class ErreurAuthentification(ErreurDigiID):
    """Identifiants invalides, token expiré, etc."""
    code_http = 401
    code_erreur = CodesErreur.AUTH_IDENTIFIANTS_INVALIDES.value
    message_utilisateur = "Identifiants invalides."


class ErreurTokenExpire(ErreurAuthentification):
    code_erreur = CodesErreur.AUTH_TOKEN_EXPIRE.value
    message_utilisateur = "Session expirée. Veuillez vous reconnecter."


class ErreurTokenInvalide(ErreurAuthentification):
    code_erreur = CodesErreur.AUTH_TOKEN_INVALIDE.value
    message_utilisateur = "Token d'authentification invalide."


class ErreurCompteVerrouille(ErreurAuthentification):
    code_erreur = CodesErreur.AUTH_COMPTE_VERROUILLE.value
    message_utilisateur = (
        "Compte temporairement verrouillé suite à plusieurs tentatives échouées. "
        "Réessaie dans 5 minutes."
    )


class Erreur2FARequis(ErreurAuthentification):
    code_erreur = CodesErreur.AUTH_2FA_REQUIS.value
    message_utilisateur = "Authentification à deux facteurs requise."


class Erreur2FAInvalide(ErreurAuthentification):
    code_erreur = CodesErreur.AUTH_2FA_INVALIDE.value
    message_utilisateur = "Code de vérification invalide."


# -----------------------------------------------------------------------------
# Autorisations (HTTP 403)
# -----------------------------------------------------------------------------

class ErreurAutorisation(ErreurDigiID):
    """L'utilisateur est authentifié mais n'a pas le droit d'effectuer l'action."""
    code_http = 403
    code_erreur = CodesErreur.AUTH_PERMISSION_REFUSEE.value
    message_utilisateur = "Vous n'avez pas l'autorisation d'effectuer cette action."


# -----------------------------------------------------------------------------
# Ressources (HTTP 404, 409)
# -----------------------------------------------------------------------------

class ErreurRessourceIntrouvable(ErreurDigiID):
    """La ressource demandée n'existe pas."""
    code_http = 404
    code_erreur = "RESSOURCE_INTROUVABLE"
    message_utilisateur = "La ressource demandée est introuvable."


class ErreurConflit(ErreurDigiID):
    """Conflit de données (ex : email déjà utilisé)."""
    code_http = 409
    code_erreur = "CONFLIT"
    message_utilisateur = "Cette ressource existe déjà."


# -----------------------------------------------------------------------------
# Validation (HTTP 422)
# -----------------------------------------------------------------------------

class ErreurValidation(ErreurDigiID):
    """Données invalides envoyées par l'utilisateur."""
    code_http = 422
    code_erreur = CodesErreur.VALIDATION_DONNEES_INVALIDES.value
    message_utilisateur = "Les données envoyées sont invalides."


# -----------------------------------------------------------------------------
# Sécurité (HTTP 429, 403)
# -----------------------------------------------------------------------------

class ErreurLimiteRequetes(ErreurDigiID):
    """Trop de requêtes — rate limit dépassé."""
    code_http = 429
    code_erreur = CodesErreur.SECURITE_LIMITE_REQUETES.value
    message_utilisateur = "Trop de requêtes. Veuillez ralentir."


class ErreurFraudeDetectee(ErreurDigiID):
    """Action bloquée suite à détection de fraude."""
    code_http = 403
    code_erreur = CodesErreur.SECURITE_FRAUDE_DETECTEE.value
    message_utilisateur = (
        "Action bloquée par notre système de sécurité. "
        "Si vous pensez qu'il s'agit d'une erreur, contactez le support."
    )


# -----------------------------------------------------------------------------
# Système (HTTP 503)
# -----------------------------------------------------------------------------

class ErreurServiceIndisponible(ErreurDigiID):
    """Un service externe (LLM, base de données) est indisponible."""
    code_http = 503
    code_erreur = CodesErreur.SYSTEME_LLM_INDISPONIBLE.value
    message_utilisateur = "Service temporairement indisponible. Veuillez réessayer dans quelques instants."
