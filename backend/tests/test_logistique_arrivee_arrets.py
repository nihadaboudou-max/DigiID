import asyncio
import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from src.modeles import ArretLigne, Ligne
from src.modules.logistique import service


class SessionArrivee:
    def __init__(self, ligne, arret):
        self.ligne = ligne
        self.arret = arret
        self.ajoutes = []
        self.commits = 0

    async def get(self, modele, identifiant):
        if modele is Ligne and identifiant == self.ligne.id:
            return self.ligne
        if modele is ArretLigne and self.arret and identifiant == self.arret.id:
            return self.arret
        return None

    async def scalar(self, _requete):
        return self.arret.id if self.arret else None

    def add(self, evenement):
        self.ajoutes.append(evenement)

    async def commit(self):
        self.commits += 1


def _preparer_arrivee(monkeypatch, colis):
    gare_depart_id, gare_intermediaire_id, gare_arrivee_id = (
        uuid.uuid4(),
        uuid.uuid4(),
        uuid.uuid4(),
    )
    arret = SimpleNamespace(
        id=uuid.uuid4(),
        ligne_id=uuid.uuid4(),
        gare_id=gare_intermediaire_id,
        ordre=1,
        actif=True,
    )
    ligne = SimpleNamespace(
        id=arret.ligne_id,
        gare_depart_id=gare_depart_id,
        gare_arrivee_id=gare_arrivee_id,
    )
    voyage = SimpleNamespace(
        id=uuid.uuid4(),
        ligne_id=ligne.id,
        statut="en_cours",
        date_arrivee=None,
    )
    colis.voyage_id = voyage.id
    session = SessionArrivee(ligne, arret)

    async def obtenir_voyage(_session, _voyage_id):
        return voyage

    async def colis_du_voyage(_session, _voyage_id):
        return [colis]

    async def aucun_passager(_session, _voyage_id):
        return []

    async def aucune_notification(*_args, **_kwargs):
        return None

    monkeypatch.setattr(service, "obtenir_voyage", obtenir_voyage)
    monkeypatch.setattr(service, "_colis_du_voyage", colis_du_voyage)
    monkeypatch.setattr(service, "_passagers_du_voyage", aucun_passager)
    monkeypatch.setattr(service, "_exiger_charge_a_bord", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(service, "_libelle_gare", aucune_notification)
    monkeypatch.setattr(service, "obtenir_ticket_du_colis", aucune_notification)
    monkeypatch.setattr(service, "_notifier_scan_colis", aucune_notification)
    return session, voyage, ligne, arret, gare_intermediaire_id


def test_arrivee_a_un_arret_intermediaire_ne_termine_pas_le_voyage(monkeypatch):
    colis = SimpleNamespace(
        id=uuid.uuid4(),
        statut="en_transit",
        arret_destination_id=None,
        gare_arrivee_id=None,
    )
    session, voyage, _ligne, arret, gare_intermediaire_id = _preparer_arrivee(
        monkeypatch, colis
    )
    colis.arret_destination_id = arret.id
    colis.gare_arrivee_id = gare_intermediaire_id
    chauffeur = SimpleNamespace(id=uuid.uuid4())

    resultat = asyncio.run(
        service.marquer_arrivee_voyage(
            session, voyage.id, chauffeur, arret_id=arret.id
        )
    )

    assert resultat["nb_colis"] == 1
    assert colis.statut == "arrive"
    assert voyage.statut == "en_cours"


def test_arrivee_au_terminus_termine_le_voyage(monkeypatch):
    colis = SimpleNamespace(
        id=uuid.uuid4(),
        statut="en_transit",
        arret_destination_id=None,
        gare_arrivee_id=None,
    )
    session, voyage, ligne, _arret, _gare_intermediaire_id = _preparer_arrivee(
        monkeypatch, colis
    )
    colis.gare_arrivee_id = ligne.gare_arrivee_id
    chauffeur = SimpleNamespace(id=uuid.uuid4())

    resultat = asyncio.run(
        service.marquer_arrivee_voyage(
            session, voyage.id, chauffeur, gare_id=ligne.gare_arrivee_id
        )
    )

    assert resultat["nb_colis"] == 1
    assert colis.statut == "arrive"
    assert voyage.statut == "termine"


def test_arrivee_avec_arrets_exige_un_point_de_descente(monkeypatch):
    colis = SimpleNamespace(
        id=uuid.uuid4(),
        statut="en_transit",
        arret_destination_id=None,
        gare_arrivee_id=None,
    )
    session, voyage, _ligne, _arret, _gare_intermediaire_id = _preparer_arrivee(
        monkeypatch, colis
    )
    chauffeur = SimpleNamespace(id=uuid.uuid4())

    with pytest.raises(HTTPException) as erreur:
        asyncio.run(
            service.marquer_arrivee_voyage(session, voyage.id, chauffeur)
        )

    assert erreur.value.status_code == 400
    assert colis.statut == "en_transit"
