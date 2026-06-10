# -*- coding: utf-8 -*-
"""
Service Notifications — creation, listing, marquage comme lu.
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Notification, Utilisateur


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
) -> list[Notification]:
    """Liste les notifications de l'utilisateur, plus recentes en premier."""
    requete = select(Notification).where(Notification.utilisateur_id == utilisateur.id)
    if seulement_non_lues:
        requete = requete.where(Notification.est_lue == False)
    requete = requete.order_by(desc(Notification.cree_le)).limit(limite)

    resultat = await session.execute(requete)
    return list(resultat.scalars().all())


async def compter_non_lues(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> int:
    """Compte les notifications non lues (pour le badge dans l'en-tete)."""
    compte = await session.scalar(
        select(func.count(Notification.id)).where(
            Notification.utilisateur_id == utilisateur.id,
            Notification.est_lue == False,
        )
    )
    return compte or 0


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
