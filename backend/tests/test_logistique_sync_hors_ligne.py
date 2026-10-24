# -*- coding: utf-8 -*-
"""Tests de la synchronisation des colis saisis hors-ligne (file du guichet).

Ce qui est prouvé ici, sans base de données (session factice) :

  * le ``id_local`` du poste est transmis à ``service.creer_colis`` : la clé
    d'idempotence est écrite **dans la même transaction** que le colis, et non
    par une affectation après commit (fenêtre où un colis pouvait être créé
    deux fois au rejeu de la file) ;
  * un colis déjà présent pour ce ``id_local`` n'est jamais recréé ;
  * une collision concurrente (index UNIQUE) renvoie le colis gagnant au lieu
    de faire échouer toute la synchronisation.

Et, côté authentification (bug « 401 AUTH_001 » de la synchro) :

  * la route est bien protégée par ``Depends(utilisateur_courant)`` : sans
    jeton Bearer, l'API répond **401 AUTH_001** — code que le client doit
    interpréter comme « renouveler le jeton d'accès », pas comme un refus de
    droit ;
  * elle reste soumise à ``logistique.colis.creer`` : aucun jeton
    « programmatique » partagé n'ouvre la porte à un poste non habilité.
"""
import asyncio
import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from src.modeles import Colis, Ticket, Utilisateur
from src.modules.authentification.dependances import utilisateur_courant as dependance_utilisateur
from src.modules.logistique import routes, schemas, service
from src.noyau.exceptions import ErreurAuthentification


class Resultat:
    """Résultat d'`execute` : juste ce que la route consomme."""

    def __init__(self, element=None):
        self._element = element

    def scalar_one_or_none(self):
        return self._element

    def scalars(self):
        return self

    def all(self):
        return [self._element] if self._element is not None else []


class SessionFactice:
    """Session minimale : recherche par ``id_local``, commit/rollback comptés."""

    def __init__(self, *, existant=None, gagnant=None, ticket=None):
        self.existant = existant
        self.gagnant = gagnant
        self.ticket = ticket
        self.commits = 0
        self.rollbacks = 0

    async def execute(self, requete):
        # La route interroge ``colis`` ; l'enrichissement demande les étiquettes
        # ``bagage`` (aucune dans ce test).
        if "from bagage" in str(requete).lower():
            return Resultat(None)
        return Resultat(self.existant)

    async def scalar(self, requete):
        # Après un rollback (collision d'idempotence), la route relit le colis
        # gagnant ; sinon c'est la recherche de ticket qui répond None.
        if self.rollbacks and self.gagnant is not None:
            return self.gagnant
        return None

    async def get(self, modele, identifiant):
        if modele is Ticket and self.ticket is not None:
            return self.ticket
        return None

    async def commit(self):
        self.commits += 1

    async def rollback(self):
        self.rollbacks += 1


def _utilisateur() -> Utilisateur:
    utilisateur = Utilisateur()
    utilisateur.id = uuid.uuid4()
    utilisateur.role = "receveur"
    return utilisateur


def _colis(id_local: str | None, utilisateur: Utilisateur) -> Colis:
    colis = Colis(
        id_local=id_local,
        expediteur_id=utilisateur.id,
        enregistre_par_id=utilisateur.id,
        expediteur_nom="Expéditeur",
        destinataire_nom="Destinataire",
        destinataire_tel="+2290197123456",
        nombre_bagages=1,
        gare_depart_id=uuid.uuid4(),
        gare_arrivee_id=uuid.uuid4(),
        statut="enregistre",
        mode_enregistrement="guichet",
    )
    colis.id = uuid.uuid4()
    return colis


def _ticket() -> Ticket:
    ticket = Ticket(
        code_clair="DK-2024-000001",
        qr_token="jeton-de-test",
        type="COLIS",
        statut="emis",
    )
    ticket.id = uuid.uuid4()
    return ticket


def _element(id_local: str, gare_depart_id, gare_arrivee_id) -> schemas.ColisHorsLigne:
    return schemas.ColisHorsLigne(
        id_local=id_local,
        destinataire_nom="Awa",
        destinataire_tel="0197123456",
        gare_depart_id=gare_depart_id,
        gare_arrivee_id=gare_arrivee_id,
    )


class TestSynchroniserColisHorsLigne:
    def test_id_local_est_transmis_au_service(self, monkeypatch):
        """La clé d'idempotence part avec le colis, pas après le commit."""
        utilisateur = _utilisateur()
        recus: list[str | None] = []

        async def faux_creer_colis(session, charge, utilisateur, id_local=None):
            recus.append(id_local)
            colis = _colis(id_local, utilisateur)
            colis.ticket_id = None
            return colis, _ticket()

        monkeypatch.setattr(service, "creer_colis", faux_creer_colis)

        session = SessionFactice()
        depart, arrivee = uuid.uuid4(), uuid.uuid4()
        resultats = asyncio.run(
            routes.synchroniser_colis_hors_ligne(
                donnees=[_element("poste-0001", depart, arrivee)],
                utilisateur_courant=utilisateur,
                session=session,
            )
        )

        assert recus == ["poste-0001"]
        # Plus aucune affectation/commit après coup : tout se joue dans le service.
        assert session.commits == 0
        assert resultats[0]["colis"].id_local == "poste-0001"

    def test_colis_deja_synchronise_n_est_pas_recree(self, monkeypatch):
        """Rejouer la file deux fois ne crée pas de doublon."""
        utilisateur = _utilisateur()
        existant = _colis("poste-0002", utilisateur)
        ticket = _ticket()
        existant.ticket_id = ticket.id
        session = SessionFactice(existant=existant, ticket=ticket)

        async def faux_creer_colis(*args, **kwargs):  # pragma: no cover
            raise AssertionError("aucune création ne doit avoir lieu")

        monkeypatch.setattr(service, "creer_colis", faux_creer_colis)

        resultats = asyncio.run(
            routes.synchroniser_colis_hors_ligne(
                donnees=[_element("poste-0002", uuid.uuid4(), uuid.uuid4())],
                utilisateur_courant=utilisateur,
                session=session,
            )
        )

        assert resultats[0]["colis"] is existant
        assert resultats[0]["ticket"] is ticket

    def test_collision_concurrente_renvoie_le_colis_gagnant(self, monkeypatch):
        """Deux rejeux simultanés : l'index UNIQUE tranche, on renvoie le gagnant."""
        utilisateur = _utilisateur()
        gagnant = _colis("poste-0003", utilisateur)
        ticket = _ticket()
        gagnant.ticket_id = ticket.id
        session = SessionFactice(gagnant=gagnant, ticket=ticket)

        async def faux_creer_colis(*args, **kwargs):
            raise IntegrityError("INSERT INTO colis", {}, Exception("uq_colis_id_local"))

        monkeypatch.setattr(service, "creer_colis", faux_creer_colis)

        resultats = asyncio.run(
            routes.synchroniser_colis_hors_ligne(
                donnees=[_element("poste-0003", uuid.uuid4(), uuid.uuid4())],
                utilisateur_courant=utilisateur,
                session=session,
            )
        )

        assert session.rollbacks == 1
        assert resultats[0]["colis"] is gagnant
        assert resultats[0]["ticket"] is ticket


class TestAuthentificationDeLaRoute:
    """Ce que le client doit comprendre d'un refus de la route de synchro."""

    def test_sans_jeton_bearer_repond_auth_001(self):
        """Sans en-tête `Authorization` : 401 AUTH_001, jamais 403.

        C'est le cas d'un poste dont le cookie d'accès (15 min) a expiré
        pendant la coupure : le client doit renouveler le jeton, pas
déconnecter l'agent.
        """
        with pytest.raises(ErreurAuthentification) as erreur:
            asyncio.run(dependance_utilisateur(credentials=None, session=None))

        assert erreur.value.code_http == 401
        assert erreur.value.code_erreur == "AUTH_001"

    def test_role_sans_permission_est_refuse(self):
        """Un compte sans `logistique.colis.creer` ne synchronise pas."""
        citoyen = _utilisateur()
        citoyen.role = "citoyen"

        with pytest.raises(HTTPException) as erreur:
            asyncio.run(
                routes.synchroniser_colis_hors_ligne(
                    donnees=[_element("poste-0004", uuid.uuid4(), uuid.uuid4())],
                    utilisateur_courant=citoyen,
                    session=SessionFactice(),
                )
            )

        assert erreur.value.status_code == 403
