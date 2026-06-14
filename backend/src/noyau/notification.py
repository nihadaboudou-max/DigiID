# -*- coding: utf-8 -*-
"""
Service de notifications — envoi d'emails, SMS et appels.

Utilise SMTP Gmail avec mot de passe d'application Google.

Configuration requise :
  1. Activer la 2FA sur le compte Google (bigdataism2024@gmail.com)
  2. Creer un mot de passe d'application : https://myaccount.google.com/apppasswords
  3. Definir SMTP_MOT_DE_PASSE dans les variables d'environnement Render
"""
import random
import smtplib
import string
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from src.config import parametres
from src.noyau.journal import journal


# =============================================================================
# Generation de code de verification
# =============================================================================

def generer_code_verification(longueur: int = 6) -> str:
    """Genere un code numerique a `longueur` chiffres."""
    return "".join(random.choices(string.digits, k=longueur))


# =============================================================================
# Envoi d'emails — SMTP Gmail uniquement
# =============================================================================

def envoyer_email(
    destinataire: str,
    sujet: str,
    corps_texte: str,
    corps_html: Optional[str] = None,
) -> bool:
    """
    Envoie un email via SMTP Gmail.

    Si SMTP_MOT_DE_PASSE n'est pas defini, logge dans la console (mode mock).

    Args:
        destinataire: Adresse email du destinataire
        sujet: Sujet de l'email
        corps_texte: Corps texte brut (fallback)
        corps_html: Corps HTML optionnel

    Returns:
        bool: True si l'envoi a reussi (ou simule), False sinon
    """
    # --- Pas de mot de passe SMTP : mode mock (log console) ---
    if not parametres.smtp_mot_de_passe:
        journal.info(
            f"[EMAIL][MOCK] A: {destinataire} | Sujet: {sujet}\n"
            f"Corps:\n{corps_texte}"
        )
        return True

    # --- Envoi via SMTP Gmail ---
    try:
        _envoyer_via_smtp(destinataire, sujet, corps_texte, corps_html)
        journal.info(f"[EMAIL][SMTP] OK → {destinataire} | Sujet: {sujet}")
        return True
    except smtplib.SMTPAuthenticationError:
        journal.error(
            f"[EMAIL][SMTP] ERREUR AUTH → {destinataire} : "
            f"Mot de passe d'application invalide. "
            f"Regenere-le sur https://myaccount.google.com/apppasswords"
        )
        return False
    except smtplib.SMTPRecipientsRefused:
        journal.error(f"[EMAIL][SMTP] DESTINATAIRE REFUSE → {destinataire}")
        return False
    except smtplib.SMTPServerDisconnected:
        journal.error(f"[EMAIL][SMTP] CONNEXION PERDUE → {destinataire}")
        return False
    except TimeoutError:
        journal.error(f"[EMAIL][SMTP] TIMEOUT → {destinataire}")
        return False
    except Exception as erreur:
        journal.error(f"[EMAIL][SMTP] ERREUR → {destinataire} : {erreur}")
        return False


def _envoyer_via_smtp(
    destinataire: str,
    sujet: str,
    corps_texte: str,
    corps_html: Optional[str] = None,
) -> None:
    """
    Envoie l'email via SMTP Gmail (mot de passe d'application).
    """
    expediteur = parametres.email_expediteur or "DigiID <bigdataism2024@gmail.com>"

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
    """Envoie un SMS (simule pour l'instant)."""
    journal.info(
        f"[SMS][MOCK] A: {telephone}\n"
        f"Message: {message}"
    )
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
    """Passe un appel vocal (simule pour l'instant)."""
    message_tts = f"""
Bonjour, voici votre code de verification DigiID : {code}.
Je repete : {code}.
Ce code expire dans 10 minutes.
"""
    journal.info(
        f"[APPEL][MOCK] A: {telephone}\n"
        f"Message vocal: {message_tts}"
    )
    return True
