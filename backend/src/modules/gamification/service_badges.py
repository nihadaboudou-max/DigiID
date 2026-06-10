# -*- coding: utf-8 -*-
"""
Service Badges — verification et deblocage automatique.

A chaque action utilisateur potentiellement liee a un badge,
on appelle `verifier_et_debloquer_badges()` qui parcourt le catalogue
et debloque automatiquement les badges dont les conditions sont remplies.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import (
    Badge, Consentement, Conversation, Document, Parrainage, Utilisateur,
)
from src.modules.gamification.catalogue_badges import CATALOGUE
from src.modules.gamification import service_notifications
from src.noyau import journal


async def _badges_deja_obtenus(session: AsyncSession, utilisateur_id) -> set[str]:
    """Liste les codes de badges deja obtenus par l'utilisateur."""
    resultat = await session.execute(
        select(Badge.code).where(Badge.utilisateur_id == utilisateur_id)
    )
    return {ligne[0] for ligne in resultat.all()}


async def _conditions_remplies(
    session: AsyncSession,
    utilisateur: Utilisateur,
    code_badge: str,
) -> bool:
    """
    Verifie si les conditions de deblocage d'un badge sont remplies.

    Chaque condition est une regle metier simple basee sur l'etat de l'utilisateur
    et de ses donnees associees.
    """
    # --- Badges sur l'inscription ---
    if code_badge == "BIENVENUE":
        # Tout utilisateur inscrit l'obtient des sa premiere connexion
        return True

    if code_badge == "PIONNIER":
        # Parmi les 100 premiers utilisateurs (par date d'inscription)
        compte = await session.scalar(
            select(func.count(Utilisateur.id)).where(
                Utilisateur.cree_le <= utilisateur.cree_le
            )
        )
        return (compte or 0) <= 100

    # --- Badges sur la completion du profil ---
    if code_badge == "PROFIL_COMPLET":
        return bool(
            utilisateur.prenom_chiffre
            and utilisateur.nom_chiffre
            and utilisateur.telephone_chiffre
            and utilisateur.ville
        )

    if code_badge == "VERIFIE":
        return utilisateur.est_email_verifie

    if code_badge == "SECURITE_PLUS":
        return utilisateur.deux_fa_active

    # --- Badges sur le streak ---
    if code_badge == "STREAK_3_JOURS":
        return utilisateur.streak_actuel >= 3
    if code_badge == "STREAK_7_JOURS":
        return utilisateur.streak_actuel >= 7
    if code_badge == "STREAK_30_JOURS":
        return utilisateur.streak_actuel >= 30

    # --- Badges sur le score ---
    if code_badge == "SCORE_50":
        return (utilisateur.score_actuel or 0) >= 50
    if code_badge == "SCORE_80":
        return (utilisateur.score_actuel or 0) >= 80

    # --- Badge sur les consentements ---
    if code_badge == "CONFIANT":
        # Tous les consentements facultatifs accordes (donc 5 non-CGU actifs)
        compte = await session.scalar(
            select(func.count(Consentement.id)).where(
                Consentement.utilisateur_id == utilisateur.id,
                Consentement.est_accorde == True,
                Consentement.date_retrait.is_(None),
                Consentement.categorie != "cgu",
            )
        )
        return (compte or 0) >= 5

    # --- Badge sur le parrainage ---
    if code_badge == "SOCIAL":
        compte = await session.scalar(
            select(func.count(Parrainage.id)).where(
                Parrainage.parrain_id == utilisateur.id
            )
        )
        return (compte or 0) >= 1

    # --- Badges sur l'utilisation des features ---
    if code_badge == "CHATBOT_ACTIF":
        compte = await session.scalar(
            select(func.count(Conversation.id)).where(
                Conversation.utilisateur_id == utilisateur.id
            )
        )
        return (compte or 0) >= 10

    if code_badge == "DOCUMENT_PARTAGE":
        compte = await session.scalar(
            select(func.count(Document.id)).where(
                Document.utilisateur_id == utilisateur.id
            )
        )
        return (compte or 0) >= 1

    # Badge inconnu → pas de condition remplie
    return False


async def verifier_et_debloquer_badges(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> list[Badge]:
    """
    Parcourt le catalogue, debloque les badges dont les conditions sont
    remplies, et cree une notification pour chacun.

    Retourne la liste des badges nouvellement debloques.
    """
    deja_obtenus = await _badges_deja_obtenus(session, utilisateur.id)
    nouveaux_badges: list[Badge] = []

    for code, definition in CATALOGUE.items():
        if code in deja_obtenus:
            continue  # deja debloque

        if await _conditions_remplies(session, utilisateur, code):
            # Debloquer ce badge
            badge = Badge(
                utilisateur_id=utilisateur.id,
                code=code,
                date_obtention=datetime.now(timezone.utc),
                bonus_score=definition.bonus_score,
            )
            session.add(badge)
            # Ajouter le bonus au cumul de l'utilisateur
            utilisateur.bonus_score_cumule += definition.bonus_score

            # Creer une notification d'annonce
            await service_notifications.creer_notification(
                session=session,
                utilisateur=utilisateur,
                type_notification="succes",
                categorie="badge",
                titre=f"Nouveau badge : {definition.titre} {definition.icone}",
                message=f"{definition.description} (+{definition.bonus_score} points)",
                lien_action="/badges",
            )

            journal.info(f"Badge debloque : {code} pour utilisateur={utilisateur.id}")
            nouveaux_badges.append(badge)

    return nouveaux_badges
