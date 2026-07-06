# -*- coding: utf-8 -*-
"""
Service de notifications — envoi d'emails, SMS et appels.

Méthodes d'envoi d'emails (par ordre de préférence) :
  1. SendGrid API (recommandé) — API HTTP, gratuit (100/jour), fiable
  2. SMTP Gmail (fallback automatique) — mot de passe d'application Google

Configuration :
  - SendGrid : définir SENDGRID_API_KEY dans .env
    Créer un compte : https://signup.sendgrid.com
  - SMTP Gmail : définir SMTP_MOT_DE_PASSE (mot de passe d'application Google)
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
    """Génère un code numérique à `longueur` chiffres."""
    return "".join(random.choices(string.digits, k=longueur))


def generer_token_invitation(longueur: int = 32) -> str:
    """Génère un token sécurisé pour les invitations."""
    alphabet = string.ascii_letters + string.digits
    return "".join(random.choices(alphabet, k=longueur))


# =============================================================================
# Envoi d'emails — Fonction principale avec fallback automatique
# =============================================================================

def envoyer_email(
    destinataire: str,
    sujet: str,
    corps_texte: str,
    corps_html: Optional[str] = None,
) -> bool:
    """
    Envoie un email avec fallback automatique :
      1. SendGrid API (SENDGRID_API_KEY) — recommandé
      2. SMTP Gmail (SMTP_MOT_DE_PASSE) — fallback
      3. Mode mock (log console) — si rien n'est configuré
    """
    # 1. Essayer SendGrid d'abord
    if parametres.sendgrid_api_key:
        succes = _envoyer_via_sendgrid(destinataire, sujet, corps_texte, corps_html)
        if succes:
            return True
        # Si échec, essayer SMTP en fallback
        journal.warning(
            f"[EMAIL] SendGrid a échoué, tentative fallback SMTP pour {destinataire}"
        )
    
    # 2. Fallback SMTP
    if parametres.smtp_mot_de_passe:
        return _envoyer_via_smtp(destinataire, sujet, corps_texte, corps_html)
    
    # 3. Mode mock
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
    """Envoie via l'API HTTP SendGrid."""
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
                "from": {"email": "noreply@digiid.africa", "name": "DigiID"},
                "subject": sujet,
                "content": contenu,
            },
            timeout=30.0,
        )
        
        if reponse.status_code in (200, 201, 202):
            journal.info(f"[EMAIL][SENDGRID] OK → {destinataire} | Sujet: {sujet}")
            return True
        
        journal.error(
            f"[EMAIL][SENDGRID] ERREUR → {destinataire} : "
            f"HTTP {reponse.status_code} - {reponse.text}"
        )
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
    
    # Toujours attacher le texte plain ET le HTML
    msg.attach(MIMEText(corps_texte, "plain", "utf-8"))
    
    if corps_html:
        msg.attach(MIMEText(corps_html, "html", "utf-8"))
    else:
        # ✅ CORRECTION : Utiliser chr(10) au lieu de \n dans f-string
        saut_ligne = chr(10)
        html_simple = (
            "<html><body style='font-family:Arial,sans-serif;padding:20px'>"
            + corps_texte.replace(saut_ligne, "<br>")
            + "</body></html>"
        )
        msg.attach(MIMEText(html_simple, "html", "utf-8"))
    
    try:
        serveur_smtp = parametres.smtp_serveur or "smtp.gmail.com"
        port_smtp = parametres.smtp_port or 587
        utilisateur = parametres.smtp_utilisateur or "bigdataism2024@gmail.com"
        
        with smtplib.SMTP(serveur_smtp, port_smtp, timeout=15) as serveur:
            serveur.ehlo()
            serveur.starttls()
            serveur.ehlo()
            serveur.login(utilisateur, parametres.smtp_mot_de_passe)
            serveur.sendmail(adresse_expediteur, [destinataire], msg.as_string())
        
        journal.info(f"[EMAIL][SMTP] OK → {destinataire} | Sujet: {sujet}")
        return True
    except smtplib.SMTPAuthenticationError:
        journal.error(
            f"[EMAIL][SMTP] ERREUR AUTH → {destinataire} : "
            "mot de passe d'application invalide. "
            "Vérifie https://myaccount.google.com/apppasswords"
        )
        return False
    except smtplib.SMTPRecipientsRefused:
        journal.error(f"[EMAIL][SMTP] DESTINATAIRE REFUSÉ → {destinataire}")
        return False
    except Exception as erreur:
        journal.error(f"[EMAIL][SMTP] ERREUR → {destinataire} : {erreur}")
        return False


# =============================================================================
# Emails spécifiques — Vérification email
# =============================================================================

def envoyer_email_verification(
    destinataire: str,
    code: str,
    prenom: Optional[str] = None,
) -> bool:
    """Envoie un email avec un code de vérification."""
    prenom_texte = f"{prenom}, " if prenom else ""
    sujet = "DigiID — Confirme ton adresse email"
    
    corps_texte = (
        "Bonjour " + prenom_texte + "\n\n"
        "Merci de t'être inscrit sur DigiID ! Pour finaliser ton inscription,\n"
        "confirme ton adresse email avec le code suivant :\n\n"
        "    " + code + "\n\n"
        "Ce code expire dans 10 minutes.\n\n"
        "Si tu n'as pas demandé cette vérification, ignore cet email.\n\n"
        "---\n"
        "L'équipe DigiID\n"
    )
    
    corps_html = (
        '<div style="max-width:480px;margin:0 auto;padding:20px;font-family:Arial,sans-serif">'
        '<h1 style="color:#1a73e8;font-size:24px;text-align:center">DigiID</h1>'
        f"<p>Bonjour {prenom_texte}</p>"
        "<p>Merci de t'être inscrit sur DigiID ! Pour finaliser ton inscription, confirme ton adresse email :</p>"
        '<div style="background:#f5f5f5;border-radius:8px;padding:20px;text-align:center;margin:20px 0">'
        f'<span style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#1a73e8">{code}</span>'
        "</div>"
        '<p style="color:#666;font-size:14px">Ce code expire dans 10 minutes.</p>'
        '<hr style="border:none;border-top:1px solid #eee;margin:20px 0">'
        '<p style="color:#999;font-size:12px">Si tu n\'as pas demandé cette vérification, ignore cet email.</p>'
        "</div>"
    )
    
    return envoyer_email(destinataire, sujet, corps_texte, corps_html)


def envoyer_email_changement(
    destinataire: str,
    code: str,
) -> bool:
    """Envoie un email pour confirmer un changement d'email."""
    sujet = "DigiID — Confirme ton nouvel email"
    
    corps_texte = (
        "Bonjour,\n\n"
        "Tu as demandé le changement de ton adresse email. Voici le code de confirmation :\n\n"
        "    " + code + "\n\n"
        "Ce code expire dans 10 minutes.\n\n"
        "Si tu n'as pas demandé ce changement, contacte le support immédiatement.\n\n"
        "---\n"
        "L'équipe DigiID\n"
    )
    
    corps_html = (
        '<div style="max-width:480px;margin:0 auto;padding:20px;font-family:Arial,sans-serif">'
        '<h1 style="color:#1a73e8;font-size:24px;text-align:center">DigiID</h1>'
        "<p>Bonjour,</p>"
        "<p>Tu as demandé le changement de ton adresse email. Voici le code de confirmation :</p>"
        '<div style="background:#f5f5f5;border-radius:8px;padding:20px;text-align:center;margin:20px 0">'
        f'<span style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#1a73e8">{code}</span>'
        "</div>"
        '<p style="color:#666;font-size:14px">Ce code expire dans 10 minutes.</p>'
        '<hr style="border:none;border-top:1px solid #eee;margin:20px 0">'
        '<p style="color:#999;font-size:12px">Si tu n\'as pas demandé ce changement, contacte le support immédiatement.</p>'
        "</div>"
    )
    
    return envoyer_email(destinataire, sujet, corps_texte, corps_html)


# =============================================================================
# Emails spécifiques — Invitations
# =============================================================================

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
}


def envoyer_email_invitation(
    destinataire: str,
    role: str,
    token: str,
    nom_invitant: Optional[str] = None,
    nom_domaine: Optional[str] = None,
    message_personnalise: Optional[str] = None,
) -> bool:
    """
    Envoie un email d'invitation à rejoindre DigiID avec un rôle spécifique.
    """
    label_role = LABELS_ROLES.get(role, role.replace("_", " ").title())
    
    # ✅ CORRECTION : Utiliser l'URL du frontend depuis la config
    url_frontend = parametres.url_frontend.rstrip("/")
    url_activation = f"{url_frontend}/accepter-invitation/{token}"
    
    sujet = f"DigiID — Invitation à rejoindre en tant que {label_role}"
    
    # Corps texte
    domaine_texte = f"    Domaine : {nom_domaine}" if nom_domaine else ""
    invitant_texte = f"    Invité par : {nom_invitant}" if nom_invitant else ""
    message_texte = f"Message de l'invitant :\n{message_personnalise}" if message_personnalise else ""
    
    corps_texte = (
        "Bonjour,\n\n"
        "Vous avez été invité(e) à rejoindre la plateforme DigiID avec le rôle suivant :\n\n"
        f"    {label_role}\n"
        f"{domaine_texte}\n"
        f"{invitant_texte}\n\n"
        "Pour activer votre compte, cliquez sur le lien ci-dessous :\n\n"
        f"    {url_activation}\n\n"
        "Ce lien expire dans 7 jours.\n\n"
        f"{message_texte}\n\n"
        "Si vous n'avez pas demandé cette invitation, ignorez cet email.\n\n"
        "---\n"
        "L'équipe DigiID\n"
    )
    
    # Corps HTML
    domaine_html = (
        f'<p style="color:#78350f;font-size:14px;margin:5px 0 0 0">'
        f'Domaine : <strong>{nom_domaine}</strong></p>'
    ) if nom_domaine else ""
    
    nom_invitant_affiche = nom_invitant or "l'invitant"
    message_html = (
        '<div style="background:#f9fafb;border:1px solid #e5e7eb;padding:15px;border-radius:8px;margin:25px 0">'
        f'<p style="color:#6b7280;font-size:12px;margin:0 0 8px 0;text-transform:uppercase;font-weight:bold">'
        f'Message de {nom_invitant_affiche}</p>'
        f'<p style="color:#374151;font-size:14px;margin:0;line-height:1.5;font-style:italic">'
        f'"{message_personnalise}"</p>'
        '</div>'
    ) if message_personnalise else ""
    
    corps_html = (
        '<div style="max-width:560px;margin:0 auto;padding:30px;font-family:Arial,sans-serif;'
        'background:#ffffff;border:1px solid #e5e7eb;border-radius:12px">'
        '<!-- En-tête -->'
        '<div style="text-align:center;margin-bottom:30px">'
        '<h1 style="color:#0284c7;font-size:28px;margin:0">🏛️ DigiID</h1>'
        '<p style="color:#6b7280;font-size:14px;margin-top:5px">Plateforme d\'identité numérique</p>'
        '</div>'
        '<!-- Message principal -->'
        '<div style="background:#f0f9ff;border-left:4px solid #0284c7;padding:20px;border-radius:8px;margin-bottom:25px">'
        '<h2 style="color:#0c4a6e;font-size:20px;margin:0 0 10px 0">'
        'Vous êtes invité(e) à rejoindre DigiID</h2>'
        '<p style="color:#374151;font-size:15px;margin:0;line-height:1.6">'
        'Un administrateur vous invite à créer un compte avec un rôle spécifique.</p>'
        '</div>'
        '<!-- Détails du rôle -->'
        '<div style="margin-bottom:25px">'
        '<h3 style="color:#111827;font-size:16px;margin:0 0 15px 0;text-transform:uppercase;letter-spacing:1px">'
        'Votre futur rôle</h3>'
        '<div style="background:#fef3c7;border:1px solid #fcd34d;padding:15px;border-radius:8px;text-align:center">'
        f'<p style="font-size:18px;font-weight:bold;color:#92400e;margin:0">{label_role}</p>'
        f'{domaine_html}'
        '</div>'
        '</div>'
        '<!-- Bouton d\'action -->'
        '<div style="text-align:center;margin:30px 0">'
        f'<a href="{url_activation}" '
        'style="display:inline-block;background:#0284c7;color:white;padding:14px 32px;'
        'text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px">'
        '🚀 Activer mon compte</a>'
        '</div>'
        '<!-- Lien alternatif -->'
        '<p style="color:#6b7280;font-size:13px;text-align:center;margin:20px 0">'
        'Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>'
        f'<a href="{url_activation}" style="color:#0284c7;word-break:break-all">{url_activation}</a>'
        '</p>'
        f'{message_html}'
        '<!-- Informations importantes -->'
        '<div style="background:#fef2f2;border:1px solid #fecaca;padding:15px;border-radius:8px;margin:25px 0">'
        '<p style="color:#991b1b;font-size:13px;margin:0;line-height:1.5">'
        '⚠️ <strong>Important :</strong> Ce lien expire dans <strong>7 jours</strong>. '
        'Après activation, vous devrez définir votre mot de passe et configurer la double authentification (2FA).</p>'
        '</div>'
        '<!-- Pied de page -->'
        '<hr style="border:none;border-top:1px solid #e5e7eb;margin:30px 0">'
        '<p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">'
        'Si vous n\'avez pas demandé cette invitation, ignorez simplement cet email.<br>'
        '© 2026 DigiID</p>'
        '</div>'
    )
    
    return envoyer_email(destinataire, sujet, corps_texte, corps_html)


def envoyer_email_renvoyer_invitation(
    destinataire: str,
    role: str,
    token: str,
    nom_invitant: Optional[str] = None,
) -> bool:
    """
    Envoie un email de rappel pour une invitation déjà envoyée.
    """
    label_role = LABELS_ROLES.get(role, role.replace("_", " ").title())
    # ✅ CORRECTION : URL cohérente
    url_activation = f"https://digiid.africa/accepter-invitation/{token}"
    
    sujet = "DigiID — Rappel : Votre invitation est toujours active"
    
    corps_texte = (
        "Bonjour,\n\n"
        "Ceci est un rappel concernant votre invitation à rejoindre DigiID en tant que :\n\n"
        f"    {label_role}\n\n"
        "Votre invitation est toujours active. Pour activer votre compte, cliquez ici :\n\n"
        f"    {url_activation}\n\n"
        "Ce lien expire dans 7 jours à compter de la première invitation.\n\n"
        "---\n"
        "L'équipe DigiID\n"
    )
    
    corps_html = (
        '<div style="max-width:480px;margin:0 auto;padding:20px;font-family:Arial,sans-serif">'
        '<h1 style="color:#0284c7;font-size:24px;text-align:center">DigiID</h1>'
        "<p>Bonjour,</p>"
        "<p>Ceci est un rappel concernant votre invitation à rejoindre DigiID en tant que :</p>"
        '<div style="background:#fef3c7;border:1px solid #fcd34d;padding:15px;border-radius:8px;text-align:center;margin:20px 0">'
        f'<p style="font-size:18px;font-weight:bold;color:#92400e;margin:0">{label_role}</p>'
        '</div>'
        '<div style="text-align:center;margin:25px 0">'
        f'<a href="{url_activation}" '
        'style="display:inline-block;background:#0284c7;color:white;padding:12px 28px;'
        'text-decoration:none;border-radius:8px;font-weight:bold">'
        'Activer mon compte</a>'
        '</div>'
        '<p style="color:#6b7280;font-size:13px">'
        f'Lien alternatif : <a href="{url_activation}" style="color:#0284c7">{url_activation}</a>'
        '</p>'
        '<hr style="border:none;border-top:1px solid #eee;margin:20px 0">'
        "<p style=\"color:#999;font-size:12px\">L'équipe DigiID</p>"
        '</div>'
    )
    
    return envoyer_email(destinataire, sujet, corps_texte, corps_html)


# =============================================================================
# SMS
# =============================================================================

def envoyer_sms(telephone: str, message: str) -> bool:
    journal.info(f"[SMS][MOCK] A: {telephone}\nMessage: {message}")
    return True


def envoyer_sms_verification(telephone: str, code: str) -> bool:
    return envoyer_sms(
        telephone,
        f"DigiID — Ton code de vérification est : {code}. Ce code expire dans 10 minutes."
    )


# =============================================================================
# Appel vocal
# =============================================================================

def passer_appel_verification(telephone: str, code: str) -> bool:
    journal.info(
        f"[APPEL][MOCK] A: {telephone}\n"
        f"Message vocal: Bonjour, voici votre code DigiID : {code}. "
        f"Je répète : {code}. Ce code expire dans 10 minutes."
    )
    return True