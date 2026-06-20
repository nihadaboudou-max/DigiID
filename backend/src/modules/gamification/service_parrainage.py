# -*- coding: utf-8 -*-
"""
Service Parrainage — generation de codes, validation, application des bonus.
"""
import secrets
import string
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Parrainage, Utilisateur
from src.modules.gamification import service_notifications
from src.noyau import journal


# Bonus distribues (reduits : evite l'inflation du compteur)
BONUS_PARRAIN = 2
BONUS_FILLEUL = 1


def _generer_code_unique() -> str:
    """Genere un code de 8 caracteres alphanumeriques majuscules."""
    alphabet = string.ascii_uppercase + string.digits
    # On retire les caracteres ambigus (0/O, 1/I)
    alphabet = alphabet.replace("0", "").replace("O", "").replace("1", "").replace("I", "")
    return "".join(secrets.choice(alphabet) for _ in range(8))


async def assurer_code_parrainage(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> str:
    """
    Garantit que l'utilisateur a un code de parrainage. Le cree au besoin.
    Retourne le code.
    """
    if utilisateur.code_parrainage:
        return utilisateur.code_parrainage

    # Generer un code unique (boucle jusqu'a trouver un libre)
    for _ in range(10):
        code = _generer_code_unique()
        # Verifier unicite
        existe = await session.scalar(
            select(Utilisateur).where(Utilisateur.code_parrainage == code)
        )
        if existe is None:
            utilisateur.code_parrainage = code
            await session.flush()
            journal.info(f"Code de parrainage cree : {code} pour utilisateur={utilisateur.id}")
            return code

    # Si on n'arrive pas a trouver de code unique en 10 essais (improbable)
    raise RuntimeError("Impossible de generer un code de parrainage unique")


async def appliquer_parrainage(
    session: AsyncSession,
    nouveau_utilisateur: Utilisateur,
    code_parrain: str,
) -> Optional[Parrainage]:
    """
    Applique un parrainage a l'inscription d'un nouvel utilisateur.

    Recherche le parrain par son code, cree l'enregistrement de parrainage,
    et applique les bonus aux deux utilisateurs.

    Retourne le parrainage cree, ou None si le code est invalide.
    """
    if not code_parrain or len(code_parrain) != 8:
        return None

    # Trouver le parrain
    resultat = await session.execute(
        select(Utilisateur).where(
            Utilisateur.code_parrainage == code_parrain.upper(),
            Utilisateur.est_supprime == False,
        )
    )
    parrain = resultat.scalar_one_or_none()
    if parrain is None:
        journal.info(f"Code de parrainage invalide : {code_parrain}")
        return None

    # Empecher l'auto-parrainage (peu probable mais securitaire)
    if parrain.id == nouveau_utilisateur.id:
        return None

    # Creer le parrainage
    parrainage = Parrainage(
        parrain_id=parrain.id,
        filleul_id=nouveau_utilisateur.id,
        code_utilise=code_parrain.upper(),
        date_parrainage=datetime.now(timezone.utc),
    )
    session.add(parrainage)

    # Appliquer les bonus
    parrain.bonus_score_cumule += BONUS_PARRAIN
    nouveau_utilisateur.bonus_score_cumule += BONUS_FILLEUL

    # Notification au parrain
    await service_notifications.creer_notification(
        session=session,
        utilisateur=parrain,
        type_notification="succes",
        categorie="parrainage",
        titre=f"Nouveau filleul ! +{BONUS_PARRAIN} points",
        message="Un nouvel utilisateur s'est inscrit grace a ton code de parrainage.",
        lien_action="/parrainage",
    )

    # Notification au filleul (apres connexion il la verra)
    await service_notifications.creer_notification(
        session=session,
        utilisateur=nouveau_utilisateur,
        type_notification="succes",
        categorie="parrainage",
        titre=f"Tu as ete parraine ! +{BONUS_FILLEUL} points",
        message=f"Bienvenue ! Tu as ete parraine et gagnes {BONUS_FILLEUL} points de bienvenue.",
        lien_action="/tableau-de-bord",
    )

    journal.info(
        f"Parrainage applique : parrain={parrain.id} filleul={nouveau_utilisateur.id}"
    )
    return parrainage
