import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from src.modules.logistique import routes
from src.modules.logistique.schemas import BagageResponse


def test_ticket_colis_refuse_a_un_utilisateur_non_createur(monkeypatch):
    createur_id = uuid4()
    colis = SimpleNamespace(id=uuid4(), enregistre_par_id=createur_id)
    utilisateur = SimpleNamespace(id=uuid4())

    async def obtenir_colis(_session, _colis_id):
        return colis

    monkeypatch.setattr(routes.service, "obtenir_colis", obtenir_colis)

    with pytest.raises(HTTPException) as erreur:
        asyncio.run(
            routes.voir_mon_ticket_colis(
                colis_id=colis.id,
                utilisateur_courant=utilisateur,
                session=object(),
            )
        )

    assert erreur.value.status_code == 403


def test_reponse_colis_ne_contient_pas_les_qr_pour_un_non_createur(monkeypatch):
    createur_id = uuid4()
    colis_id = uuid4()
    ticket_id = uuid4()
    bagage = BagageResponse(
        id=uuid4(),
        ticket_id=uuid4(),
        colis_id=colis_id,
        numero_serie="Sac 1/1",
        position=1,
        nombre_total=1,
        statut="enregistre",
        code_clair="BAG-123",
        qr_code_url="https://example.test/qr",
        cree_le=datetime.now(timezone.utc),
    )
    colis = SimpleNamespace(
        id=colis_id,
        gare_depart_id=uuid4(),
        gare_arrivee_id=uuid4(),
        expediteur_nom="Expéditeur",
        expediteur_id=None,
        receveur_id=None,
        chauffeur_id=None,
        enregistre_par_id=createur_id,
        arret_destination_id=None,
        remis_guichet_par_id=None,
        remis_guichet_a_id=None,
        photo_chemin=None,
        livre_le=None,
    )
    ticket = SimpleNamespace(
        id=ticket_id,
        code_clair="COL-123",
        qr_token="secret-token",
    )

    class SessionFactice:
        async def scalar(self, _requete):
            return None

    async def rien(*_args):
        return None

    async def obtenir_ticket(*_args):
        return ticket

    async def lister_bagages(*_args, **_kwargs):
        return [bagage]

    monkeypatch.setattr(routes, "_nom_gare", rien)
    monkeypatch.setattr(routes, "_nom_utilisateur", rien)
    monkeypatch.setattr(routes.service, "obtenir_ticket_du_colis", obtenir_ticket)
    monkeypatch.setattr(routes, "_bagages_enrichis", lister_bagages)
    monkeypatch.setattr(routes, "chemin_photo_colis", lambda _chemin: None)

    reponse = asyncio.run(
        routes._enrichir_colis(
            SessionFactice(),
            colis,
            utilisateur_id=uuid4(),
        )
    )

    assert reponse.qr_token is None
    assert reponse.qr_code_url is None
    assert reponse.bagages[0].code_clair is None
    assert reponse.bagages[0].qr_code_url is None
