"""Vérifie la pagination serveur stable du journal d'activité personnel."""
import asyncio
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

from src.modules.profil import service


class _ResultatTotal:
    def scalar_one(self):
        return 12


class _Scalars:
    def __init__(self, elements):
        self._elements = elements

    def all(self):
        return self._elements


class _ResultatPage:
    def __init__(self, elements):
        self._elements = elements

    def scalars(self):
        return _Scalars(self._elements)


class _SessionCapture:
    def __init__(self, element):
        self.requetes = []
        self.element = element

    async def execute(self, requete):
        self.requetes.append(requete)
        if len(self.requetes) == 1:
            return _ResultatTotal()
        return _ResultatPage([self.element])

    async def commit(self):
        pass


def test_obtenir_activite_paginee_applique_offset_et_borne(monkeypatch):
    async def ne_pas_enregistrer_audit(*args, **kwargs):
        return None

    monkeypatch.setattr(service, "_enregistrer_audit", ne_pas_enregistrer_audit)

    identifiant_utilisateur = uuid.uuid4()
    instantane_id = uuid.uuid4()
    instantane_date = datetime(2026, 11, 15, 12, 0, tzinfo=timezone.utc)
    date_activite = datetime(2026, 11, 15, 11, 0, tzinfo=timezone.utc)
    evenement = SimpleNamespace(
        id=uuid.uuid4(),
        type_evenement="connexion",
        description="Connexion au compte",
        date_evenement=date_activite,
        adresse_ip=None,
    )
    session = _SessionCapture(evenement)

    resultat = asyncio.run(
        service.obtenir_activite_recente_paginee(
            session=session,
            utilisateur=SimpleNamespace(id=identifiant_utilisateur, role="citoyen"),
            page=2,
            par_page=5,
            snapshot_date=instantane_date,
            snapshot_id=instantane_id,
        )
    )

    requete_page = session.requetes[1]
    compilee = requete_page.compile()
    sql_page = str(compilee).lower()

    assert "journal_audit.utilisateur_id" in sql_page
    assert "journal_audit.date_evenement" in sql_page
    assert "offset" in sql_page
    assert "limit" in sql_page
    assert (2 - 1) * 5 in compilee.params.values()
    assert instantane_date in compilee.params.values()
    assert instantane_id in compilee.params.values()
    assert resultat["total"] == 12
    assert resultat["page"] == 2
    assert resultat["par_page"] == 5
    assert resultat["snapshot_id"] == str(instantane_id)
    assert resultat["elements"][0]["description"] == "Connexion au compte"
