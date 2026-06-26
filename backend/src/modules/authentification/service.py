# -*- coding: utf-8 -*-
"""
Service d'authentification — logique métier pure.

Aucune dépendance à FastAPI ici. Le service prend ses entrées en argument,
renvoie ses sorties, et lève des exceptions métier en cas d'erreur.

Cela permet de tester unitairement sans monter d'API.
"""
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import parametres
from src.config.constantes import RolesUtilisateur, TypesEvenementAudit
from src.modeles import Utilisateur, SessionAuthentification, JournalAudit
from src.modules.authentification.jetons import (
    creer_token_acces, creer_token_rafraichissement, decoder_jeton,
)
from src.modules.gamification import service_badges, service_parrainage, service_tracking
from src.noyau import (
    hacher_mot_de_passe, verifier_mot_de_passe,
    chiffrer_donnee, dechiffrer_donnee,
    generer_token_aleatoire, journal,
)
from src.noyau.exceptions import (
    ErreurAuthentification, ErreurCompteVerrouille,
    ErreurConflit, ErreurValidation, Erreur2FARequis, Erreur2FAInvalide,
)
from src.modules.authentification.totp import verifier_code_totp
from src.modeles.token_reinitialisation import TokenReinitialisation
from src.noyau.notification import envoyer_email
from src.noyau.journal import journal_audit


# =============================================================================
# Helpers internes
# =============================================================================

def _hasher_email(email: str) -> str:
    """
    Hash SHA-256 de l'email — permet la recherche en base sans déchiffrer.
    Le sel n'est pas nécessaire ici car on veut justement pouvoir comparer.
    """
    return hashlib.sha256(email.lower().strip().encode("utf-8")).hexdigest()


def _hash_refresh_token(token: str) -> str:
    """Hash du refresh token avant stockage en base."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _generer_digiid_public() -> str:
    """Génère un identifiant DigiID public 16 caractères."""
    import secrets, string
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(16))


# =============================================================================
# Service d'authentification — fonctions métier
# =============================================================================

async def inscrire_utilisateur(
    session: AsyncSession,
    email: str,
    mot_de_passe: str,
    prenom: str,
    nom: str,
    telephone: Optional[str] = None,
    ville: Optional[str] = None,
    code_parrainage: Optional[str] = None,
    role: str = RolesUtilisateur.CITOYEN.value,
    adresse_ip: str = "",
) -> Utilisateur:
    """
    Inscrit un nouvel utilisateur.

    Étapes :
        1. Vérifier qu'aucun compte n'existe avec cet email
        2. Hacher le mot de passe (Argon2id)
        3. Chiffrer les données personnelles (AES-256-GCM)
        4. Générer un DigiID public unique
        5. Créer l'utilisateur en base
        6. Tracer l'événement dans le journal d'audit

    Lève :
        ErreurConflit si l'email est déjà utilisé.
    """
    email_hash = _hasher_email(email)

    # 1. Vérifier unicité (exclut les comptes soft-deletés)
    resultat = await session.execute(
        select(Utilisateur).where(
            Utilisateur.email_hash == email_hash,
            Utilisateur.est_supprime == False,
        )
    )
    if resultat.scalar_one_or_none() is not None:
        journal.warning(f"Tentative d'inscription avec email déjà utilisé (hash={email_hash[:8]}...)")
        raise ErreurConflit(
            f"Email déjà enregistré : {email_hash[:8]}...",
            message_utilisateur="Un compte existe déjà avec cet email.",
        )

    # 2-4. Créer l'utilisateur
    telephone_chiffre = chiffrer_donnee(telephone) if telephone else None
    parrainage = None  # Initialiser avant le bloc conditionnel

    nouvel_utilisateur = Utilisateur(
        email_chiffre=chiffrer_donnee(email),
        email_hash=email_hash,
        mot_de_passe_hash=hacher_mot_de_passe(mot_de_passe),
        prenom_chiffre=chiffrer_donnee(prenom),
        nom_chiffre=chiffrer_donnee(nom),
        telephone_chiffre=telephone_chiffre,
        ville=ville,
        role=role,
        digiid_public=_generer_digiid_public(),
        code_parrainage=None,
        est_actif=True,
        est_email_verifie=False,
    )
    session.add(nouvel_utilisateur)

    try:
        await session.flush()  # Pour obtenir l'ID
    except IntegrityError as e:
        await session.rollback()
        # Vérifier si l'erreur vient d'un doublon d'email
        if "ix_utilisateur_email_hash" in str(e.orig):
            journal.warning(
                f"Tentative d'inscription avec email déjà utilisé (race condition) "
                f"(hash={email_hash[:8]}...)"
            )
            raise ErreurConflit(
                f"Email déjà enregistré (race condition) : {email_hash[:8]}...",
                message_utilisateur="Un compte existe déjà avec cet email.",
            )
        # Vérifier si c'est un doublon de digiid_public (extrêmement rare mais possible)
        if "ix_utilisateur_digiid_public" in str(e.orig) or "ix_utilisateur_digiid" in str(e.orig):
            # Laisser le code retenter avec un nouveau digiid
            nouvel_utilisateur.digiid_public = _generer_digiid_public()
            session.add(nouvel_utilisateur)
            await session.flush()
        else:
            # Erreur inconnue — laisser remonter
            raise

    # 5. Audit
    await _enregistrer_audit(
        session,
        utilisateur_id=nouvel_utilisateur.id,
        role_acteur=role,
        type_evenement=TypesEvenementAudit.INSCRIPTION.value,
        description=f"Inscription de l'utilisateur {nouvel_utilisateur.id}",
        adresse_ip=adresse_ip,
    )

    if code_parrainage:
        parrainage = await service_parrainage.appliquer_parrainage(
            session=session,
            nouveau_utilisateur=nouvel_utilisateur,
            code_parrain=code_parrainage,
        )
        if parrainage is None:
            journal.warning(
                f"Inscription avec code de parrainage invalide : {code_parrainage} "
                f"pour utilisateur={nouvel_utilisateur.id}"
            )

    await session.commit()
    if parrainage is not None:
        resultat_parrain = await session.execute(
            select(Utilisateur).where(Utilisateur.id == parrainage.parrain_id)
        )
        parrain = resultat_parrain.scalar_one_or_none()
        if parrain is not None:
            nouveaux_badges = await service_badges.verifier_et_debloquer_badges(session, parrain)
            if nouveaux_badges:
                await session.commit()

    journal.info(f"Nouvel utilisateur inscrit : id={nouvel_utilisateur.id} role={role}")

    return nouvel_utilisateur


async def creer_session_apres_inscription(
    session: AsyncSession,
    utilisateur: Utilisateur,
    adresse_ip: str = "",
    agent_utilisateur: Optional[str] = None,
) -> Tuple[str, str]:
    """
    Crée une session immédiatement après l'inscription pour que l'utilisateur
    soit connecté automatiquement.

    Retourne (token_acces, token_rafraichissement)
    """
    token_acces = creer_token_acces(str(utilisateur.id), utilisateur.role)
    token_rafraichissement = creer_token_rafraichissement(str(utilisateur.id), utilisateur.role)

    session_auth = SessionAuthentification(
        utilisateur_id=utilisateur.id,
        refresh_token_hash=_hash_refresh_token(token_rafraichissement),
        adresse_ip=adresse_ip,
        agent_utilisateur=agent_utilisateur,
        date_expiration=datetime.now(timezone.utc) + timedelta(days=parametres.duree_token_rafraichissement_jours),
        date_derniere_utilisation=datetime.now(timezone.utc),
    )
    session.add(session_auth)

    await service_tracking.tracker_action(session, utilisateur, "inscription")
    await session.commit()

    journal.info(
        f"Session créée après inscription : utilisateur={utilisateur.id}"
    )
    return token_acces, token_rafraichissement


async def authentifier_utilisateur(
    session: AsyncSession,
    email: str,
    mot_de_passe: str,
    code_2fa: Optional[str] = None,
    adresse_ip: str = "",
    agent_utilisateur: Optional[str] = None,
) -> Tuple[Utilisateur, str, str]:
    """
    Authentifie un utilisateur et crée une session.

    Retour :
        Tuple (utilisateur, token_acces, token_rafraichissement)

    Lève :
        ErreurAuthentification, ErreurCompteVerrouille
    """
    email_hash = _hasher_email(email)

    # 1. Chercher l'utilisateur
    resultat = await session.execute(
        select(Utilisateur).where(
            Utilisateur.email_hash == email_hash,
            Utilisateur.est_supprime == False,
        )
    )
    utilisateur = resultat.scalar_one_or_none()

    if utilisateur is None:
        # On simule un coût de vérification pour empêcher l'énumération d'emails
        verifier_mot_de_passe(mot_de_passe, "$argon2id$v=19$m=65536,t=3,p=4$invalide$invalide")
        await _enregistrer_audit(
            session, utilisateur_id=None,
            type_evenement=TypesEvenementAudit.CONNEXION_ECHOUEE.value,
            description=f"Connexion échouée — email inconnu (hash={email_hash[:8]}...)",
            adresse_ip=adresse_ip,
        )
        await session.commit()
        raise ErreurAuthentification("Email ou mot de passe incorrect")

    # 2. Vérifier que le compte est utilisable
    if not utilisateur.est_actif:
        raise ErreurAuthentification(
            f"Compte désactivé (id={utilisateur.id})",
            message_utilisateur="Compte désactivé. Contactez le support.",
        )
    if utilisateur.est_verrouille:
        # Vérifier si le verrouillage est encore actif (5 minutes)
        if utilisateur.date_verrouillage and \
           datetime.now(timezone.utc) - utilisateur.date_verrouillage < timedelta(minutes=5):
            minutes_restantes = 5 - int((datetime.now(timezone.utc) - utilisateur.date_verrouillage).total_seconds() / 60)
            raise ErreurCompteVerrouille(
                f"Compte verrouillé id={utilisateur.id}",
                message_utilisateur=(
                    f"Compte temporairement verrouillé. Réessaie dans {minutes_restantes} minute(s)."
                ),
            )
        # Sinon, déverrouiller
        utilisateur.est_verrouille = False
        utilisateur.tentatives_connexion_echouees = 0

    # 3. Vérifier le mot de passe
    if not verifier_mot_de_passe(mot_de_passe, utilisateur.mot_de_passe_hash):
        utilisateur.tentatives_connexion_echouees += 1
        if utilisateur.tentatives_connexion_echouees >= parametres.seuil_tentatives_connexion_echec:
            utilisateur.est_verrouille = True
            utilisateur.date_verrouillage = datetime.now(timezone.utc)
            journal.warning(f"Compte verrouillé après {utilisateur.tentatives_connexion_echouees} échecs : id={utilisateur.id}")
        await _enregistrer_audit(
            session, utilisateur_id=utilisateur.id,
            type_evenement=TypesEvenementAudit.CONNEXION_ECHOUEE.value,
            description="Mot de passe incorrect",
            adresse_ip=adresse_ip,
        )
        await session.commit()
        raise ErreurAuthentification("Email ou mot de passe incorrect")

    # 4. Vérifier 2FA si activé (ou obligatoire pour ce rôle sans configuration)
    role_necessite_2fa = (
        utilisateur.role in (RolesUtilisateur.ADMINISTRATEUR.value,
                              RolesUtilisateur.SUPER_ADMINISTRATEUR.value)
        and parametres.activer_2fa_obligatoire_admin
    )

    if role_necessite_2fa and not utilisateur.deux_fa_active:
        raise ErreurAuthentification(
            f"2FA obligatoire non configurée pour admin id={utilisateur.id}",
            message_utilisateur=(
                "La double authentification est obligatoire pour les administrateurs. "
                "Contactez le super administrateur pour l'activer sur votre compte."
            ),
        )

    if utilisateur.deux_fa_active:
        if not code_2fa:
            raise Erreur2FARequis("Code 2FA manquant")
        if not utilisateur.secret_2fa_chiffre:
            raise ErreurAuthentification(
                f"2FA active sans secret pour id={utilisateur.id}",
                message_utilisateur="Configuration 2FA invalide. Contactez le support.",
            )
        if not verifier_code_totp(utilisateur.secret_2fa_chiffre, code_2fa):
            await _enregistrer_audit(
                session, utilisateur_id=utilisateur.id,
                type_evenement=TypesEvenementAudit.VERIFICATION_2FA_ECHOUEE.value,
                description="Code 2FA incorrect",
                adresse_ip=adresse_ip,
            )
            await session.commit()
            raise Erreur2FAInvalide("Code TOTP incorrect")

    # 5. Réussite — réinitialiser les compteurs et créer la session
    utilisateur.tentatives_connexion_echouees = 0
    utilisateur.date_derniere_connexion = datetime.now(timezone.utc)
    utilisateur.ip_derniere_connexion = adresse_ip

    token_acces = creer_token_acces(str(utilisateur.id), utilisateur.role)
    token_rafraichissement = creer_token_rafraichissement(str(utilisateur.id), utilisateur.role)

    session_auth = SessionAuthentification(
        utilisateur_id=utilisateur.id,
        refresh_token_hash=_hash_refresh_token(token_rafraichissement),
        adresse_ip=adresse_ip,
        agent_utilisateur=agent_utilisateur,
        date_expiration=datetime.now(timezone.utc) + timedelta(days=parametres.duree_token_rafraichissement_jours),
        date_derniere_utilisation=datetime.now(timezone.utc),
    )
    session.add(session_auth)

    await _enregistrer_audit(
        session, utilisateur_id=utilisateur.id,
        role_acteur=utilisateur.role,
        type_evenement=TypesEvenementAudit.CONNEXION_REUSSIE.value,
        description=f"Connexion réussie depuis {adresse_ip}",
        adresse_ip=adresse_ip,
        agent_utilisateur=agent_utilisateur,
    )

    await service_tracking.tracker_action(session, utilisateur, "connexion")
    await service_badges.verifier_et_debloquer_badges(session, utilisateur)
    await session.commit()

    journal.info(f"Connexion réussie : utilisateur={utilisateur.id} rôle={utilisateur.role}")
    return utilisateur, token_acces, token_rafraichissement


async def deconnecter_session(
    session: AsyncSession,
    refresh_token: str,
    utilisateur_id: UUID,
) -> None:
    """Révoque le refresh token et marque la session comme déconnectée."""
    hash_token = _hash_refresh_token(refresh_token)

    resultat = await session.execute(
        select(SessionAuthentification).where(
            SessionAuthentification.refresh_token_hash == hash_token,
            SessionAuthentification.utilisateur_id == utilisateur_id,
        )
    )
    session_auth = resultat.scalar_one_or_none()

    if session_auth is not None:
        session_auth.est_revoquee = True
        session_auth.raison_revocation = "deconnexion_volontaire"
        await _enregistrer_audit(
            session,
            utilisateur_id=utilisateur_id,
            type_evenement=TypesEvenementAudit.DECONNEXION.value,
            description="Déconnexion volontaire",
        )
        await session.commit()
        journal.info(f"Session déconnectée : utilisateur={utilisateur_id}")


async def rafraichir_token(
    session: AsyncSession,
    refresh_token: str,
) -> Tuple[str, str]:
    """
    Échange un refresh token contre une nouvelle paire (acces, refresh).

    Le refresh token est rotaté à chaque utilisation pour limiter
    l'impact d'un vol de token.
    """
    contenu = decoder_jeton(refresh_token, type_attendu="rafraichissement")
    hash_token = _hash_refresh_token(refresh_token)

    resultat = await session.execute(
        select(SessionAuthentification).where(
            SessionAuthentification.refresh_token_hash == hash_token,
            SessionAuthentification.est_revoquee == False,
            SessionAuthentification.date_expiration > datetime.now(timezone.utc),
        )
    )
    session_auth = resultat.scalar_one_or_none()

    if session_auth is None:
        raise ErreurAuthentification(
            "Session expirée ou révoquée",
            message_utilisateur="Session expirée, veuillez vous reconnecter.",
        )

    # Rotation des tokens
    nouveau_acces = creer_token_acces(contenu.sub, contenu.role)
    nouveau_refresh = creer_token_rafraichissement(contenu.sub, contenu.role)

    # Révoquer l'ancien, créer un nouveau
    session_auth.est_revoquee = True
    session_auth.raison_revocation = "rotation"

    nouvelle_session = SessionAuthentification(
        utilisateur_id=UUID(contenu.sub),
        refresh_token_hash=_hash_refresh_token(nouveau_refresh),
        adresse_ip=session_auth.adresse_ip,
        agent_utilisateur=session_auth.agent_utilisateur,
        date_expiration=datetime.now(timezone.utc) + timedelta(days=parametres.duree_token_rafraichissement_jours),
        date_derniere_utilisation=datetime.now(timezone.utc),
    )
    session.add(nouvelle_session)
    await session.commit()

    return nouveau_acces, nouveau_refresh


async def _enregistrer_audit(
    session: AsyncSession,
    type_evenement: str,
    description: str,
    utilisateur_id: Optional[UUID] = None,
    role_acteur: Optional[str] = None,
    adresse_ip: Optional[str] = None,
    agent_utilisateur: Optional[str] = None,
    donnees_supplementaires: Optional[dict] = None,
) -> None:
    """Crée une entrée dans le journal d'audit."""
    entree = JournalAudit(
        date_evenement=datetime.now(timezone.utc),
        utilisateur_id=utilisateur_id,
        role_acteur=role_acteur,
        type_evenement=type_evenement,
        description=description,
        adresse_ip=adresse_ip,
        agent_utilisateur=agent_utilisateur,
        donnees_supplementaires=donnees_supplementaires,
    )
    session.add(entree)
    journal_audit(
        f"{type_evenement} | utilisateur={utilisateur_id} | {description}",
    )


# =============================================================================
# Mot de passe oublié / réinitialisation
# =============================================================================

import secrets


def _generer_token_reinitialisation() -> str:
    """Génère un token aléatoire sécurisé pour la réinitialisation."""
    return secrets.token_urlsafe(48)


def _masquer_email(email: str) -> str:
    """Masque partiellement un email pour l'affichage.
    
    Exemple : a***@example.com
    """
    if "@" not in email:
        return email
    nom, domaine = email.split("@", 1)
    if len(nom) <= 2:
        nom_masque = nom[0] + "***"
    else:
        nom_masque = nom[0] + "***" + nom[-1]
    return f"{nom_masque}@{domaine}"


async def demander_reinitialisation_mot_de_passe(
    session: AsyncSession,
    email: str,
    frontend_url: str | None = None,
    adresse_ip: str = "",
) -> dict:
    """
    Demande un lien de réinitialisation de mot de passe.
    
    Si l'email existe, génère un token, le stocke en base
    et envoie un email avec le lien de réinitialisation.
    
    La réponse est délibérément identique que l'email existe ou non
    (message d'évitement d'énumération de comptes).
    
    Retourne un dict avec :
        - succes: bool
        - message: str
        - destination_masquee: str (si compte trouvé)
        - duree_validite_minutes: int
        - token_dev: str | None (visible uniquement en dev)
    """
    email_hash = _hasher_email(email)
    duree_validite_minutes = 30

    # Chercher l'utilisateur
    resultat = await session.execute(
        select(Utilisateur).where(
            Utilisateur.email_hash == email_hash,
            Utilisateur.est_supprime == False,
        )
    )
    utilisateur = resultat.scalar_one_or_none()

    # Message identique dans tous les cas (prévention énumération)
    message = (
        "Si un compte existe avec cet email, un lien de réinitialisation "
        "vient d'être envoyé. Vérifie ta boîte de réception et tes spams."
    )

    if utilisateur is None:
        journal.info(
            f"Demande de réinitialisation pour email inconnu (hash={email_hash[:8]}...)"
        )
        # On simule quand même un log pour éviter l'énumération
        await _enregistrer_audit(
            session,
            type_evenement="demande_reinitialisation_mdp",
            description=f"Demande pour email inconnu (hash={email_hash[:8]}...)",
            adresse_ip=adresse_ip,
        )
        await session.commit()
        return {
            "succes": True,
            "message": message,
            "destination_masquee": _masquer_email(email),
            "duree_validite_minutes": duree_validite_minutes,
            "token_dev": None,
        }

    # L'utilisateur existe — vérifier qu'il est actif
    if not utilisateur.est_actif:
        journal.warning(
            f"Demande de réinitialisation pour compte désactivé id={utilisateur.id}"
        )
        await _enregistrer_audit(
            session,
            type_evenement="demande_reinitialisation_mdp",
            description=f"Compte désactivé id={utilisateur.id}",
            adresse_ip=adresse_ip,
        )
        await session.commit()
        return {
            "succes": True,
            "message": message,
            "destination_masquee": _masquer_email(email),
            "duree_validite_minutes": duree_validite_minutes,
            "token_dev": None,
        }

    # Générer le token
    token = _generer_token_reinitialisation()
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

    # Révoquer les anciens tokens non utilisés
    anciens_tokens = await session.execute(
        select(TokenReinitialisation).where(
            TokenReinitialisation.utilisateur_id == utilisateur.id,
            TokenReinitialisation.est_utilise == False,
            TokenReinitialisation.date_expiration > datetime.now(timezone.utc),
        )
    )
    for ancien in anciens_tokens.scalars().all():
        ancien.est_utilise = True

    # Sauvegarder le nouveau token
    nouveau_token = TokenReinitialisation(
        utilisateur_id=utilisateur.id,
        token_hash=token_hash,
        date_expiration=datetime.now(timezone.utc) + timedelta(minutes=duree_validite_minutes),
        adresse_ip_demande=adresse_ip,
    )
    session.add(nouveau_token)

    # Envoyer l'email
    email_destinataire = dechiffrer_donnee(utilisateur.email_chiffre)
    prenom_utilisateur = dechiffrer_donnee(utilisateur.prenom_chiffre) if utilisateur.prenom_chiffre else None

    # Construire le lien de réinitialisation (URL dynamique du frontend)
    url_frontend = frontend_url or parametres.url_frontend or "http://localhost:3000"
    lien_reinitialisation = f"{url_frontend}/mot-de-passe-oublie/reinitialiser?token={token}"

    sujet = "DigiID — Réinitialisation de ton mot de passe"
    prenom_texte = f"{prenom_utilisateur}, " if prenom_utilisateur else ""
    corps_texte = f"""
Bonjour {prenom_texte}

Tu as demandé la réinitialisation de ton mot de passe DigiID.

Clique sur le lien ci-dessous pour choisir un nouveau mot de passe :

{lien_reinitialisation}

Ce lien expire dans {duree_validite_minutes} minutes.

Si tu n'as pas demandé cette réinitialisation, ignore cet email.
Ton mot de passe actuel reste valide.

---
L'équipe DigiID
"""
    corps_html = f"""
<div style="max-width:480px;margin:0 auto;padding:20px;font-family:Arial,sans-serif">
    <h1 style="color:#1a73e8;font-size:24px;text-align:center">DigiID</h1>
    <p>Bonjour {prenom_texte}</p>
    <p>Tu as demandé la réinitialisation de ton mot de passe DigiID.</p>
    <div style="text-align:center;margin:20px 0">
        <a href="{lien_reinitialisation}"
           style="display:inline-block;background:#1a73e8;color:white;padding:14px 28px;
                  border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold">
            Réinitialiser mon mot de passe
        </a>
    </div>
    <p style="color:#666;font-size:14px">Ce lien expire dans {duree_validite_minutes} minutes.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
    <p style="color:#999;font-size:12px">
        Si tu n'as pas demandé cette réinitialisation, ignore cet email.<br>
        Ton mot de passe actuel reste valide.
    </p>
</div>"""

    envoyer_email(email_destinataire, sujet, corps_texte, corps_html)

    # Audit
    await _enregistrer_audit(
        session,
        utilisateur_id=utilisateur.id,
        role_acteur=utilisateur.role,
        type_evenement="demande_reinitialisation_mdp",
        description=f"Lien de réinitialisation envoyé à {_masquer_email(email_destinataire)}",
        adresse_ip=adresse_ip,
    )
    await session.commit()

    journal.info(
        f"Lien de réinitialisation envoyé : utilisateur={utilisateur.id} "
        f"email={_masquer_email(email_destinataire)}"
    )

    return {
        "succes": True,
        "message": message,
        "destination_masquee": _masquer_email(email_destinataire),
        "duree_validite_minutes": duree_validite_minutes,
        "token_dev": token if parametres.est_developpement else None,
    }


async def reinitialiser_mot_de_passe(
    session: AsyncSession,
    token: str,
    nouveau_mot_de_passe: str,
    adresse_ip: str = "",
) -> dict:
    """
    Réinitialise le mot de passe avec un token valide.
    
    Vérifie que le token existe, n'est pas expiré, n'a pas été utilisé.
    Met à jour le mot de passe et invalide toutes les sessions actives.
    
    Retourne un dict avec :
        - succes: bool
        - message: str
    """
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

    # Chercher le token
    resultat = await session.execute(
        select(TokenReinitialisation).where(
            TokenReinitialisation.token_hash == token_hash,
        )
    )
    token_objet = resultat.scalar_one_or_none()

    if token_objet is None:
        journal.warning(
            f"Tentative de réinitialisation avec token inconnu (hash={token_hash[:8]}...)"
        )
        raise ErreurAuthentification(
            "Token de réinitialisation invalide",
            message_utilisateur="Ce lien de réinitialisation est invalide ou a déjà été utilisé.",
        )

    # Vérifier si déjà utilisé
    if token_objet.est_utilise:
        journal.warning(
            f"Token déjà utilisé : utilisateur={token_objet.utilisateur_id}"
        )
        raise ErreurAuthentification(
            "Token déjà utilisé",
            message_utilisateur="Ce lien de réinitialisation a déjà été utilisé. "
            "Fais une nouvelle demande si tu as besoin de réinitialiser ton mot de passe.",
        )

    # Vérifier expiration
    if token_objet.date_expiration < datetime.now(timezone.utc):
        journal.warning(
            f"Token expiré : utilisateur={token_objet.utilisateur_id}"
        )
        raise ErreurAuthentification(
            "Token expiré",
            message_utilisateur="Ce lien de réinitialisation a expiré. "
            "Fais une nouvelle demande pour recevoir un nouveau lien.",
        )

    # Vérifier tentatives max (5 max)
    if token_objet.tentative >= 5:
        token_objet.est_utilise = True
        journal.warning(
            f"Trop de tentatives pour le token : utilisateur={token_objet.utilisateur_id}"
        )
        raise ErreurAuthentification(
            "Trop de tentatives",
            message_utilisateur="Trop de tentatives. Fais une nouvelle demande pour recevoir un nouveau lien.",
        )

    # Récupérer l'utilisateur
    resultat_utilisateur = await session.execute(
        select(Utilisateur).where(
            Utilisateur.id == token_objet.utilisateur_id,
            Utilisateur.est_supprime == False,
        )
    )
    utilisateur = resultat_utilisateur.scalar_one_or_none()

    if utilisateur is None:
        token_objet.est_utilise = True
        await session.commit()
        raise ErreurAuthentification(
            "Utilisateur introuvable",
            message_utilisateur="Ce compte n'existe plus. Contacte le support.",
        )

    if not utilisateur.est_actif:
        raise ErreurAuthentification(
            "Compte désactivé",
            message_utilisateur="Ce compte est désactivé. Contacte le support.",
        )

    # Mettre à jour le mot de passe
    utilisateur.mot_de_passe_hash = hacher_mot_de_passe(nouveau_mot_de_passe)

    # Marquer le token comme utilisé
    token_objet.est_utilise = True
    token_objet.date_utilisation = datetime.now(timezone.utc)

    # Révoquer toutes les sessions actives pour forcer la reconnexion
    sessions_actives = await session.execute(
        select(SessionAuthentification).where(
            SessionAuthentification.utilisateur_id == utilisateur.id,
            SessionAuthentification.est_revoquee == False,
        )
    )
    for session_auth in sessions_actives.scalars().all():
        session_auth.est_revoquee = True
        session_auth.raison_revocation = "changement_mot_de_passe"

    # Audit
    await _enregistrer_audit(
        session,
        utilisateur_id=utilisateur.id,
        role_acteur=utilisateur.role,
        type_evenement=TypesEvenementAudit.CHANGEMENT_MOT_DE_PASSE.value,
        description="Mot de passe réinitialisé via lien 'mot de passe oublié'",
        adresse_ip=adresse_ip,
    )
    await session.commit()

    journal.info(
        f"Mot de passe réinitialisé avec succès : utilisateur={utilisateur.id}"
    )

    return {
        "succes": True,
        "message": "Mot de passe réinitialisé avec succès ! Tu peux maintenant te connecter avec ton nouveau mot de passe.",
    }
