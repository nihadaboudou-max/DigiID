# -*- coding: utf-8 -*-
"""
Service d'envoi d'emails — Supporte SendGrid (prioritaire) et SMTP classique.
Avec fallback automatique et templates professionnels.
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

# Mapping des rôles pour affichage
LABELS_ROLES = {
    "admin_domaine": "Administrateur de Domaine",
    "chef_police": "Chef de Département Police",
    "chef_medical": "Chef de Département Médical",
    "chef_ong": "Chef de Département ONG",
    "chef_agent": "Chef de Département Enrôlement",
    "agent_police": "Agent Police",
    "agent_medical": "Agent Médical",
    "agent_ong": "Agent ONG",
    "agent_terrain": "Agent Terrain",
    "administrateur": "Administrateur",
    "super_administrateur": "Super Administrateur",
}


async def envoyer_email(
    destinataire: str,
    sujet: str,
    contenu_html: str,
) -> bool:
    """
    Envoie un email via SendGrid (si clé API configurée) ou SMTP classique.
    Avec fallback automatique si SendGrid échoue.
    
    Returns: True si envoyé avec succès, False sinon.
    """
    # Option 1 : SendGrid (prioritaire)
    if SENDGRID_API_KEY:
        succes = await _envoyer_via_sendgrid(destinataire, sujet, contenu_html)
        if succes:
            return True
        # Si échec, essayer SMTP en fallback
        journal.warning(f"⚠️ SendGrid a échoué, tentative fallback SMTP pour {destinataire}")
    
    # Option 2 : SMTP classique
    if SMTP_MOT_DE_PASSE:
        return await _envoyer_via_smtp(destinataire, sujet, contenu_html)
    
    # Aucune configuration
    journal.warning("⚠️ Aucun service email configuré (SendGrid ni SMTP)")
    journal.info(f"[EMAIL][MOCK] A: {destinataire} | Sujet: {sujet}\nCorps:\n{contenu_html[:200]}...")
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
        
        # Extraire l'email de l'expéditeur
        email_expediteur = EMAIL_EXPEDITEUR.split("<")[-1].rstrip(">")
        
        payload = {
            "personalizations": [
                {"to": [{"email": destinataire}]}
            ],
            "from": {"email": email_expediteur, "name": "DigiID"},
            "subject": sujet,
            "content": [
                {"type": "text/html", "value": contenu_html}
            ],
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
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
        
        # Ajouter une version texte plain pour les clients qui ne supportent pas HTML
        texte_brut = contenu_html.replace("<br>", "\n").replace("</p>", "\n\n")
        # Supprimer les balises HTML restantes
        import re
        texte_brut = re.sub(r'<[^>]+>', '', texte_brut)
        msg.attach(MIMEText(texte_brut, "plain", "utf-8"))
        msg.attach(MIMEText(contenu_html, "html", "utf-8"))
        
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USER, SMTP_MOT_DE_PASSE)
            server.send_message(msg)
        
        journal.info(f"✅ Email envoyé à {destinataire} via SMTP")
        return True
    except smtplib.SMTPAuthenticationError as e:
        journal.error(f"❌ Erreur authentification SMTP : mot de passe invalide. Vérifiez https://myaccount.google.com/apppasswords")
        return False
    except smtplib.SMTPRecipientsRefused as e:
        journal.error(f"❌ Destinataire refusé : {destinataire}")
        return False
    except Exception as e:
        journal.error(f"❌ Erreur envoi SMTP : {e}")
        return False


# ============ TEMPLATES D'EMAILS ============

def template_invitation(
    lien_invitation: str,
    role: str,
    domaine_nom: str | None = None,
    departement_nom: str | None = None,
    nom_invitant: str | None = None,
    message_personnalise: str | None = None,
) -> tuple[str, str]:
    """
    Retourne (sujet, contenu_html) pour un email d'invitation.
    
    Args:
        lien_invitation: URL pour créer le compte
        role: Rôle proposé (ex: "chef_police")
        domaine_nom: Nom du domaine (optionnel)
        departement_nom: Nom du département (optionnel)
        nom_invitant: Nom de la personne qui invite (optionnel)
        message_personnalise: Message personnalisé (optionnel)
    
    Returns:
        Tuple (sujet, contenu_html)
    """
    label_role = LABELS_ROLES.get(role, role.replace("_", " ").title())
    sujet = f"DigiID — Invitation à rejoindre en tant que {label_role}"
    
    # Construire le contexte
    contexte = f"""
    <div style="background: #f0f9ff; border-left: 4px solid #0284c7; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
        <h2 style="color: #0c4a6e; font-size: 20px; margin: 0 0 10px 0;">
            Vous êtes invité(e) à rejoindre DigiID
        </h2>
        <p style="color: #374151; font-size: 15px; margin: 0; line-height: 1.6;">
            Un administrateur vous invite à créer un compte avec un rôle spécifique.
        </p>
    </div>
    """
    
    # Détails du rôle
    details_role = f"""
    <div style="margin-bottom: 25px;">
        <h3 style="color: #111827; font-size: 16px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px;">
            Votre futur rôle
        </h3>
        <div style="background: #fef3c7; border: 1px solid #fcd34d; padding: 15px; border-radius: 8px; text-align: center;">
            <p style="font-size: 18px; font-weight: bold; color: #92400e; margin: 0;">
                {label_role}
            </p>
            {f'<p style="color: #78350f; font-size: 14px; margin: 5px 0 0 0;">Domaine : <strong>{domaine_nom}</strong></p>' if domaine_nom else ""}
            {f'<p style="color: #78350f; font-size: 14px; margin: 5px 0 0 0;">Département : <strong>{departement_nom}</strong></p>' if departement_nom else ""}
        </div>
    </div>
    """
    
    # Message personnalisé
    message_html = ""
    if message_personnalise:
        message_html = f"""
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; margin: 25px 0;">
            <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; font-weight: bold;">
                Message de {nom_invitant or "l'invitant"}
            </p>
            <p style="color: #374151; font-size: 14px; margin: 0; line-height: 1.5; font-style: italic;">
                "{message_personnalise}"
            </p>
        </div>
        """
    
    contenu_html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5; margin: 0;">
        <div style="max-width: 560px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 1px solid #e5e7eb;">
            <!-- En-tête -->
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #0284c7; font-size: 28px; margin: 0;">🏛️ DigiID</h1>
                <p style="color: #6b7280; font-size: 14px; margin-top: 5px;">Plateforme d'identité numérique</p>
            </div>
            
            {contexte}
            {details_role}
            
            <!-- Bouton d'action -->
            <div style="text-align: center; margin: 30px 0;">
                <a href="{lien_invitation}" 
                   style="display: inline-block; background: #0284c7; color: white; padding: 14px 32px; 
                          text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                    🚀 Activer mon compte
                </a>
            </div>
            
            <!-- Lien alternatif -->
            <p style="color: #6b7280; font-size: 13px; text-align: center; margin: 20px 0;">
                Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
                <a href="{lien_invitation}" style="color: #0284c7; word-break: break-all;">{lien_invitation}</a>
            </p>
            
            {message_html}
            
            <!-- Informations importantes -->
            <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; margin: 25px 0;">
                <p style="color: #991b1b; font-size: 13px; margin: 0; line-height: 1.5;">
                    ⚠️ <strong>Important :</strong> Ce lien expire dans <strong>7 jours</strong>. 
                    Après activation, vous devrez définir votre mot de passe et configurer la double authentification (2FA).
                </p>
            </div>
            
            <!-- Pied de page -->
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                Si vous n'avez pas demandé cette invitation, ignorez simplement cet email.<br>
                © 2026 DigiID — Système d'identité numérique africaine
            </p>
        </div>
    </body>
    </html>
    """
    
    return sujet, contenu_html


def template_rappel_invitation(
    lien_invitation: str,
    role: str,
    nom_invitant: str | None = None,
) -> tuple[str, str]:
    """
    Retourne (sujet, contenu_html) pour un email de rappel d'invitation.
    """
    label_role = LABELS_ROLES.get(role, role.replace("_", " ").title())
    sujet = f"DigiID — Rappel : Votre invitation est toujours active"
    
    contenu_html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5; margin: 0;">
        <div style="max-width: 480px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <!-- En-tête -->
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #0284c7; font-size: 28px; margin: 0;">🏛️ DigiID</h1>
                <p style="color: #6b7280; font-size: 14px; margin-top: 5px;">Rappel d'invitation</p>
            </div>
            
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">
                Bonjour,
            </p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">
                Ceci est un rappel concernant votre invitation à rejoindre DigiID en tant que :
            </p>
            
            <div style="background: #fef3c7; border: 1px solid #fcd34d; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <p style="font-size: 18px; font-weight: bold; color: #92400e; margin: 0;">
                    {label_role}
                </p>
            </div>
            
            <!-- Bouton d'action -->
            <div style="text-align: center; margin: 25px 0;">
                <a href="{lien_invitation}" 
                   style="display: inline-block; background: #0284c7; color: white; padding: 12px 28px; 
                          text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                    Activer mon compte
                </a>
            </div>
            
            <p style="color: #6b7280; font-size: 13px; text-align: center; margin: 20px 0;">
                Lien alternatif : <a href="{lien_invitation}" style="color: #0284c7; word-break: break-all;">{lien_invitation}</a>
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                L'équipe DigiID
            </p>
        </div>
    </body>
    </html>
    """
    
    return sujet, contenu_html