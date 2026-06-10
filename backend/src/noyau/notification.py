# -*- coding: utf-8 -*-
"""
Service de notifications — envoi d'emails, SMS et appels.

Utilise un mock pour le developpement (affichage console) et
peut etre branche sur SendGrid / Twilio / AWS SNS en production.
"""
import random
import string
from datetime import datetime, timezone
from typing import Optional

from src.noyau.journal import journal


# =============================================================================
# Generation de code de verification
# =============================================================================

def generer_code_verification(longueur: int = 6) -> str:
    """Genere un code numerique a `longueur` chiffres."""
    return "".join(random.choices(string.digits, k=longueur))


# =============================================================================
# Envoi d'emails
# =============================================================================

def envoyer_email(
    destinataire: str,
    sujet: str,
    corps_texte: str,
    corps_html: Optional[str] = None,
) -> bool:
    """
    Envoie un email au destinataire.

    En developpement : logge le message dans la console.
    En production : utilise SendGrid / SMTP.
    """
    journal.info(
        f"[EMAIL] À: {destinataire} | Sujet: {sujet}\n"
        f"Corps:\n{corps_texte}"
    )
    # TODO: Brancher SendGrid ou SMTP en production
    # if parametres.est_production:
    #     from sendgrid import SendGridAPIClient
    #     ...
    return True


def envoyer_email_verification(
    destinataire: str,
    code: str,
    prenom: Optional[str] = None,
) -> bool:
    """Envoie un email avec un code de verification."""
    prenom_texte = f"{prenom}, " if prenom else ""
    sujet = "DigiID — Confirme ton adresse email"
    corps = f"""
Bonjour {prenom_texte}

Merci de t'etre inscrit sur DigiID ! Pour finaliser ton inscription,
confirme ton adresse email avec le code suivant :

    {code}

Ce code expire dans 10 minutes.

Si tu n'as pas demande cette verification, ignore cet email.

L'equipe DigiID
"""
    return envoyer_email(destinataire, sujet, corps)


def envoyer_email_changement(
    destinataire: str,
    code: str,
) -> bool:
    """Envoie un email pour confirmer un changement d'email."""
    sujet = "DigiID — Confirme ton nouvel email"
    corps = f"""
Bonjour,

Tu as demande le changement de ton adresse email. Voici le code de confirmation :

    {code}

Ce code expire dans 10 minutes.

Si tu n'as pas demande ce changement, contacte le support immediatement.

L'equipe DigiID
"""
    return envoyer_email(destinataire, sujet, corps)


# =============================================================================
# Envoi de SMS
# =============================================================================

def envoyer_sms(
    telephone: str,
    message: str,
) -> bool:
    """
    Envoie un SMS au telephone donne.

    En developpement : logge le message dans la console.
    En production : utilise Twilio / AWS SNS / Orange SMS API.
    """
    journal.info(
        f"[SMS] À: {telephone}\n"
        f"Message: {message}"
    )
    # TODO: Brancher Twilio en production
    return True


def envoyer_sms_verification(
    telephone: str,
    code: str,
) -> bool:
    """Envoie un SMS avec un code de verification."""
    message = f"""
DigiID — Ton code de verification est : {code}

Ce code expire dans 10 minutes. Ne le partage avec personne.
"""
    return envoyer_sms(telephone, message)


# =============================================================================
# Appel vocal (TTS)
# =============================================================================

def passer_appel_verification(
    telephone: str,
    code: str,
) -> bool:
    """
    Passe un appel vocal vers le telephone pour lire le code de verification.

    En developpement : logge le message dans la console.
    En production : utilise Twilio Voice / AWS Connect.
    """
    message_tts = f"""
Bonjour, voici votre code de verification DigiID : {code}.
Je repete : {code}.
Ce code expire dans 10 minutes.
"""
    journal.info(
        f"[APPEL] À: {telephone}\n"
        f"Message vocal: {message_tts}"
    )
    # TODO: Brancher Twilio Voice en production
    return True
