# -*- coding: utf-8 -*-
"""
Service de notifications — envoi d'emails, SMS et appels.

Utilise SMTP Gmail (mot de passe d'application Google) pour l'envoi d'emails.
Fallback sur Resend si SMTP non configure, et fallback console en dev.

Configuration requise :
  1. Activer la 2FA sur le compte Google (bigdataism2024@gmail.com)
  2. Creer un mot de passe d'application : https://myaccount.google.com/apppasswords
  3. Mettre le mot de passe dans .env : SMTP_MOT_DE_PASSE=xxxx xxxx xxxx xxxx
"""
import random
import smtplib
import string
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
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
# Envoi d'emails — SMTP Gmail (principal) + Resend (fallback)
# =============================================================================

RESEND_API_URL = "https://api.resend.com/emails"


def envoyer_email(
    destinataire: str,
    sujet: str,
    corps_texte: str,
    corps_html: Optional[str] = None,
) -> bool:
    """
    Envoie un email.

    Priorite :
      1. SMTP Gmail (si mot de passe d'application configure)
      2. Resend (si cle API Resend configuree)
      3. Console (mode dev)

    Args:
        destinataire: Adresse email du destinataire
        sujet: Sujet de l'email
        corps_texte: Corps texte brut (fallback)
        corps_html: Corps HTML optionnel

    Returns:
        bool: True si l'envoi a reussi (ou simule), False sinon
    """
    expediteur = parametres.email_expediteur or "DigiID <bigdataism2024@gmail.com>"

    # --- Si pas de config email : mode mock ---
    if parametres.est_developpement and not parametres.smtp_mot_de_passe and not parametres.resend_api_key:
        journal.info(
            f"[EMAIL][MOCK] A: {destinataire} | Sujet: {sujet}\n"
            f"Corps:\n{corps_texte}"
        )
        return True

    # --- 1. Essayer SMTP Gmail ---
    if parametres.smtp_mot_de_passe:
        try:
            _envoyer_via_smtp(destinataire, sujet, corps_texte, corps_html, expediteur)
            journal.info(
                f"[EMAIL][SMTP] OK → {destinataire} | Sujet: {sujet}"
            )
            return True
        except Exception as erreur:
            journal.error(
                f"[EMAIL][SMTP] ERREUR → {destinataire} : {erreur}"
            )
            # Fallback vers Resend si disponible
            if not parametres.resend_api_key:
                return False

    # --- 2. Fallback Resend ---
    if parametres.resend_api_key:
        return _envoyer_via_resend(destinataire, sujet, corps_texte, corps_html, expediteur)

    return False


def _envoyer_via_smtp(
    destinataire: str,
    sujet: str,
    corps_texte: str,
    corps_html: Optional[str] = None,
    expediteur: str = "DigiID <bigdataism2024@gmail.com>",
) -> None:
    """
    Envoie l'email via SMTP Gmail (mot de passe d'application).
    """
    # Extraire l'adresse email depuis le format "DigiID <email>"
    if "<" in expediteur and ">" in expediteur:
        adresse_expediteur = expediteur.split("<")[1].split(">")[0].strip()
    else:
        adresse_expediteur = expediteur

    msg = MIMEMultipart("alternative")
    msg["From"] = expediteur
    msg["To"] = destinataire
    msg["Subject"] = sujet

    # Version texte brut
    msg.attach(MIMEText(corps_texte, "plain", "utf-8"))

    # Version HTML (si fournie)
    if corps_html:
        html_complet = f"<html><body style='font-family: sans-serif; padding: 20px;'>{corps_html}</body></html>"
        msg.attach(MIMEText(html_complet, "html", "utf-8"))
    else:
        msg.attach(MIMEText(corps_texte.replace("\n", "<br>"), "html", "utf-8"))

    # Connexion SMTP Gmail (STARTTLS)
    with smtplib.SMTP(parametres.smtp_serveur, parametres.smtp_port, timeout=15) as serveur:
        serveur.starttls()
        serveur.login(parametres.smtp_utilisateur, parametres.smtp_mot_de_passe)
        serveur.sendmail(adresse_expediteur, [destinataire], msg.as_string())


def _envoyer_via_resend(
    destinataire: str,
    sujet: str,
    corps_texte: str,
    corps_html: Optional[str] = None,
    expediteur: str = "DigiID <bigdataism2024@gmail.com>",
) -> bool:
    """
    Fallback : envoie via Resend (au cas ou SMTP echoue).
    """
    api_key = parametres.resend_api_key
    if not api_key:
        journal.warning("[EMAIL][RESEND] Pas de cle API Resend configuree.")
        return False

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


# =============================================================================
# Emails specifiques
# =============================================================================

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
        f"[SMS][MOCK] A: {telephone}\n"
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
        f"[APPEL][MOCK] A: {telephone}\n"
        f"Message vocal: {message_tts}"
    )
    # TODO: Brancher Twilio Voice en production
    return True
