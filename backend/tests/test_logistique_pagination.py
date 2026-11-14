"""Vérifie les filtres SQL et le transfert des paramètres de pagination."""
import asyncio
import uuid
from datetime import datetime, timezone

from src.modeles import Utilisateur
from src.modules.logistique import service
from src.noyau.constantes_roles import RoleUtilisateur


class _SessionCapture:
    pass


def _chauffeur() -> Utilisateur:
    utilisateur = Utilisateur()
    utilisateur.id = uuid.uuid4()
    utilisateur.role = RoleUtilisateur.CHAUFFEUR.value
    return utilisateur


def _capturer_requete(monkeypatch):
    resultat = {}

    async def paginer(_session, requete, page, par_page):
        resultat.update(requete=requete, page=page, par_page=par_page)
        return [], 0

    monkeypatch.setattr(service, "_paginer", paginer)
    return resultat


def test_lister_colis_filtre_recherche_statut_et_voyages_du_chauffeur(monkeypatch):
    capture = _capturer_requete(monkeypatch)

    asyncio.run(
        service.lister_colis(
            _SessionCapture(),
            2,
            5,
            utilisateur=_chauffeur(),
            statuts=["enregistre", "en_transit"],
            recherche="COT-123",
        )
    )

    requete = capture["requete"]
    sql = str(requete.compile()).lower()
    parametres = requete.compile().params
    assert capture["page"] == 2
    assert capture["par_page"] == 5
    assert "colis.statut in" in sql
    assert "tickets.code_clair" in sql
    assert "voyages.chauffeur_id" in sql
    assert "%COT-123%" in parametres.values()


def test_lister_colis_filtre_intervalle_de_creation(monkeypatch):
    capture = _capturer_requete(monkeypatch)
    debut = datetime(2026, 11, 14, tzinfo=timezone.utc)
    fin = datetime(2026, 11, 15, tzinfo=timezone.utc)

    asyncio.run(
        service.lister_colis(
            _SessionCapture(),
            1,
            5,
            cree_depuis=debut,
            cree_jusqu_a=fin,
        )
    )

    requete = capture["requete"]
    sql = str(requete.compile()).lower()
    parametres = requete.compile().params
    assert "colis.cree_le >=" in sql
    assert "colis.cree_le <" in sql
    assert debut in parametres.values()
    assert fin in parametres.values()


def test_lister_passagers_recherche_et_perimetre_chauffeur(monkeypatch):
    capture = _capturer_requete(monkeypatch)

    asyncio.run(
        service.lister_suivi_familial(
            _SessionCapture(),
            1,
            5,
            recherche="Dossou",
            utilisateur=_chauffeur(),
        )
    )

    sql = str(capture["requete"].compile()).lower()
    assert "suivi_familial.enfant_nom" in sql
    assert "suivi_familial.telephone_parent" in sql
    assert "tickets.code_clair" in sql
    assert "voyages.chauffeur_id" in sql
    assert capture["page"] == 1
    assert capture["par_page"] == 5


def test_lister_passagers_filtre_plusieurs_statuts(monkeypatch):
    capture = _capturer_requete(monkeypatch)

    asyncio.run(
        service.lister_suivi_familial(
            _SessionCapture(),
            1,
            1,
            voyage_id=uuid.uuid4(),
            utilisateur=_chauffeur(),
            statuts=["enregistre", "en_route", "arrive"],
        )
    )

    sql = str(capture["requete"].compile()).lower()
    assert "suivi_familial.statut in" in sql
    assert "suivi_familial.voyage_id =" in sql
    assert capture["page"] == 1
    assert capture["par_page"] == 1


def test_lister_voyages_accepte_plusieurs_statuts(monkeypatch):
    capture = _capturer_requete(monkeypatch)

    asyncio.run(
        service.lister_voyages(
            _SessionCapture(),
            3,
            5,
            utilisateur=_chauffeur(),
            statuts=["termine", "annule"],
        )
    )

    sql = str(capture["requete"].compile()).lower()
    assert "voyages.statut in" in sql
    assert "voyages.chauffeur_id" in sql
    assert capture["page"] == 3
    assert capture["par_page"] == 5


def test_lister_vehicules_filtre_gare_recherche_et_transmet_page(monkeypatch):
    capture = _capturer_requete(monkeypatch)

    asyncio.run(
        service.lister_vehicules(
            _SessionCapture(),
            2,
            5,
            gare_id=uuid.uuid4(),
            recherche="AB-123",
        )
    )

    requete = capture["requete"]
    sql = str(requete.compile()).lower()
    parametres = requete.compile().params
    assert "vehicules.gare_id" in sql
    assert "vehicules.immatriculation" in sql
    assert "vehicules.marque" in sql
    assert " like " in sql
    assert "%AB-123%" in parametres.values()
    assert capture["page"] == 2
    assert capture["par_page"] == 5


def test_lister_evenements_pagine_filtre_par_colis_et_transmet_page(monkeypatch):
    capture = _capturer_requete(monkeypatch)

    async def obtenir_colis(_session, _colis_id):
        return object()

    monkeypatch.setattr(service, "obtenir_colis", obtenir_colis)

    asyncio.run(
        service.lister_evenements_pagine(
            _SessionCapture(), uuid.uuid4(), 2, 5
        )
    )

    sql = str(capture["requete"].compile()).lower()
    assert "colis_evenements.colis_id" in sql
    assert "colis_evenements.horodatage" in sql
    assert capture["page"] == 2
    assert capture["par_page"] == 5
