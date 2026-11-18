import asyncio
import uuid
from types import SimpleNamespace

from src.modeles.logistique import Colis
from src.modeles.utilisateur import Utilisateur
from src.modules.logistique import service


class SessionSuiviPublic:
    def __init__(self, valeurs=None, resultats_scalar=()):
        self.valeurs = valeurs or {}
        self.resultats_scalar = iter(resultats_scalar)

    async def get(self, modele, identifiant):
        return self.valeurs.get(modele)

    async def scalar(self, requete):
        return next(self.resultats_scalar)


def test_suivi_public_n_inclut_le_chauffeur_qu_avec_un_token_qr(monkeypatch):
    ticket = SimpleNamespace(type="COLIS", code_clair="COL-123")
    inclusions = []

    async def suivre_colis(session, ticket, *, inclure_chauffeur=False):
        inclusions.append(inclure_chauffeur)
        return SimpleNamespace(inclure_chauffeur=inclure_chauffeur)

    monkeypatch.setattr(service, "_suivi_public_colis", suivre_colis)

    resultat_code = asyncio.run(
        service.construire_suivi_public(
            SessionSuiviPublic(resultats_scalar=(ticket,)),
            "COL-123",
        )
    )
    resultat_qr = asyncio.run(
        service.construire_suivi_public(
            SessionSuiviPublic(resultats_scalar=(None, ticket)),
            "jeton-qr-opaque",
        )
    )

    assert resultat_code.inclure_chauffeur is False
    assert resultat_qr.inclure_chauffeur is True
    assert inclusions == [False, True]


def test_recu_public_par_qr_contient_le_nom_et_le_telephone_du_chauffeur(monkeypatch):
    colis_id = uuid.uuid4()
    chauffeur_id = uuid.uuid4()
    colis = SimpleNamespace(
        id=colis_id,
        statut="en_transit",
        gare_depart_id=None,
        gare_arrivee_id=None,
        voyage_id=None,
        chauffeur_id=chauffeur_id,
        destinataire_nom="Destinataire",
        description="Documents",
        poids_kg=1.0,
        nombre_articles=1,
        nombre_bagages=1,
    )
    chauffeur = SimpleNamespace(
        prenom_chiffre="Aïcha",
        nom_chiffre="Sèmè",
        telephone_chiffre="+22997000000",
    )
    session = SessionSuiviPublic({Colis: colis, Utilisateur: chauffeur})

    async def rien(*args, **kwargs):
        return []

    async def noms_gares(*args, **kwargs):
        return {}

    monkeypatch.setattr(service, "lister_evenements", rien)
    monkeypatch.setattr(service, "lister_notifications", rien)
    monkeypatch.setattr(service, "_noms_gares", noms_gares)
    monkeypatch.setattr(service, "dechiffrer_donnee", lambda valeur: valeur)
    ticket = SimpleNamespace(reference_id=colis_id, code_clair="COL-123")

    resultat = asyncio.run(
        service._suivi_public_colis(
            session,
            ticket,
            inclure_chauffeur=True,
        )
    )

    assert resultat.chauffeur_nom == "Aïcha Sèmè"
    assert resultat.chauffeur_telephone == "+22997000000"
