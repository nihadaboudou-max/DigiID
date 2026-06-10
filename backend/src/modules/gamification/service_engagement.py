# -*- coding: utf-8 -*-
"""
Service Engagement — synthese complete pour le frontend.
"""
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Utilisateur
from src.modules.gamification import service_tracking
from src.modules.gamification.schemas import StatistiquesEngagement


async def obtenir_statistiques(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> StatistiquesEngagement:
    """Compose toutes les statistiques d'engagement de l'utilisateur."""
    streak = utilisateur.streak_actuel

    # Calculer le prochain palier
    if streak < 3:    prochain = 3
    elif streak < 7:  prochain = 7
    elif streak < 14: prochain = 14
    elif streak < 30: prochain = 30
    else:             prochain = streak + 30  # Tous les 30 jours apres 30

    jours_actifs_30j = await service_tracking.compter_jours_actifs_30_derniers(
        session, utilisateur,
    )

    return StatistiquesEngagement(
        streak_actuel=streak,
        streak_record=utilisateur.streak_record,
        jours_actifs_30j=jours_actifs_30j,
        bonus_score_cumule=utilisateur.bonus_score_cumule,
        bonus_streak_actuel=service_tracking.calculer_bonus_streak(streak),
        prochain_palier_streak=prochain,
        jours_jusqu_au_palier=max(0, prochain - streak),
    )
