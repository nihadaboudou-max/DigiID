"""Tâches périodiques de la logistique."""
import asyncio

from sqlalchemy.exc import SQLAlchemyError

from src.base_donnees.session import FabriqueSession
from src.modules.logistique.service import envoyer_pre_alertes_automatiques
from src.noyau import journal


async def boucle_pre_alertes_automatiques() -> None:
    """Vérifie chaque minute les voyages dont l'approche devient imminente."""
    while True:
        await asyncio.sleep(60)
        try:
            async with FabriqueSession() as session:
                nb_alertes = await envoyer_pre_alertes_automatiques(session)
                if nb_alertes:
                    journal.info(
                        f"Pré-alertes automatiques envoyées: {nb_alertes} arrêt(s)."
                    )
        except SQLAlchemyError as erreur:
            journal.error(
                "Vérification des pré-alertes automatiques impossible "
                f"(type={type(erreur).__name__})."
            )
