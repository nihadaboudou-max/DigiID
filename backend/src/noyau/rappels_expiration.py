# -*- coding: utf-8 -*-
"""
Rappels d'expiration des pièces d'identité.

Règle métier :
  - Une pièce valide mais dont la date d'expiration est atteinte dans <= 30 jours
    déclenche une notification au citoyen l'invitant à renouveler sa carte.
  - Une pièce déjà expirée ne déclenche PAS de notification « bientôt »
    (elle est rejetée en amont lors de l'extraction OCR).
"""
from datetime import date
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Notification, Utilisateur
from src.modules.gamification.service_notifications import creer_notification

# Libellés d'affichage par type de document
_LIBELLES = {
    "cni": "CNI",
    "permis": "permis de conduire",
    "assurance": "assurance",
    "passeport": "passeport",
}

SEUIL_JOURS = 30


async def notifier_expiration_proche(
    session: AsyncSession,
    utilisateur: Utilisateur,
    type_document: str,
    date_expiration: Optional[date],
) -> bool:
    """
    Crée une notification « votre pièce expire bientôt » si la pièce expire
    dans <= 30 jours (et n'est pas encore expirée).

    Retourne True si une notification a été créée, False sinon.
    (Le commit est effectué ici pour garantir la persistance immédiate.)
    """
    if not date_expiration:
        return False

    aujourdhui = date.today()
    delta = (date_expiration - aujourdhui).days
    if delta < 0 or delta > SEUIL_JOURS:
        return False

    libelle = _LIBELLES.get(type_document, type_document)
    titre = f"Votre {libelle} expire bientôt"

    # Anti-doublon : pas de rappel si une notification non lue identique existe déjà
    resultat = await session.execute(
        select(Notification)
        .where(
            Notification.utilisateur_id == utilisateur.id,
            Notification.categorie == "document",
            Notification.titre == titre,
            Notification.est_lue == False,
        )
        .limit(1)
    )
    if resultat.scalar_one_or_none():
        return False

    jours_texte = f"{delta} jour{'s' if delta > 1 else ''}"
    await creer_notification(
        session=session,
        utilisateur=utilisateur,
        type_notification="avertissement",
        categorie="document",
        titre=titre,
        message=(
            f"Votre {libelle} expire le {date_expiration.strftime('%d/%m/%Y')} "
            f"(dans {jours_texte}). Pensez à la renouveler dès maintenant pour "
            f"éviter toute interruption de vos démarches."
        ),
        lien_action="/documents-identite",
    )
    await session.commit()
    return True
