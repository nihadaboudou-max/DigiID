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
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from src.modeles import (
    ArretLigne,
    Colis,
    Ligne,
    ProfilLogistique,
    SuiviFamilial,
    Utilisateur,
)
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
    def test_chauffeur_peut_constater_la_livraison_directe(self):
        chauffeur = _utilisateur(RoleUtilisateur.CHAUFFEUR.value)
        colis = _colis(chauffeur_id=chauffeur.id)
        asyncio.run(
            service._verifier_scan_autorise(
                SessionFactice(),
                colis,
                schemas.ScanCreate(token="x", type_evenement="livraison"),
                chauffeur,
            )
        )

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
        colis = _colis(
            chauffeur_id=uuid.uuid4(),
            remis_guichet_le=object(),
            remis_guichet_a_id=receveur.id,
        )
        asyncio.run(
            service._verifier_scan_autorise(
                SessionFactice(),
                colis,
                schemas.ScanCreate(token="x", type_evenement="livraison"),
                receveur,
            )
        )

    def test_gerant_de_gare_ne_realise_pas_de_scan_de_livraison(self):
        gerant = _utilisateur(RoleUtilisateur.GERANT_GARE.value)
        colis = _colis(remis_guichet_le=object(), remis_guichet_a_id=gerant.id)
        with pytest.raises(HTTPException) as erreur:
            asyncio.run(
                service._verifier_scan_autorise(
                    SessionFactice(),
                    colis,
                    schemas.ScanCreate(token="x", type_evenement="livraison"),
                    gerant,
                )
            )
        assert erreur.value.status_code == 403

    def test_gerant_de_gare_ne_peut_pas_enregistrer_un_colis(self):
        gerant = _utilisateur(RoleUtilisateur.GERANT_GARE.value)

        with pytest.raises(HTTPException) as erreur:
            asyncio.run(service.creer_colis(SessionFactice(), None, gerant))

        assert erreur.value.status_code == 403

    def test_commercant_ne_realise_pas_de_scan_de_livraison(self):
        commercant = _utilisateur(RoleUtilisateur.COMMERCANT.value)
        colis = _colis(remis_guichet_le=object(), remis_guichet_a_id=commercant.id)
        with pytest.raises(HTTPException) as erreur:
            asyncio.run(
                service._verifier_scan_autorise(
                    SessionFactice(),
                    colis,
                    schemas.ScanCreate(token="x", type_evenement="livraison"),
                    commercant,
                )
            )
        assert erreur.value.status_code == 403

    def test_guichet_ne_livre_pas_un_colis_confie_a_un_autre_agent(self):
        receveur = _utilisateur(RoleUtilisateur.RECEVEUR.value)
        colis = _colis(
            chauffeur_id=uuid.uuid4(),
            remis_guichet_le=object(),
            remis_guichet_a_id=uuid.uuid4(),
        )
        with pytest.raises(HTTPException) as erreur:
            asyncio.run(
                service._verifier_scan_autorise(
                    SessionFactice(),
                    colis,
                    schemas.ScanCreate(token="x", type_evenement="livraison"),
                    receveur,
                )
            )
        assert erreur.value.status_code == 403


class TestEvenementsSuiviFamilial:
    def test_gerant_ne_peut_pas_gerer_une_fiche_de_suivi(self):
        gerant = _utilisateur(RoleUtilisateur.GERANT_GARE.value)

        with pytest.raises(HTTPException) as erreur:
            service._exiger_gestion_suivi_familial(gerant)

        assert erreur.value.status_code == 403

    def test_guichet_ne_marque_pas_le_depart(self):
        receveur = _utilisateur(RoleUtilisateur.RECEVEUR.value)
        suivi = SimpleNamespace(type_passager="enfant")
        donnees = schemas.SuiviFamilialEvenementCreate(type_evenement="depart")

        with pytest.raises(HTTPException) as erreur:
            service._verifier_evenement_suivi_autorise(suivi, donnees, receveur)

        assert erreur.value.status_code == 403

    def test_guichet_ne_signale_pas_un_autre_evenement(self):
        receveur = _utilisateur(RoleUtilisateur.RECEVEUR.value)
        suivi = SimpleNamespace(type_passager="enfant")
        donnees = schemas.SuiviFamilialEvenementCreate(type_evenement="incident")

        with pytest.raises(HTTPException) as erreur:
            service._verifier_evenement_suivi_autorise(suivi, donnees, receveur)

        assert erreur.value.status_code == 403

    def test_guichet_ne_marque_pas_l_arrivee(self):
        receveur = _utilisateur(RoleUtilisateur.RECEVEUR.value)
        suivi = SimpleNamespace(type_passager="enfant")
        donnees = schemas.SuiviFamilialEvenementCreate(type_evenement="arrivee")

        with pytest.raises(HTTPException) as erreur:
            service._verifier_evenement_suivi_autorise(suivi, donnees, receveur)

        assert erreur.value.status_code == 403

    def test_guichet_ne_livre_pas_un_enfant_non_confie(self):
        receveur = _utilisateur(RoleUtilisateur.RECEVEUR.value)
        suivi = SimpleNamespace(
            type_passager="enfant",
            remis_guichet_le=None,
            remis_guichet_a_id=receveur.id,
        )
        donnees = schemas.SuiviFamilialEvenementCreate(type_evenement="livraison")

        with pytest.raises(HTTPException) as erreur:
            service._verifier_evenement_suivi_autorise(suivi, donnees, receveur)

        assert erreur.value.status_code == 409

    def test_guichet_ne_livre_pas_un_enfant_confie_a_un_autre_agent(self):
        receveur = _utilisateur(RoleUtilisateur.RECEVEUR.value)
        suivi = SimpleNamespace(
            type_passager="enfant",
            remis_guichet_le=object(),
            remis_guichet_a_id=uuid.uuid4(),
        )
        donnees = schemas.SuiviFamilialEvenementCreate(type_evenement="livraison")

        with pytest.raises(HTTPException) as erreur:
            service._verifier_evenement_suivi_autorise(suivi, donnees, receveur)

        assert erreur.value.status_code == 403

    def test_agent_designe_peut_livrer_un_enfant_confie(self):
        receveur = _utilisateur(RoleUtilisateur.RECEVEUR.value)
        suivi = SimpleNamespace(
            type_passager="enfant",
            remis_guichet_le=object(),
            remis_guichet_a_id=receveur.id,
        )
        donnees = schemas.SuiviFamilialEvenementCreate(type_evenement="livraison")

        service._verifier_evenement_suivi_autorise(suivi, donnees, receveur)

    def test_gerant_ne_peut_pas_marquer_une_etape_de_suivi_familial(self):
        gerant = _utilisateur(RoleUtilisateur.GERANT_GARE.value)
        suivi = SimpleNamespace(type_passager="enfant")
        donnees = schemas.SuiviFamilialEvenementCreate(type_evenement="depart")

        with pytest.raises(HTTPException) as erreur:
            service._verifier_evenement_suivi_autorise(suivi, donnees, gerant)

        assert erreur.value.status_code == 403

    def test_commercant_n_a_pas_acces_au_suivi_familial(self):
        commercant = _utilisateur(RoleUtilisateur.COMMERCANT.value)

        with pytest.raises(HTTPException) as erreur:
            service.exiger_acces_suivi_familial(commercant)

        assert erreur.value.status_code == 403

    def test_chauffeur_peut_confirmer_la_remise_directe_a_la_famille(self):
        chauffeur = _utilisateur(RoleUtilisateur.CHAUFFEUR.value)
        suivi = SimpleNamespace(
            type_passager="enfant",
            remis_guichet_le=None,
            remis_guichet_a_id=None,
        )
        donnees = schemas.SuiviFamilialEvenementCreate(type_evenement="livraison")

        service._verifier_evenement_suivi_autorise(suivi, donnees, chauffeur)


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


class TestVoyageOuvert:
    @pytest.mark.parametrize("statut", ["termine", "annule"])
    def test_refuse_lajout_sur_un_voyage_ferme(self, statut):
        voyage = type("VoyageFactice", (), {"statut": statut})()

        with pytest.raises(HTTPException) as erreur:
            service._exiger_voyage_ouvert(voyage)

        assert erreur.value.status_code == 409

    @pytest.mark.parametrize("statut", ["planifie", "en_cours"])
    def test_accepte_lajout_sur_un_voyage_ouvert(self, statut):
        voyage = type("VoyageFactice", (), {"statut": statut})()

        service._exiger_voyage_ouvert(voyage)


def test_creation_ligne_ne_depend_pas_du_moyen_de_paiement():
    ligne = schemas.LigneCreate(
        gare_depart_id=uuid.uuid4(),
        gare_arrivee_id=uuid.uuid4(),
    )

    assert ligne.gare_depart_id != ligne.gare_arrivee_id


@pytest.mark.parametrize("moyen", ["mtn", "moov"])
def test_colis_mobile_money_exige_un_telephone_de_paiement(moyen):
    with pytest.raises(ValueError, match="téléphone mobile money"):
        schemas.ColisCreate(
            destinataire_nom="Awa",
            destinataire_tel="+2290197123456",
            gare_depart_id=uuid.uuid4(),
            gare_arrivee_id=uuid.uuid4(),
            moyen_paiement=moyen,
        )


class TestConfirmationReception:
    def test_remise_au_guichet_exige_la_prise_en_charge(self):
        chauffeur = _utilisateur(RoleUtilisateur.CHAUFFEUR.value)
        colis = _colis(chauffeur_id=chauffeur.id)
        session = SessionFactice({(Colis, colis.id): colis})
        with pytest.raises(HTTPException) as erreur:
            asyncio.run(
                service.remettre_colis_au_guichet(
                    session, colis.id, chauffeur, uuid.uuid4()
                )
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


class SessionGuichetFactice(SessionFactice):
    """Session qui renvoie un profil ciblé pour vérifier l'affectation de gare."""

    def __init__(
        self, objets: dict, profil: ProfilLogistique | None, gare_id: uuid.UUID
    ):
        super().__init__(objets)
        self.profil = profil
        self.gare_id = gare_id

    async def scalar(self, requete):
        if self.profil is not None and self.profil.gare_id == self.gare_id:
            return self.profil
        return None


class TestRemiseAuGuichet:
    @staticmethod
    def _agent(gare_id):
        agent = _utilisateur(RoleUtilisateur.RECEVEUR.value)
        agent.est_actif = True
        profil = ProfilLogistique(
            utilisateur_id=agent.id,
            type_profil="receveur",
            identifiant_public="REC-TEST",
            gare_id=gare_id,
        )
        return agent, profil

    def test_remise_colis_enregistre_le_receveur_choisi(self):
        chauffeur = _utilisateur(RoleUtilisateur.CHAUFFEUR.value)
        gare_id = uuid.uuid4()
        agent, profil = self._agent(gare_id)
        colis = _colis(
            chauffeur_id=chauffeur.id,
            gare_arrivee_id=gare_id,
            statut="arrive",
            reception_confirmee_le=object(),
        )
        session = SessionGuichetFactice(
            {(Colis, colis.id): colis, (Utilisateur, agent.id): agent},
            profil,
            gare_id,
        )

        resultat = asyncio.run(
            service.remettre_colis_au_guichet(session, colis.id, chauffeur, agent.id)
        )

        assert resultat.remis_guichet_a_id == agent.id
        assert resultat.remis_guichet_le is not None

    def test_remise_refuse_un_receveur_dune_autre_gare(self):
        chauffeur = _utilisateur(RoleUtilisateur.CHAUFFEUR.value)
        gare_arrivee = uuid.uuid4()
        agent, profil = self._agent(uuid.uuid4())
        colis = _colis(
            chauffeur_id=chauffeur.id,
            gare_arrivee_id=gare_arrivee,
            statut="arrive",
            reception_confirmee_le=object(),
        )
        session = SessionGuichetFactice(
            {(Colis, colis.id): colis, (Utilisateur, agent.id): agent},
            profil,
            gare_arrivee,
        )

        with pytest.raises(HTTPException) as erreur:
            asyncio.run(
                service.remettre_colis_au_guichet(
                    session, colis.id, chauffeur, agent.id
                )
            )

        assert erreur.value.status_code == 409

    def test_remise_enfant_enregistre_le_receveur_choisi(self):
        chauffeur = _utilisateur(RoleUtilisateur.CHAUFFEUR.value)
        gare_id = uuid.uuid4()
        agent, profil = self._agent(gare_id)
        suivi = SuiviFamilial()
        suivi.id = uuid.uuid4()
        suivi.chauffeur_id = chauffeur.id
        suivi.gare_arrivee_id = gare_id
        suivi.type_passager = "enfant"
        suivi.statut = "arrive"
        suivi.reception_confirmee_le = object()
        suivi.remis_guichet_le = None
        suivi.remis_guichet_a_id = None
        session = SessionGuichetFactice(
            {
                (SuiviFamilial, suivi.id): suivi,
                (Utilisateur, agent.id): agent,
            },
            profil,
            gare_id,
        )

        resultat = asyncio.run(
            service.remettre_suivi_au_guichet(
                session, suivi.id, chauffeur, agent.id
            )
        )

        assert resultat.remis_guichet_a_id == agent.id
        assert resultat.remis_guichet_le is not None
