# -*- coding: utf-8 -*-
"""Tests des agrégats financiers visibles par le super-administrateur."""
import asyncio
import uuid

import pytest

from src.modeles import Utilisateur
from src.modules.paiement import mobile_money, schemas as schemas_paiement, service
from src.noyau.permissions import a_permission


class Resultat:
    def __init__(self, *, totaux=None, lignes=None):
        self._totaux = totaux
        self._lignes = lignes or []

    def one(self):
        return self._totaux

    def all(self):
        return self._lignes


class SessionFactice:
    def __init__(self, totaux, lignes, solde):
        self.resultats = iter((Resultat(totaux=totaux), Resultat(lignes=lignes)))
        self.solde = solde

    async def execute(self, requete):
        return next(self.resultats)

    async def scalar(self, requete):
        return self.solde


def test_statistiques_aggregent_paiements_reussis_et_classent_les_agents():
    agent = Utilisateur()
    agent.id = uuid.uuid4()
    agent.digiid_public = "REC-001"
    session = SessionFactice(
        totaux=(3, 2500, 1700, 800),
        lignes=[(agent, 2, 1800, 1200, 600)],
        solde=450,
    )

    resultat = asyncio.run(service.statistiques_plateforme(session))

    assert resultat == {
        "transactions_reussies": 3,
        "montant_total_encaisse_fcfa": 2500,
        "revenu_plateforme_fcfa": 1700,
        "commissions_fcfa": 800,
        "solde_total_cagnottes_fcfa": 450,
        "top_acteurs": [
            {
                "acteur_id": agent.id,
                "nom_complet": "REC-001",
                "transactions_reussies": 2,
                "montant_encaisse_fcfa": 1800,
                "revenu_plateforme_fcfa": 1200,
                "commissions_fcfa": 600,
            }
        ],
    }


def test_statistiques_financieres_sont_reservees_au_super_administrateur():
    assert a_permission("super_administrateur", "paiement.statistiques")
    assert not a_permission("receveur", "paiement.statistiques")


def test_catalogue_mobile_money_benin_propose_mtn_et_moov_en_mode_mock():
    moyens = {moyen["code"]: moyen for moyen in mobile_money.lister_moyens()}

    assert set(moyens) == {"especes", "mtn", "moov"}
    for code in ("mtn", "moov"):
        assert moyens[code]["immediat"] is False
        resultat = mobile_money.obtenir_fournisseur(code).initier(
            100, "+2290197123456", "PAY-TEST"
        )
        assert resultat.statut == "en_attente"
        assert "-MOCK-" in resultat.reference_externe


def test_schema_paiement_exige_un_numero_pour_mtn_et_moov():
    for operateur in ("mtn", "moov"):
        with pytest.raises(ValueError, match="téléphone mobile money"):
            schemas_paiement.TransactionCreate(
                type="PASSAGER",
                montant_fcfa=100,
                moyen=operateur,
            )
