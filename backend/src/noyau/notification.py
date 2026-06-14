# -*- coding: utf-8 -*-
"""
Service de notifications — envoi d'emails, SMS et appels.

Méthodes d'envoi d'emails (par ordre de préférence) :
  1. SendGrid API (recommandé) — API HTTP, gratuit (100/jour), fiable sur Render
  2. SMTP Gmail (fallback) — mot de passe d'application Google

Configuration :
  - SendGrid : definir SENDGRID_API_KEY dans .env ou variables Render
    Creer un compte : https://signup.sendgrid.com
  - SMTP Gmail : definir SMTP_MOT_DE_PASSE (mot de passe d'application Google)
    https://myaccount.google.com/apppasswords

Si aucun n'est configuré → mode mock (log console + retourne code_dev).
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
    Envoie un email.

    Ordre de préférence :
      1. SendGrid API (SENDGRID_API_KEY) — recommandé
      2. SMTP Gmail (SMTP_MOT_DE_PASSE) — fallback
      3. Mode mock (log console) — si rien n'est configuré
    """
    if parametres.sendgrid_api_key:
        return _envoyer_via_sendgrid(destinataire, sujet, corps_texte, corps_html)
    if parametres.smtp_mot_de_passe:
        return _envoyer_via_smtp(destinataire, sujet, corps_texte, corps_html)
    journal.info(
        f"[EMAIL][MOCK] A: {destinataire} | Sujet: {sujet}\nCorps:\n{corps_texte}"
    )
    return False


def _envoyer_via_sendgrid(
    destinataire: str,
    sujet: str,
    corps_texte: str,
    corps_html: Optional[str] = None,
) -> bool:
    """
    Envoie via l'API HTTP SendGrid (fiable sur Render).
    """
    try:
        contenu = [{"type": "text/plain", "value": corps_texte}]
        if corps_html:
            contenu.append({"type": "text/html", "value": corps_html})
        reponse = httpx.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={
                "Authorization": f"Bearer {parametres.sendgrid_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "personalizations": [{"to": [{"email": destinataire}]}],
                "from": {"email": "bigdataism2024@gmail.com", "name": "DigiID"},
                "subject": sujet,
                "content": contenu,
            },
            timeout=30.0,
        )
        if reponse.status_code in (200, 201, 202):
            journal.info(f"[EMAIL][SENDGRID] OK → {destinataire} | Sujet: {sujet}")
            return True
        journal.error(f"[EMAIL][SENDGRID] ERREUR → {destinataire} : HTTP {reponse.status_code} - {reponse.text}")
        return False
    except Exception as erreur:
        journal.error(f"[EMAIL][SENDGRID] ERREUR → {destinataire} : {erreur}")
        return False


def _envoyer_via_smtp(
    destinataire: str,
    sujet: str,
    corps_texte: str,
    corps_html: Optional[str] = None,
) -> bool:
    """Envoie via SMTP Gmail (mot de passe d'application Google)."""
    expediteur = parametres.email_expediteur or "DigiID <bigdataism2024@gmail.com>"
    if "<" in expediteur and ">" in expediteur:
        adresse_expediteur = expediteur.split("<")[1].split(">")[0].strip()
    else:
        adresse_expediteur = expediteur
    msg = MIMEMultipart("alternative")
    msg["From"] = expediteur
    msg["To"] = destinataire
    msg["Subject"] = sujet
    msg.attach(MIMEText(corps_texte, "plain", "utf-8"))
    if corps_html:
        msg.attach(MIMEText(f"<html><body style='font-family:sans-serif;padding:20px'>{corps_html}</body></html>", "html", "utf-8"))
    else:
        msg.attach(MIMEText(corps_texte.replace("\n", "<br>"), "html", "utf-8"))
    try:
        with smtplib.SMTP(parametres.smtp_serveur, parametres.smtp_port, timeout=15) as serveur:
            serveur.starttls()
            serveur.login(parametres.smtp_utilisateur, parametres.smtp_mot_de_passe)
            serveur.sendmail(adresse_expediteur, [destinataire], msg.as_string())
        journal.info(f"[EMAIL][SMTP] OK → {destinataire} | Sujet: {sujet}")
        return True
    except smtplib.SMTPAuthenticationError:
        journal.error(f"[EMAIL][SMTP] ERREUR AUTH → {destinataire} : mot de passe d'application invalide")
        return False
    except smtplib.SMTPRecipientsRefused:
        journal.error(f"[EMAIL][SMTP] DESTINATAIRE REFUSE → {destinataire}")
        return False
    except Exception as erreur:
        journal.error(f"[EMAIL][SMTP] ERREUR → {destinataire} : {erreur}")
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
<div style="max-width:480px;margin:0 auto;padding:20px;font-family:Arial,sans-serif">
    <h1 style="color:#1a73e8;font-size:24px;text-align:center">DigiID</h1>
    <p>Bonjour {prenom_texte}</p>
    <p>Merci de t'etre inscrit sur DigiID ! Pour finaliser ton inscription, confirme ton adresse email :</p>
    <div style="background:#f5f5f5;border-radius:8px;padding:20px;text-align:center;margin:20px 0">
        <span style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#1a73e8">{code}</span>
    </div>
    <p style="color:#666;font-size:14px">Ce code expire dans 10 minutes.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
    <p style="color:#999;font-size:12px">Si tu n'as pas demande cette verification, ignore cet email.</p>
</div>"""
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
<div style="max-width:480px;margin:0 auto;padding:20px;font-family:Arial,sans-serif">
    <h1 style="color:#1a73e8;font-size:24px;text-align:center">DigiID</h1>
    <p>Bonjour,</p>
    <p>Tu as demande le changement de ton adresse email. Voici le code de confirmation :</p>
    <div style="background:#f5f5f5;border-radius:8px;padding:20px;text-align:center;margin:20px 0">
        <span style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#1a73e8">{code}</span>
    </div>
    <p style="color:#666;font-size:14px">Ce code expire dans 10 minutes.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
    <p style="color:#999;font-size:12px">Si tu n'as pas demande ce changement, contacte le support immediatement.</p>
</div>"""
    return envoyer_email(destinataire, sujet, corps_texte, corps_html)


# =============================================================================
# SMS
# =============================================================================

def envoyer_sms(telephone: str, message: str) -> bool:
    journal.info(f"[SMS][MOCK] A: {telephone}\nMessage: {message}")
    return True


def envoyer_sms_verification(telephone: str, code: str) -> bool:
    return envoyer_sms(telephone, f"DigiID — Ton code de verification est : {code}. Ce code expire dans 10 minutes.")


# =============================================================================
# Appel vocal
# =============================================================================

def passer_appel_verification(telephone: str, code: str) -> bool:
    journal.info(f"[APPEL][MOCK] A: {telephone}\nMessage vocal: Bonjour, voici votre code DigiID : {code}. Je repete : {code}. Ce code expire dans 10 minutes.")
    return True
