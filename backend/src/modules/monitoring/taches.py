# -*- coding: utf-8 -*-
"""
Configuration Celery et tâches asynchrones DigiID.

Lancer un worker Celery et un processus Celery Beat. Beat programme le nettoyage
des photos de colis arrivées à échéance ; le worker exécute la suppression.
"""
import asyncio
from datetime import datetime, timedelta, timezone

from celery import Celery
from celery.schedules import crontab
from sqlalchemy import select

from src.config import parametres
from src.base_donnees.session import FabriqueSession
from src.modeles.logistique import Colis
from src.modules.logistique.stockage_colis import supprimer_photo_colis
from src.noyau import journal

app = Celery("digiid")

app.conf.update(
    broker_url=parametres.url_redis,
    result_backend=parametres.url_redis,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "supprimer-photos-colis-expirees": {
            "task": "digiid.logistique.supprimer_photos_colis_expirees",
            "schedule": crontab(minute="*/15"),
        },
    },
)


@app.task(name="digiid.ping")
def ping() -> str:
    """Tâche de santé — vérifie que le worker répond."""
    return "pong"


async def _supprimer_photos_colis_expirees() -> int:
    date_limite = datetime.now(timezone.utc) - timedelta(days=7)
    async with FabriqueSession() as session:
        resultat = await session.scalars(
            select(Colis).where(
                Colis.photo_chemin.is_not(None),
                Colis.livre_le.is_not(None),
                Colis.livre_le <= date_limite,
            )
        )
        colis_a_nettoyer = list(resultat)
        supprimees = 0
        for colis in colis_a_nettoyer:
            try:
                supprimer_photo_colis(colis.photo_chemin)
            except OSError as erreur:
                journal.error(
                    f"Suppression de la photo du colis {colis.id} impossible: {erreur}"
                )
                continue
            colis.photo_chemin = None
            supprimees += 1
        await session.commit()
        return supprimees


@app.task(name="digiid.logistique.supprimer_photos_colis_expirees")
def supprimer_photos_colis_expirees() -> int:
    """Efface les photos des colis livrés depuis au moins sept jours."""
    nombre = asyncio.run(_supprimer_photos_colis_expirees())
    journal.info(f"Photos de colis supprimées après expiration: {nombre}")
    return nombre
