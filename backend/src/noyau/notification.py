# -*- coding: utf-8 -*-
"""
Service de notifications — envoi d'emails, SMS et appels.

Utilise Resend (https://resend.com) pour l'envoi d'emails en production,
avec un fallback console en developpement (mock).

Configuration requise dans render.yaml :
  - RESEND_API_KEY : cle API Resend (sync: false, a definir manuellement)
  - EMAIL_EXPEDITEUR : adresse expediteur (ex: "DigiID <noreply@digiid.africa>")
"""
import json
import random
import string
from typing import Optional

import httpx

from src.config import parametres
from src.noyau.journal import journal


# =============================================================================
# Generation de code de verification
# =============================================================================

def generer_code_verification(longueur: int = 6) -> str:
    """Genere un code numerique a `longueur` chiffres."""
    return "".join(random.choices(string.digits, k=longueur))


# =============================================================================
# Envoi d'emails — Resend API
# =============================================================================

RESEND_API_URL = "https://api.resend.com/emails"


def envoyer_email(
    destinataire: str,
    sujet: str,
    corps_texte: str,
    corps_html: Optional[str] = None,
) -> bool:
    """
    Envoie un email via Resend en production, ou log dans la console en dev.

    Args:
        destinataire: Adresse email du destinataire
        sujet: Sujet de l'email
        corps_texte: Corps texte brut (fallback)
        corps_html: Corps HTML optionnel

    Returns:
        bool: True si l'envoi a reussi (ou simule), False sinon
    """
    api_key = parametres.resend_api_key
    expediteur = parametres.email_expediteur or "DigiID <noreply@digiid.africa>"

    # --- Mode dev : juste logger ---
    if not api_key or parametres.est_developpement:
        journal.info(
            f"[EMAIL][MOCK] À: {destinataire} | Sujet: {sujet}\n"
            f"Corps:\n{corps_texte}"
        )
        return True

    # --- Mode production : envoyer via Resend ---
    if not corps_html:
        corps_html = corps_texte.replace("\n", "<br>")

    try:
        with httpx.Client(timeout=15.0) as client:
            reponse = client.post(
                RESEND_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": expediteur,
                    "to": [destinataire],
                    "subject": sujet,
                    "text": corps_texte,
                    "html": f"<html><body style='font-family: sans-serif; padding: 20px;'>{corps_html}</body></html>",
                },
            )

            if reponse.status_code in (200, 201):
                data = reponse.json()
                journal.info(
                    f"[EMAIL][RESEND] OK id={data.get('id', '?')} → {destinataire} | Sujet: {sujet}"
                )
                return True
            else:
                journal.error(
                    f"[EMAIL][RESEND] ERREUR {reponse.status_code} → {destinataire} : {reponse.text[:500]}"
                )
                return False

    except httpx.TimeoutException:
        journal.error(f"[EMAIL][RESEND] TIMEOUT → {destinataire}")
        return False
    except Exception as erreur:
        journal.error(f"[EMAIL][RESEND] EXCEPTION → {destinataire} : {erreur}")
        return False


def envoyer_email_verification(
    destinataire: str,
    code: str,
    prenom: Optional[str] = None,
) -> bool:
    """Envoie un email avec un code de verification."""
    prenom_texte = f"{prenom}, " if prenom else ""

    sujet = "DigiID — Confirme ton adresse email"

    corps_texte = f"""
Bonjour {prenom_texte}

Merci de t'etre inscrit sur DigiID ! Pour finaliser ton inscription,
confirme ton adresse email avec le code suivant :

    {code}

Ce code expire dans 10 minutes.

Si tu n'as pas demande cette verification, ignore cet email.

---
L'equipe DigiID
"""

    corps_html = f"""
<div style="max-width: 480px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
    <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #1a73e8; font-size: 24px;">DigiID</h1>
    </div>
    <p>Bonjour {prenom_texte}</p>
    <p>Merci de t'etre inscrit sur DigiID ! Pour finaliser ton inscription, confirme ton adresse email :</p>
    <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
        <span style="font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #1a73e8;">{code}</span>
    </div>
    <p style="color: #666; font-size: 14px;">Ce code expire dans 10 minutes.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="color: #999; font-size: 12px;">Si tu n'as pas demande cette verification, ignore cet email.</p>
</div>
"""

    return envoyer_email(destinataire, sujet, corps_texte, corps_html)


def envoyer_email_changement(
    destinataire: str,
    code: str,
) -> bool:
    """Envoie un email pour confirmer un changement d'email."""
    sujet = "DigiID — Confirme ton nouvel email"

    corps_texte = f"""
Bonjour,

Tu as demande le changement de ton adresse email. Voici le code de confirmation :

    {code}

Ce code expire dans 10 minutes.

Si tu n'as pas demande ce changement, contacte le support immediatement.

---
L'equipe DigiID
"""

    corps_html = f"""
<div style="max-width: 480px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
    <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #1a73e8; font-size: 24px;">DigiID</h1>
    </div>
    <p>Bonjour,</p>
    <p>Tu as demande le changement de ton adresse email. Voici le code de confirmation :</p>
    <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
        <span style="font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #1a73e8;">{code}</span>
    </div>
    <p style="color: #666; font-size: 14px;">Ce code expire dans 10 minutes.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="color: #999; font-size: 12px;">Si tu n'as pas demande ce changement, contacte le support immediatement.</p>
</div>
"""

    return envoyer_email(destinataire, sujet, corps_texte, corps_html)


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
        f"[SMS][MOCK] À: {telephone}\n"
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
        f"[APPEL][MOCK] À: {telephone}\n"
        f"Message vocal: {message_tts}"
    )
    # TODO: Brancher Twilio Voice en production
    return True
