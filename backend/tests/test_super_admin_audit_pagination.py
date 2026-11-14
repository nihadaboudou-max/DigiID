"""Vérifie que la recherche du journal d'audit précède la pagination SQL."""
import asyncio
from datetime import datetime, timezone

from src.modules.super_admin import service_phase6
from src.modules.super_admin.schemas_phase6 import FiltresAudit


class _Scalars:
    def all(self):
        return []


class _Resultat:
    def scalars(self):
        return _Scalars()


class _SessionCapture:
    def __init__(self):
        self.requete_total = None
        self.requetes_executees = []

    async def scalar(self, requete):
        self.requete_total = requete
        return 0

    async def execute(self, requete):
        self.requetes_executees.append(requete)
        return _Resultat()


def test_lister_audit_filtre_sur_toutes_les_donnees_avant_pagination():
    session = _SessionCapture()
    filtres = FiltresAudit(
        page=2,
        limite=5,
        type_evenement="connexion",
        date_debut=datetime(2026, 1, 1, tzinfo=timezone.utc),
        date_fin=datetime(2026, 1, 31, 23, 59, tzinfo=timezone.utc),
        recherche="192.0.2.1",
    )

    resultat = asyncio.run(service_phase6.lister_audit(session, filtres))

    sql = str(session.requete_total.compile()).lower()
    parametres = session.requete_total.compile().params
    assert "journal_audit.type_evenement" in sql
    assert "journal_audit.date_evenement" in sql
    assert "journal_audit.description" in sql
    assert "journal_audit.adresse_ip" in sql
    assert "journal_audit.utilisateur_id" in sql
    assert "%192.0.2.1%" in parametres.values()
    assert resultat.page == 2
    assert resultat.limite == 5
    assert resultat.total == 0
    assert len(session.requetes_executees) == 2
