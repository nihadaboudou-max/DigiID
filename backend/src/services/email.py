# -*- coding: utf-8 -*-
"""
Service d'envoi d'emails — Supporte SendGrid (prioritaire) et SMTP classique.
"""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from src.noyau import journal

# Configuration depuis les variables d'environnement
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
SMTP_MOT_DE_PASSE = os.getenv("SMTP_MOT_DE_PASSE", "")
EMAIL_EXPEDITEUR = os.getenv("EMAIL_EXPEDITEUR", "noreply@digiid.africa")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", EMAIL_EXPEDITEUR.split("<")[-1].rstrip(">"))


async def envoyer_email(
    destinataire: str,
    sujet: str,
    contenu_html: str,
) -> bool:
    """
    Envoie un email via SendGrid (si clé API configurée) ou SMTP classique.
    Returns: True si envoyé avec succès, False sinon.
    """
    # Option 1 : SendGrid (prioritaire)
    if SENDGRID_API_KEY:
        return await _envoyer_via_sendgrid(destinataire, sujet, contenu_html)
    
    # Option 2 : SMTP classique
    if SMTP_MOT_DE_PASSE:
        return await _envoyer_via_smtp(destinataire, sujet, contenu_html)
    
    # Aucune configuration
    journal.warning("⚠️ Aucun service email configuré (SendGrid ni SMTP)")
    return False


async def _envoyer_via_sendgrid(
    destinataire: str,
    sujet: str,
    contenu_html: str,
) -> bool:
    """Envoie via l'API SendGrid."""
    try:
        import httpx
        
        url = "https://api.sendgrid.com/v3/mail/send"
        headers = {
            "Authorization": f"Bearer {SENDGRID_API_KEY}",
            "Content-Type": "application/json",
        }
        
        payload = {
            "personalizations": [
                {"to": [{"email": destinataire}]}
            ],
            "from": {"email": EMAIL_EXPEDITEUR.split("<")[-1].rstrip(">")},
            "subject": sujet,
            "content": [
                {"type": "text/html", "value": contenu_html}
            ],
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers)
        
        if response.status_code in [200, 201, 202]:
            journal.info(f"✅ Email envoyé à {destinataire} via SendGrid")
            return True
        else:
            journal.error(f"❌ Erreur SendGrid {response.status_code}: {response.text}")
            return False
    except Exception as e:
        journal.error(f"❌ Erreur envoi SendGrid : {e}")
        return False


async def _envoyer_via_smtp(
    destinataire: str,
    sujet: str,
    contenu_html: str,
) -> bool:
    """Envoie via SMTP classique."""
    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = EMAIL_EXPEDITEUR
        msg["To"] = destinataire
        msg["Subject"] = sujet
        
        msg.attach(MIMEText(contenu_html, "html"))
        
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_MOT_DE_PASSE)
            server.send_message(msg)
        
        journal.info(f"✅ Email envoyé à {destinataire} via SMTP")
        return True
    except Exception as e:
        journal.error(f"❌ Erreur envoi SMTP : {e}")
        return False


# ============ TEMPLATES D'EMAILS ============

def template_invitation(
    lien_invitation: str,
    role: str,
    domaine_nom: str | None = None,
    departement_nom: str | None = None,
) -> tuple[str, str]:
    """
    Retourne (sujet, contenu_html) pour un email d'invitation.
    """
    sujet = f"Invitation à rejoindre DigiID — Rôle: {role}"
    
    contexte = f"""
    <p>Vous avez été invité(e) à rejoindre la plateforme <strong>DigiID</strong> avec le rôle : <strong>{role}</strong></p>
    """
    
    if domaine_nom:
        contexte += f"<p>Domaine : <strong>{domaine_nom}</strong></p>"
    if departement_nom:
        contexte += f"<p>Département : <strong>{departement_nom}</strong></p>"
    
    contenu_html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #1a5276; text-align: center;">Bienvenue sur DigiID !</h2>
            {contexte}
            <p style="margin: 30px 0;">Cliquez sur le bouton ci-dessous pour créer votre compte :</p>
            <p style="text-align: center; margin: 30px 0;">
                <a href="{lien_invitation}" 
                   style="background-color: #1a5276; color: white; padding: 14px 28px; 
                          text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                    Créer mon compte
                </a>
            </p>
            <p style="color: #7f8c8d; font-size: 12px; text-align: center; margin-top: 30px;">
                Ce lien expire dans 7 jours. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
            </p>
            <p style="color: #7f8c8d; font-size: 11px; text-align: center;">
                DigiID — Système d'identité numérique africaine
            </p>
        </div>
    </body>
    </html>
    """
    
    return sujet, contenu_html