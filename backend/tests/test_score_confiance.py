"""Tests ciblés du score de confiance chauffeur."""
from datetime import datetime, timedelta, timezone

from sqlalchemy.dialects import postgresql

from src.modules.logistique.service_confiance import (
    _condition_purge_details,
    _est_dans_la_tolerance,
    _niveau_score,
    calculer_score_confiance,
)


def test_score_neutre_et_seuils_couleur():
    neutre = calculer_score_confiance(None, None)
    assert neutre["score_total"] == 50
    assert neutre["niveau"] == "orange"

    performant = calculer_score_confiance(100, 100)
    assert performant["score_total"] == 75
    assert performant["niveau"] == "vert"

    assert _niveau_score(49) == "rouge"
    assert _niveau_score(50) == "orange"
    assert _niveau_score(69) == "orange"
    assert _niveau_score(70) == "vert"


def test_regularite_accepte_quinze_minutes_exactement():
    depart_prevu = datetime(2026, 11, 18, 8, 0, tzinfo=timezone.utc)

    assert _est_dans_la_tolerance(
        depart_prevu + timedelta(minutes=15), depart_prevu
    )
    assert not _est_dans_la_tolerance(
        depart_prevu + timedelta(minutes=15, seconds=1), depart_prevu
    )


def test_purge_conserve_les_donnees_simulees_six_mois():
    maintenant = datetime(2026, 11, 15, tzinfo=timezone.utc)

    condition = _condition_purge_details(maintenant)
    sql = str(condition.compile(dialect=postgresql.dialect()))
    seuils = set(condition.compile(dialect=postgresql.dialect()).params.values())

    assert "est_simule IS false" in sql
    assert "est_simule IS true" in sql
    assert maintenant - timedelta(days=30) in seuils
    assert maintenant - timedelta(days=180) in seuils
