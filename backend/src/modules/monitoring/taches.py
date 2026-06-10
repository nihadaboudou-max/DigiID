# -*- coding: utf-8 -*-
"""
Configuration Celery et tâches asynchrones DigiID.

Le worker Docker démarre avec :
    celery -A src.modules.monitoring.taches worker

Les tâches métier (emails, recalcul de scores, alertes) seront ajoutées
au fur et à mesure des phases suivantes.
"""
from celery import Celery

from src.config import parametres

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
)


@app.task(name="digiid.ping")
def ping() -> str:
    """Tâche de santé — vérifie que le worker répond."""
    return "pong"
