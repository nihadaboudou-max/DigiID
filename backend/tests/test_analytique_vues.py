"""Tests de planification du rafraîchissement des vues analytiques."""
import asyncio

from src.modules.monitoring.taches import app
from src.modules.monitoring import taches


def test_vues_analytiques_sont_rafraichies_chaque_nuit():
    planification = app.conf.beat_schedule[
        "rafraichir-vues-analytiques-logistiques"
    ]

    assert planification["task"] == (
        "digiid.logistique.rafraichir_vues_analytiques_logistiques"
    )
    assert planification["schedule"].hour == {2}
    assert planification["schedule"].minute == {30}


def test_previsions_et_anomalies_sont_planifiees_apres_les_vues():
    previsions = app.conf.beat_schedule["calculer-previsions-demande-logistique"]
    anomalies = app.conf.beat_schedule["detecter-anomalies-scans-logistiques"]

    assert previsions["task"] == "digiid.logistique.calculer_previsions_demande"
    assert previsions["schedule"].hour == {2}
    assert previsions["schedule"].minute == {40}
    assert anomalies["task"] == "digiid.logistique.detecter_anomalies_scans"
    assert anomalies["schedule"].hour == {2}
    assert anomalies["schedule"].minute == {45}


def test_tache_rafraichit_les_trois_vues_et_commit(monkeypatch):
    class SessionCapture:
        def __init__(self):
            self.requetes = []
            self.commit_effectue = False

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return None

        async def execute(self, requete):
            self.requetes.append(str(requete))

        async def commit(self):
            self.commit_effectue = True

    session = SessionCapture()
    monkeypatch.setattr(taches, "FabriqueSession", lambda: session)

    nombre_vues = asyncio.run(taches._rafraichir_vues_analytiques_logistiques())

    assert nombre_vues == 3
    assert session.requetes == [
        f"REFRESH MATERIALIZED VIEW {nom_vue}"
        for nom_vue in taches.VUES_ANALYTIQUES_LOGISTIQUES
    ]
    assert session.commit_effectue
