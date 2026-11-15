# -*- coding: utf-8 -*-
"""Tâches Celery pour le nettoyage et les agrégats logistiques nocturnes.

Lancer un worker Celery et un processus Celery Beat pour le nettoyage des
photos, le score de confiance, les vues, les prévisions et les anomalies.
"""
import asyncio
from datetime import datetime, timedelta, timezone

from celery import Celery
from celery.schedules import crontab
from sqlalchemy import select, text

from src.config import parametres
from src.base_donnees.session import FabriqueSession
from src.modeles.logistique import Colis
from src.modules.logistique.stockage_colis import supprimer_photo_colis
from src.modules.logistique.service_confiance import (
    calculer_et_enregistrer_scores,
)
from src.modules.logistique.service_prevision import calculer_previsions_demande
from src.modules.logistique.service_anomalies import detecter_anomalies_scans
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
        "calculer-scores-confiance-chauffeurs": {
            "task": "digiid.logistique.calculer_scores_confiance_chauffeurs",
            "schedule": crontab(hour=2, minute=0),
        },
        "rafraichir-vues-analytiques-logistiques": {
            "task": "digiid.logistique.rafraichir_vues_analytiques_logistiques",
            "schedule": crontab(hour=2, minute=30),
        },
        "calculer-previsions-demande-logistique": {
            "task": "digiid.logistique.calculer_previsions_demande",
            "schedule": crontab(hour=2, minute=40),
        },
        "detecter-anomalies-scans-logistiques": {
            "task": "digiid.logistique.detecter_anomalies_scans",
            "schedule": crontab(hour=2, minute=45),
        },
    },
)

VUES_ANALYTIQUES_LOGISTIQUES = (
    "vue_flux_par_ligne_analytique",
    "vue_incidents_par_gare_analytique",
    "vue_remplissage_voyages_analytique",
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


async def _calculer_scores_confiance_chauffeurs() -> dict[str, int]:
    async with FabriqueSession() as session:
        return await calculer_et_enregistrer_scores(session)


@app.task(name="digiid.logistique.calculer_scores_confiance_chauffeurs")
def calculer_scores_confiance_chauffeurs() -> dict[str, int]:
    """Calcule les scores quotidiens et applique les durées de conservation."""
    resultat = asyncio.run(_calculer_scores_confiance_chauffeurs())
    journal.info(
        "Scores de confiance recalculés : "
        f"{resultat['chauffeurs_scores']} chauffeurs, "
        f"{resultat['details_supprimes']} événements analytiques purgés, "
        f"{resultat['scores_supprimes']} scores expirés."
    )
    return resultat


async def _rafraichir_vues_analytiques_logistiques() -> int:
    async with FabriqueSession() as session:
        for nom_vue in VUES_ANALYTIQUES_LOGISTIQUES:
            await session.execute(text(f"REFRESH MATERIALIZED VIEW {nom_vue}"))
        await session.commit()
    return len(VUES_ANALYTIQUES_LOGISTIQUES)


@app.task(name="digiid.logistique.rafraichir_vues_analytiques_logistiques")
def rafraichir_vues_analytiques_logistiques() -> dict[str, int]:
    """Rafraîchit les agrégats logistiques chaque nuit."""
    nombre_vues = asyncio.run(_rafraichir_vues_analytiques_logistiques())
    journal.info(f"Vues analytiques logistiques rafraîchies : {nombre_vues}.")
    return {"vues_rafraichies": nombre_vues}


async def _calculer_previsions_demande() -> dict[str, int]:
    async with FabriqueSession() as session:
        return await calculer_previsions_demande(session)


@app.task(name="digiid.logistique.calculer_previsions_demande")
def calculer_previsions_demande_tache() -> dict[str, int]:
    """Calcule les prévisions par ligne et mesure les erreurs des jours échus."""
    resultat = asyncio.run(_calculer_previsions_demande())
    journal.info(
        "Prévisions logistiques calculées : "
        f"{resultat['previsions_calculees']} nouvelles, "
        f"{resultat['previsions_evaluees']} évaluées."
    )
    return resultat


async def _detecter_anomalies_scans() -> dict[str, int]:
    async with FabriqueSession() as session:
        return await detecter_anomalies_scans(session)


@app.task(name="digiid.logistique.detecter_anomalies_scans")
def detecter_anomalies_scans_tache() -> dict[str, int]:
    """Détecte les volumes atypiques et crée des alertes sans identifiant personnel."""
    resultat = asyncio.run(_detecter_anomalies_scans())
    journal.info(
        "Détection d'anomalies des scans terminée : "
        f"{resultat['alertes_creees']} alertes, "
        f"{resultat['gares_analysees']} gares analysées."
    )
    return resultat
