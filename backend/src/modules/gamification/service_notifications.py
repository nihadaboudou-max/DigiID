# -*- coding: utf-8 -*-
"""
Service Notifications — creation, listing, marquage comme lu.
"""
from datetime import datetime, timezone
import hashlib
import hmac
import re
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select, desc, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Colis, Notification, Ticket, Utilisateur
from src.noyau.chiffrement import chiffrer_donnee, dechiffrer_donnee


async def creer_notification(
    session: AsyncSession,
    utilisateur: Utilisateur,
    type_notification: str,
    categorie: str,
    titre: str,
    message: str,
    lien_action: Optional[str] = None,
) -> Notification:
    """Cree une notification (et fait un flush, mais pas de commit)."""
    notif = Notification(
        utilisateur_id=utilisateur.id,
        type_notification=type_notification,
        categorie=categorie,
        titre=titre,
        message=message,
        lien_action=lien_action,
        est_lue=False,
    )
    session.add(notif)
    await session.flush()
    return notif


async def lister_notifications(
    session: AsyncSession,
    utilisateur: Utilisateur,
    seulement_non_lues: bool = False,
    limite: int = 50,
    *,
    page: int = 1,
    par_page: int | None = None,
    categorie: str | None = None,
    recherche: str | None = None,
) -> list[Notification]:
    """Liste les notifications de l'utilisateur, plus recentes en premier."""
    requete = select(Notification).where(Notification.utilisateur_id == utilisateur.id)
    if seulement_non_lues:
        requete = requete.where(Notification.est_lue == False)
    if categorie:
        requete = requete.where(Notification.categorie == categorie)
    terme = (recherche or "").strip()
    if terme:
        motif = f"%{terme}%"
        requete = requete.where(
            or_(
                Notification.titre.ilike(motif),
                Notification.message.ilike(motif),
                Notification.lien_action.ilike(motif),
            )
        )
    taille = par_page if par_page is not None else limite
    requete = requete.order_by(desc(Notification.cree_le), desc(Notification.id))
    if par_page is not None:
        requete = requete.offset((page - 1) * taille)
    requete = requete.limit(taille)

    resultat = await session.execute(requete)
    return list(resultat.scalars().all())


async def compter_notifications(
    session: AsyncSession,
    utilisateur: Utilisateur,
    *,
    seulement_non_lues: bool = False,
    categorie: str | None = None,
    recherche: str | None = None,
) -> int:
    requete = select(func.count(Notification.id)).where(
        Notification.utilisateur_id == utilisateur.id
    )
    if seulement_non_lues:
        requete = requete.where(Notification.est_lue == False)
    if categorie:
        requete = requete.where(Notification.categorie == categorie)
    terme = (recherche or "").strip()
    if terme:
        motif = f"%{terme}%"
        requete = requete.where(
            or_(
                Notification.titre.ilike(motif),
                Notification.message.ilike(motif),
                Notification.lien_action.ilike(motif),
            )
        )
    compte = await session.scalar(requete)
    return compte or 0


async def compter_non_lues(
    session: AsyncSession,
    utilisateur: Utilisateur,
    categorie: str | None = None,
) -> int:
    """Compte les notifications non lues (pour le badge dans l'en-tete)."""
    filtres = [
        Notification.utilisateur_id == utilisateur.id,
        Notification.est_lue == False,
    ]
    if categorie:
        filtres.append(Notification.categorie == categorie)
    compte = await session.scalar(select(func.count(Notification.id)).where(*filtres))
    return compte or 0


async def obtenir_code_remise_notification(
    session: AsyncSession,
    utilisateur: Utilisateur,
    notification_id: UUID,
) -> tuple[str, datetime]:
    """Révèle le code actif d'une notification appartenant à son destinataire."""
    notification = await session.scalar(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.utilisateur_id == utilisateur.id,
            Notification.categorie == "logistique_colis",
            Notification.titre.ilike("%code de remise%"),
        )
    )
    if notification is None or not notification.lien_action:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Code indisponible.")

    correspondance = re.fullmatch(
        r"/suivi/([^/?#]+)", notification.lien_action.split("?", 1)[0]
    )
    if correspondance is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Code indisponible.")

    ticket = await session.scalar(
        select(Ticket).where(Ticket.code_clair == correspondance.group(1).upper())
    )
    if ticket is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Code indisponible.")
    colis = await session.scalar(select(Colis).where(Colis.ticket_id == ticket.id))
    if colis is None or colis.destinataire_id != utilisateur.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Code indisponible.")

    maintenant = datetime.now(timezone.utc)
    if (
        not colis.code_remise_hash
        or not colis.code_remise_expire_le
        or colis.code_remise_expire_le <= maintenant
    ):
        raise HTTPException(
            status.HTTP_410_GONE,
            detail="Le code a expiré. Demandez un nouveau code au guichet.",
        )

    code = None
    if colis.code_remise_chiffre:
        code = dechiffrer_donnee(colis.code_remise_chiffre)
    else:
        ancienne_valeur = re.search(r"\best\s+(\d{6})\b", notification.message)
        if ancienne_valeur:
            code = ancienne_valeur.group(1)

    empreinte = hashlib.sha256(code.encode("ascii")).hexdigest() if code else ""
    if not code or not hmac.compare_digest(colis.code_remise_hash, empreinte):
        raise HTTPException(
            status.HTTP_410_GONE,
            detail="Le code est indisponible. Demandez un nouveau code au guichet.",
        )

    if not colis.code_remise_chiffre:
        colis.code_remise_chiffre = chiffrer_donnee(code)
        notification.message = re.sub(
            r"(?<!\d)\d{6}(?!\d)", "••••••", notification.message
        )
        session.add_all([colis, notification])
        await session.commit()

    return code, colis.code_remise_expire_le


async def marquer_comme_lue(
    session: AsyncSession,
    utilisateur: Utilisateur,
    notification_id: UUID,
) -> None:
    """Marque une notification specifique comme lue."""
    resultat = await session.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.utilisateur_id == utilisateur.id,
        )
    )
    notif = resultat.scalar_one_or_none()
    if notif and not notif.est_lue:
        notif.est_lue = True
        notif.date_lecture = datetime.now(timezone.utc)


async def marquer_toutes_comme_lues(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> int:
    """Marque toutes les notifications non lues comme lues. Retourne le compte."""
    resultat = await session.execute(
        select(Notification).where(
            Notification.utilisateur_id == utilisateur.id,
            Notification.est_lue == False,
        )
    )
    notifs = list(resultat.scalars().all())
    maintenant = datetime.now(timezone.utc)
    for n in notifs:
        n.est_lue = True
        n.date_lecture = maintenant
    return len(notifs)
