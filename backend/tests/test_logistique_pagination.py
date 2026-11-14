"""Vérifie les filtres SQL et le transfert des paramètres de pagination."""
import asyncio
import uuid

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
