# -*- coding: utf-8 -*-
"""Tests des garde-fous terrain : prise en charge, remise au guichet, arrêts.

Ces règles sont **métier** : on les vérifie sans base de données, avec une
session factice, pour prouver qu'aucune requête directe ne peut contourner :

  * la fiche figée après confirmation du chauffeur ;
  * le partage des gestes chauffeur / guichet (départ vs livraison) ;
  * l'appartenance de l'arrêt de destination au trajet du voyage.
"""
import asyncio
import uuid

import pytest
from fastapi import HTTPException

from src.modeles import ArretLigne, Colis, Ligne, Utilisateur
from src.modules.logistique import schemas, service
from src.noyau.constantes_roles import RoleUtilisateur


class SessionFactice:
    """Session minimale : ``get`` rend ce qu'on lui prépare, commit no-op."""

    def __init__(self, objets: dict | None = None):
        self.objets = objets or {}
        self.ajoutes = []

    async def get(self, modele, identifiant):
        return self.objets.get((modele, identifiant))

    async def scalar(self, requete):
        # Utilisé par ``_ordre_gare_sur_ligne`` pour retrouver un arrêt.
        for (modele, _), objet in self.objets.items():
            if modele is ArretLigne:
                return objet
        return None

    def add(self, objet):
        self.ajoutes.append(objet)

    async def commit(self):
        return None

    async def refresh(self, objet):
        return objet


def _utilisateur(role: str) -> Utilisateur:
    utilisateur = Utilisateur()
    utilisateur.id = uuid.uuid4()
    utilisateur.role = role
    return utilisateur


def _colis(chauffeur_id=None, **extra) -> Colis:
    colis = Colis(
        destinataire_nom="Ada",
        destinataire_tel="+22990000000",
        gare_depart_id=uuid.uuid4(),
        gare_arrivee_id=uuid.uuid4(),
    )
    colis.id = uuid.uuid4()
    colis.chauffeur_id = chauffeur_id
    colis.statut = "enregistre"
    colis.reception_confirmee_le = None
    colis.remis_guichet_le = None
    for champ, valeur in extra.items():
        setattr(colis, champ, valeur)
    return colis


class TestGardeFousFiche:
    def test_fiche_non_confirmee_est_modifiable(self):
        utilisateur = _utilisateur(RoleUtilisateur.RECEVEUR.value)
        colis = _colis(enregistre_par_id=utilisateur.id)
        # Ne doit pas lever.
        service._exiger_fiche_modifiable(colis, utilisateur)

    def test_fiche_confirmee_est_figee(self):
        utilisateur = _utilisateur(RoleUtilisateur.RECEVEUR.value)
        colis = _colis(
            enregistre_par_id=utilisateur.id,
            reception_confirmee_le=object(),
        )
        with pytest.raises(HTTPException) as erreur:
            service._exiger_fiche_modifiable(colis, utilisateur)
        assert erreur.value.status_code == 409

    def test_colis_en_route_est_fige(self):
        utilisateur = _utilisateur(RoleUtilisateur.RECEVEUR.value)
        colis = _colis(enregistre_par_id=utilisateur.id, statut="en_transit")
        with pytest.raises(HTTPException) as erreur:
            service._exiger_fiche_modifiable(colis, utilisateur)
        assert erreur.value.status_code == 409

    def test_autre_guichetier_ne_corrige_pas(self):
        utilisateur = _utilisateur(RoleUtilisateur.RECEVEUR.value)
        colis = _colis(enregistre_par_id=uuid.uuid4())
        with pytest.raises(HTTPException) as erreur:
            service._exiger_fiche_modifiable(colis, utilisateur)
        assert erreur.value.status_code == 403

    def test_chauffeur_ne_corrige_pas_une_fiche_du_guichet(self):
        chauffeur = _utilisateur(RoleUtilisateur.CHAUFFEUR.value)
        colis = _colis(
            chauffeur_id=chauffeur.id,
            enregistre_par_id=uuid.uuid4(),
        )
        with pytest.raises(HTTPException) as erreur:
            service._exiger_fiche_modifiable(colis, chauffeur)
        assert erreur.value.status_code == 403

    def test_chauffeur_corrige_sa_propre_fiche_avant_prise_en_charge(self):
        chauffeur = _utilisateur(RoleUtilisateur.CHAUFFEUR.value)
        colis = _colis(
            chauffeur_id=chauffeur.id,
            enregistre_par_id=chauffeur.id,
        )
        # Ne doit pas lever : erreur commise pendant l'enregistrement direct.
        service._exiger_fiche_modifiable(colis, chauffeur)


class TestPartageChauffeurGuichet:
    def test_chauffeur_ne_peut_pas_constater_la_livraison(self):
        chauffeur = _utilisateur(RoleUtilisateur.CHAUFFEUR.value)
        colis = _colis(chauffeur_id=chauffeur.id)
        with pytest.raises(HTTPException) as erreur:
            asyncio.run(
                service._verifier_scan_autorise(
                    SessionFactice(),
                    colis,
                    schemas.ScanCreate(token="x", type_evenement="livraison"),
                    chauffeur,
                )
            )
        assert erreur.value.status_code == 403

    def test_chauffeur_ne_scan_pas_le_colis_d_un_autre(self):
        chauffeur = _utilisateur(RoleUtilisateur.CHAUFFEUR.value)
        colis = _colis(chauffeur_id=uuid.uuid4())
        with pytest.raises(HTTPException) as erreur:
            asyncio.run(
                service._verifier_scan_autorise(
                    SessionFactice(),
                    colis,
                    schemas.ScanCreate(token="x", type_evenement="depart"),
                    chauffeur,
                )
            )
        assert erreur.value.status_code == 403

    def test_guichet_ne_constate_pas_le_depart(self):
        receveur = _utilisateur(RoleUtilisateur.RECEVEUR.value)
        colis = _colis()
        with pytest.raises(HTTPException) as erreur:
            asyncio.run(
                service._verifier_scan_autorise(
                    SessionFactice(),
                    colis,
                    schemas.ScanCreate(token="x", type_evenement="depart"),
                    receveur,
                )
            )
        assert erreur.value.status_code == 403

    def test_guichet_ne_livre_pas_avant_la_remise(self):
        receveur = _utilisateur(RoleUtilisateur.RECEVEUR.value)
        colis = _colis(chauffeur_id=uuid.uuid4())
        with pytest.raises(HTTPException) as erreur:
            asyncio.run(
                service._verifier_scan_autorise(
                    SessionFactice(),
                    colis,
                    schemas.ScanCreate(token="x", type_evenement="livraison"),
                    receveur,
                )
            )
        assert erreur.value.status_code == 409

    def test_guichet_livre_apres_remise(self):
        receveur = _utilisateur(RoleUtilisateur.RECEVEUR.value)
        colis = _colis(chauffeur_id=uuid.uuid4(), remis_guichet_le=object())
        asyncio.run(
            service._verifier_scan_autorise(
                SessionFactice(),
                colis,
                schemas.ScanCreate(token="x", type_evenement="livraison"),
                receveur,
            )
        )


class TestArretDestination:
    def test_arret_doit_appartenir_a_la_ligne(self):
        ligne = Ligne(gare_depart_id=uuid.uuid4(), gare_arrivee_id=uuid.uuid4())
        ligne.id = uuid.uuid4()
        arret = ArretLigne(ligne_id=uuid.uuid4(), gare_id=uuid.uuid4(), ordre=2)
        arret.id = uuid.uuid4()
        session = SessionFactice({(ArretLigne, arret.id): arret})
        with pytest.raises(HTTPException) as erreur:
            asyncio.run(
                service._verifier_arret_destination(
                    session, ligne, arret.id, ligne.gare_depart_id
                )
            )
        assert erreur.value.status_code == 400

    def test_arret_apres_le_depart_est_accepte(self):
        depart = uuid.uuid4()
        ligne = Ligne(gare_depart_id=depart, gare_arrivee_id=uuid.uuid4())
        ligne.id = uuid.uuid4()
        arret = ArretLigne(ligne_id=ligne.id, gare_id=uuid.uuid4(), ordre=2)
        arret.id = uuid.uuid4()
        session = SessionFactice({(ArretLigne, arret.id): arret})
        resultat = asyncio.run(
            service._verifier_arret_destination(session, ligne, arret.id, depart)
        )
        assert resultat is arret

    def test_arret_avant_le_depart_est_refuse(self):
        ligne = Ligne(gare_depart_id=uuid.uuid4(), gare_arrivee_id=uuid.uuid4())
        ligne.id = uuid.uuid4()
        arret = ArretLigne(ligne_id=ligne.id, gare_id=uuid.uuid4(), ordre=1)
        arret.id = uuid.uuid4()
        session = SessionFactice({(ArretLigne, arret.id): arret})
        with pytest.raises(HTTPException) as erreur:
            asyncio.run(
                service._verifier_arret_destination(
                    session, ligne, arret.id, uuid.uuid4()
                )
            )
        assert erreur.value.status_code == 400


class TestConfirmationReception:
    def test_remise_au_guichet_exige_la_prise_en_charge(self):
        chauffeur = _utilisateur(RoleUtilisateur.CHAUFFEUR.value)
        colis = _colis(chauffeur_id=chauffeur.id)
        session = SessionFactice({(Colis, colis.id): colis})
        with pytest.raises(HTTPException) as erreur:
            asyncio.run(
                service.remettre_colis_au_guichet(session, colis.id, chauffeur)
            )
        assert erreur.value.status_code == 409

    def test_chauffeur_confirme_et_fige_la_fiche(self):
        chauffeur = _utilisateur(RoleUtilisateur.CHAUFFEUR.value)
        colis = _colis(chauffeur_id=chauffeur.id)
        session = SessionFactice({(Colis, colis.id): colis})
        resultat = asyncio.run(
            service.confirmer_reception_colis(session, colis.id, chauffeur)
        )
        assert resultat.reception_confirmee_le is not None
        assert resultat.reception_confirmee_par_id == chauffeur.id
        assert len(session.ajoutes) == 1
        assert session.ajoutes[0].type_evenement == "reception"

    def test_un_autre_chauffeur_ne_receptionne_pas(self):
        chauffeur = _utilisateur(RoleUtilisateur.CHAUFFEUR.value)
        colis = _colis(chauffeur_id=uuid.uuid4())
        session = SessionFactice({(Colis, colis.id): colis})
        with pytest.raises(HTTPException) as erreur:
            asyncio.run(
                service.confirmer_reception_colis(session, colis.id, chauffeur)
            )
        assert erreur.value.status_code == 403
