# -*- coding: utf-8 -*-
"""
Service de tracking quotidien.

A chaque action sensible d'un utilisateur, on appelle `tracker_action()`.
Cela cree (ou met a jour) l'enregistrement ActiviteQuotidienne du jour,
et met a jour le streak (jours consecutifs).

Le streak est la cle de l'engagement : plus tu reviens regulierement,
plus ton score grimpe naturellement.
"""
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import ActiviteQuotidienne, Utilisateur
from src.noyau import journal


async def tracker_action(
    session: AsyncSession,
    utilisateur: Utilisateur,
    type_action: str,
) -> None:
    """
    Enregistre une action utilisateur pour le jour courant et met a jour le streak.

    Appele automatiquement par :
      - Toute consultation/modif de profil
      - Tout calcul ou consultation de score
      - Toute action sur consentements
      - Tout message envoye au chatbot
      - Toute upload de document
      - Toute connexion reussie

    Si c'est la premiere action de la journee, on cree une nouvelle ligne
    et on met a jour le streak. Sinon, on incremente juste le compteur.
    """
    maintenant = datetime.now(timezone.utc)
    aujourd_hui = maintenant.date()

    # Chercher l'enregistrement existant pour aujourd'hui
    resultat = await session.execute(
        select(ActiviteQuotidienne).where(
            ActiviteQuotidienne.utilisateur_id == utilisateur.id,
            ActiviteQuotidienne.jour == aujourd_hui,
        )
    )
    activite_aujourd_hui = resultat.scalar_one_or_none()

    if activite_aujourd_hui is not None:
        # Pas la premiere action du jour : on incremente juste
        activite_aujourd_hui.nombre_actions += 1
        activite_aujourd_hui.date_derniere_action = maintenant
        activite_aujourd_hui.derniere_action = type_action
        return

    # Premiere action du jour → creer un nouvel enregistrement
    activite = ActiviteQuotidienne(
        utilisateur_id=utilisateur.id,
        jour=aujourd_hui,
        nombre_actions=1,
        derniere_action=type_action,
        date_premiere_action=maintenant,
        date_derniere_action=maintenant,
    )
    session.add(activite)

    # Mise a jour du streak (jours consecutifs)
    await _mettre_a_jour_streak(session, utilisateur, aujourd_hui)


async def _mettre_a_jour_streak(
    session: AsyncSession,
    utilisateur: Utilisateur,
    aujourd_hui: date,
) -> None:
    """
    Met a jour le streak de l'utilisateur :
      - Si la derniere activite etait HIER : streak + 1
      - Si la derniere activite etait AUJOURD'HUI : streak inchange
      - Sinon (plus d'1 jour d'ecart) : streak reset a 1
    """
    # Trouver l'activite la plus recente AVANT aujourd'hui
    resultat = await session.execute(
        select(ActiviteQuotidienne)
        .where(
            ActiviteQuotidienne.utilisateur_id == utilisateur.id,
            ActiviteQuotidienne.jour < aujourd_hui,
        )
        .order_by(ActiviteQuotidienne.jour.desc())
        .limit(1)
    )
    derniere_activite = resultat.scalar_one_or_none()

    hier = aujourd_hui - timedelta(days=1)

    if derniere_activite is None:
        # Premiere activite jamais : streak = 1
        nouveau_streak = 1
    elif derniere_activite.jour == hier:
        # Activite hier → on continue le streak
        nouveau_streak = utilisateur.streak_actuel + 1
    else:
        # Plus d'un jour d'ecart → on reset a 1
        nouveau_streak = 1

    utilisateur.streak_actuel = nouveau_streak

    # Mise a jour du record personnel si depasse
    if nouveau_streak > utilisateur.streak_record:
        utilisateur.streak_record = nouveau_streak
        journal.info(
            f"Nouveau record de streak pour utilisateur={utilisateur.id}: {nouveau_streak} jours"
        )


async def compter_jours_actifs_30_derniers(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> int:
    """
    Compte le nombre de jours actifs sur les 30 derniers jours.
    Sert a calculer un bonus de regularite.
    """
    il_y_a_30_jours = date.today() - timedelta(days=30)
    resultat = await session.execute(
        select(ActiviteQuotidienne).where(
            ActiviteQuotidienne.utilisateur_id == utilisateur.id,
            ActiviteQuotidienne.jour >= il_y_a_30_jours,
        )
    )
    return len(resultat.scalars().all())


def calculer_bonus_streak(streak_actuel: int) -> int:
    """
    Bonus de score base sur le streak actuel.
      - 1-2 jours :  0 point
      - 3-6 jours :  2 points
      - 7-13 jours : 5 points
      - 14-29 jours : 8 points
      - 30+ jours : 12 points
    """
    if streak_actuel >= 30: return 12
    if streak_actuel >= 14: return 8
    if streak_actuel >= 7:  return 5
    if streak_actuel >= 3:  return 2
    return 0
