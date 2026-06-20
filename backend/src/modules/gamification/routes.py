# -*- coding: utf-8 -*-
"""Routes API du module gamification."""
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Badge, Notification, Parrainage, Utilisateur
from src.config import parametres
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.gamification import (
    service_badges, service_engagement,
    service_notifications, service_parrainage, service_recommandations,
)
from src.modules.gamification.catalogue_badges import CATALOGUE
from src.noyau.journal import enregistrer_evenement_audit
from src.modules.gamification.schemas import (
    BadgeDetail, ListeBadges, StatistiquesEngagement,
    ListeRecommandations, RecommandationDetail,
    ListeNotifications, NotificationDetail,
    CodeParrainage,
)


routeur_gamification = APIRouter(
    prefix="/api/v1/utilisateur",
    tags=["Engagement et gamification"],
)


# ============================================================================
# Badges
# ============================================================================

@routeur_gamification.get(
    "/badges",
    response_model=ListeBadges,
    summary="Lister tous mes badges (debloques et a debloquer)",
)
async def lister_badges(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    # Verifier au passage si de nouveaux badges peuvent etre debloques
    nouveaux = await service_badges.verifier_et_debloquer_badges(session, utilisateur)
    if nouveaux:
        await session.commit()

    # Recharger la liste complete
    resultat = await session.execute(
        select(Badge).where(Badge.utilisateur_id == utilisateur.id)
    )
    badges_debloques = {b.code: b for b in resultat.scalars().all()}

    # Construire la reponse en mixant catalogue et badges debloques
    items: list[BadgeDetail] = []
    bonus_total = 0
    for code, defn in CATALOGUE.items():
        debloque = badges_debloques.get(code)
        if debloque is not None:
            bonus_total += defn.bonus_score
        items.append(BadgeDetail(
            code=code,
            titre=defn.titre,
            description=defn.description,
            icone=defn.icone,
            bonus_score=defn.bonus_score,
            rarete=defn.rarete,
            est_debloque=debloque is not None,
            date_obtention=debloque.date_obtention if debloque else None,
        ))

    return ListeBadges(
        badges=items,
        total_debloques=len(badges_debloques),
        total_disponibles=len(CATALOGUE),
        bonus_total=bonus_total,
    )


# ============================================================================
# Statistiques d'engagement
# ============================================================================

@routeur_gamification.get(
    "/engagement",
    response_model=StatistiquesEngagement,
    summary="Mes statistiques d'engagement (streak, jours actifs, etc.)",
)
async def voir_engagement(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    return await service_engagement.obtenir_statistiques(session, utilisateur)


# ============================================================================
# Recommandations
# ============================================================================

@routeur_gamification.get(
    "/recommandations",
    response_model=ListeRecommandations,
    summary="Recommandations personnalisees pour ameliorer mon score",
)
async def obtenir_recommandations(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    recos = await service_recommandations.generer_recommandations(session, utilisateur)
    return ListeRecommandations(
        recommandations=[
            RecommandationDetail(
                code=r.code, titre=r.titre, description=r.description,
                icone=r.icone, gain_estime=r.gain_estime,
                lien_action=r.lien_action, priorite=r.priorite,
            )
            for r in recos
        ],
        total=len(recos),
        gain_total_potentiel=sum(r.gain_estime for r in recos),
    )


# ============================================================================
# Notifications
# ============================================================================

@routeur_gamification.get(
    "/notifications",
    response_model=ListeNotifications,
    summary="Mes notifications",
)
async def lister_notifications(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    seulement_non_lues: bool = False,
):
    notifs = await service_notifications.lister_notifications(
        session, utilisateur, seulement_non_lues=seulement_non_lues,
    )
    non_lues = await service_notifications.compter_non_lues(session, utilisateur)
    return ListeNotifications(
        notifications=[NotificationDetail.model_validate(n) for n in notifs],
        total=len(notifs),
        non_lues=non_lues,
    )


@routeur_gamification.patch(
    "/notifications/{notification_id}/lue",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Marquer une notification comme lue",
)
async def marquer_lue(
    notification_id: UUID,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    await service_notifications.marquer_comme_lue(session, utilisateur, notification_id)
    await session.commit()


@routeur_gamification.post(
    "/notifications/toutes-lues",
    summary="Marquer toutes mes notifications comme lues",
)
async def marquer_toutes_lues(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    nombre = await service_notifications.marquer_toutes_comme_lues(session, utilisateur)
    await session.commit()
    return {"nombre_marquees": nombre}


# ============================================================================
# Parrainage
# ============================================================================

@routeur_gamification.get(
    "/parrainage",
    response_model=CodeParrainage,
    summary="Mon code de parrainage personnel et mes statistiques",
)
async def voir_parrainage(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    # Generer le code s'il n'existe pas encore
    code = await service_parrainage.assurer_code_parrainage(session, utilisateur)
    await session.commit()

    # Compter mes filleuls
    nb_filleuls = await session.scalar(
        select(func.count(Parrainage.id)).where(Parrainage.parrain_id == utilisateur.id)
    ) or 0

    # Construire le lien d'invitation complet en utilisant l'URL frontend
    frontend_base = parametres.url_frontend.rstrip("/")
    lien_inscription = f"{frontend_base}/inscription"

    return CodeParrainage(
        code=code,
        lien_invitation=f"{lien_inscription}?code={code}",
        nombre_filleuls=nb_filleuls,
        bonus_recus=nb_filleuls * service_parrainage.BONUS_PARRAIN,
    )
