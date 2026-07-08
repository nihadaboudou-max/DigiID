# -*- coding: utf-8 -*-
"""Service métier pour les invitations."""
import hashlib
import secrets
import string
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Utilisateur
from src.modeles.invitation import Invitation
from src.modules.invitations.schemas import (
    InvitationCreate,
    InvitationAcceptationSchema,
)
from src.noyau import chiffrer_donnee, hacher_mot_de_passe


def hasher_email(email: str) -> str:
    """Hash SHA-256 de l'email pour la recherche en base."""
    return hashlib.sha256(email.lower().strip().encode("utf-8")).hexdigest()


def _generer_digiid_public() -> str:
    """Génère un identifiant DigiID public de 16 caractères (majuscules + chiffres)."""
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(16))


async def creer_invitation(
    session: AsyncSession,
    donnees: InvitationCreate,
    cree_par: UUID,
) -> Invitation:
    """
    Crée une nouvelle invitation.
    
    Vérifications effectuées :
    1. Un compte utilisateur n'existe pas déjà avec cet email
    2. Une invitation en attente n'existe pas déjà pour cet email
    
    Lève :
        ValueError si un compte existe déjà ou si une invitation est déjà en attente.
    """
    # ✅ VÉRIFICATION 1 : Un compte utilisateur existe-t-il déjà avec cet email ?
    email_hash = hasher_email(donnees.email)
    resultat_utilisateur = await session.execute(
        select(Utilisateur).where(
            and_(
                Utilisateur.email_hash == email_hash,
                Utilisateur.est_supprime == False,
            )
        )
    )
    utilisateur_existant = resultat_utilisateur.scalar_one_or_none()
    if utilisateur_existant is not None:
        raise ValueError(
            f"Un compte existe déjà avec l'email {donnees.email}. "
            f"Impossible de créer une invitation pour cet utilisateur."
        )
    
    # ✅ VÉRIFICATION 2 : Une invitation en attente existe-t-elle déjà ?
    stmt = select(Invitation).where(
        and_(
            Invitation.email == donnees.email,
            Invitation.statut == "en_attente",
        )
    )
    result = await session.execute(stmt)
    existante = result.scalar_one_or_none()
    if existante:
        raise ValueError(f"Une invitation en attente existe déjà pour {donnees.email}")
    
    # Créer l'invitation
    invitation = Invitation(
        email=donnees.email,
        role=donnees.role,
        domaine_id=donnees.domaine_id,
        departement_id=donnees.departement_id,
        message=donnees.message,
        cree_par=cree_par,
        token=secrets.token_urlsafe(48),
        date_expiration=datetime.now(timezone.utc) + timedelta(days=donnees.duree_jours),
    )
    session.add(invitation)
    
    try:
        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        # Gestion des race conditions (deux invitations créées en même temps)
        if "invitation" in str(e.orig).lower():
            raise ValueError(
                f"Une invitation existe déjà pour {donnees.email} (créée simultanément)."
            )
        raise
    
    await session.refresh(invitation)
    return invitation


async def lister_invitations(
    session: AsyncSession,
    cree_par: UUID | None = None,
    domaine_id: UUID | None = None,
    statut: str | None = None,
    page: int = 1,
    par_page: int = 20,
) -> tuple[list[Invitation], int]:
    """Liste les invitations avec filtres."""
    conditions = []
    if cree_par:
        conditions.append(Invitation.cree_par == cree_par)
    if domaine_id:
        conditions.append(Invitation.domaine_id == domaine_id)
    if statut:
        conditions.append(Invitation.statut == statut)
    
    stmt_count = select(func.count(Invitation.id))
    if conditions:
        stmt_count = stmt_count.where(and_(*conditions))
    total = (await session.execute(stmt_count)).scalar() or 0
    
    stmt = (
        select(Invitation)
        .order_by(Invitation.date_creation.desc())
        .offset((page - 1) * par_page)
        .limit(par_page)
    )
    if conditions:
        stmt = stmt.where(and_(*conditions))
    
    result = await session.execute(stmt)
    invitations = list(result.scalars().all())
    return invitations, total


async def obtenir_invitation_par_token(
    session: AsyncSession,
    token: str,
) -> Invitation | None:
    """Récupère une invitation par son token."""
    stmt = select(Invitation).where(Invitation.token == token)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def obtenir_invitation_par_id(
    session: AsyncSession,
    invitation_id: UUID,
) -> Invitation | None:
    """Récupère une invitation par son ID."""
    stmt = select(Invitation).where(Invitation.id == invitation_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def annuler_invitation(
    session: AsyncSession,
    invitation: Invitation,
) -> Invitation:
    """Annule une invitation."""
    if invitation.statut != "en_attente":
        raise ValueError(
            f"Impossible d'annuler une invitation au statut '{invitation.statut}'"
        )
    invitation.statut = "annulee"
    await session.commit()
    await session.refresh(invitation)
    return invitation


async def valider_invitation(
    session: AsyncSession,
    token: str,
) -> tuple[Invitation, str]:
    """Valide une invitation et retourne un token d'inscription."""
    invitation = await obtenir_invitation_par_token(session, token)
    if not invitation:
        raise ValueError("Invitation introuvable")
    if invitation.statut != "en_attente":
        raise ValueError(f"Invitation déjà {invitation.statut}")
    if invitation.est_expiree:
        invitation.statut = "expiree"
        await session.commit()
        raise ValueError("Invitation expirée")
    
    # ✅ VÉRIFICATION SUPPLÉMENTAIRE : L'email n'a-t-il pas été utilisé entre-temps ?
    email_hash = hasher_email(invitation.email)
    resultat_utilisateur = await session.execute(
        select(Utilisateur).where(
            and_(
                Utilisateur.email_hash == email_hash,
                Utilisateur.est_supprime == False,
            )
        )
    )
    if resultat_utilisateur.scalar_one_or_none() is not None:
        invitation.statut = "expiree"
        await session.commit()
        raise ValueError(
            f"Un compte existe déjà avec l'email {invitation.email}. "
            f"Cette invitation ne peut plus être utilisée."
        )
    
    token_inscription = secrets.token_urlsafe(32)
    invitation.statut = "acceptee"
    invitation.date_acceptation = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(invitation)
    return invitation, token_inscription


async def accepter_invitation_service(
    session: AsyncSession,
    invitation: Invitation,
    donnees: InvitationAcceptationSchema,
) -> Utilisateur:
    """
    Accepte une invitation et crée le compte utilisateur.
    Utilise les champs chiffrés et hashés du modèle Utilisateur.
    """
    # 1. Hasher l'email pour l'unicité
    email_hash = hasher_email(invitation.email)
    
    # ✅ VÉRIFICATION FINALE : Un compte existe-t-il déjà ? (protection race condition)
    stmt = select(Utilisateur).where(
        and_(
            Utilisateur.email_hash == email_hash,
            Utilisateur.est_supprime == False,
        )
    )
    existant = (await session.execute(stmt)).scalar_one_or_none()
    if existant:
        raise ValueError(f"Un compte existe déjà avec l'email {invitation.email}")

    # 2. Hasher le mot de passe (SHA-256 + bcrypt pour supporter > 72 caractères)
    mot_de_passe_hash = hacher_mot_de_passe(donnees.mot_de_passe)
    
    # 3. Chiffrer les données personnelles
    telephone_chiffre = chiffrer_donnee(donnees.telephone) if donnees.telephone else None
    
    # 4. Créer l'utilisateur avec TOUS les champs requis
    utilisateur = Utilisateur(
        email_chiffre=chiffrer_donnee(invitation.email),
        email_hash=email_hash,
        prenom_chiffre=chiffrer_donnee(donnees.prenom),
        nom_chiffre=chiffrer_donnee(donnees.nom),
        telephone_chiffre=telephone_chiffre,
        mot_de_passe_hash=mot_de_passe_hash,
        role=invitation.role,
        ville=donnees.ville,
        domaine_id=invitation.domaine_id,
        departement_id=invitation.departement_id,
        digiid_public=_generer_digiid_public(),
        est_actif=True,
        est_email_verifie=True,
        est_supprime=False,
        est_verrouille=False,
        deux_fa_active=False,
        tentatives_connexion_echouees=0,
    )
    
    session.add(utilisateur)
    
    # Marquer l'invitation comme acceptée
    invitation.statut = "acceptee"
    invitation.date_acceptation = datetime.now(timezone.utc)
    
    try:
        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        # Gestion des race conditions (deux comptes créés en même temps)
        if "email_hash" in str(e.orig).lower() or "ix_utilisateur_email_hash" in str(e.orig):
            raise ValueError(
                f"Un compte a été créé simultanément avec l'email {invitation.email}."
            )
        if "digiid_public" in str(e.orig).lower():
            # Régénérer un DigiID et réessayer
            utilisateur.digiid_public = _generer_digiid_public()
            session.add(utilisateur)
            await session.commit()
        else:
            raise
    
    await session.refresh(utilisateur)
    return utilisateur