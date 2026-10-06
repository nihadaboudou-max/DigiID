# -*- coding: utf-8 -*-
"""Tests des règles « le chauffeur choisit son voyage » (service logistique).

Ces tests vérifient la **logique métier** sans base de données : on injecte une
session factice qui se contente de rendre les objets demandés. C'est exactement
ce qu'on veut prouver ici — les garde-fous, pas le SQL :

  * un départ libre peut être pris par un chauffeur ;
  * un car déjà attribué ne peut pas être « volé » (l'engagement est public) ;
  * un voyage déjà parti n'accepte plus personne ;
  * se retirer n'est possible qu'avant le départ, et par le chauffeur concerné.
"""
import asyncio
import uuid
from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from src.modeles import Utilisateur, Voyage
from src.modules.logistique import service


class SessionFactice:
    """Session minimale : `get` rend ce qu'on lui a préparé, commit/refresh no-op."""

    def __init__(self, objets: dict | None = None):
        self.objets = objets or {}
        self.commits = 0

    async def get(self, modele, identifiant):
        return self.objets.get((modele, identifiant))

    async def commit(self):
        self.commits += 1

    async def refresh(self, obj):
        return obj


def _voyage(statut: str = "planifie", chauffeur_id: uuid.UUID | None = None) -> Voyage:
    voyage = Voyage(
        ligne_id=uuid.uuid4(),
        vehicule_id=uuid.uuid4(),
        date_depart=datetime.now(timezone.utc),
        statut=statut,
    )
    voyage.id = uuid.uuid4()
    voyage.chauffeur_id = chauffeur_id
    return voyage


def _utilisateur(prenom: str, nom: str) -> Utilisateur:
    utilisateur = Utilisateur()
    utilisateur.id = uuid.uuid4()
    # Les noms sont chiffrés au repos : on stocke la version chiffrée, comme en base.
    from src.noyau import chiffrer_donnee

    utilisateur.prenom_chiffre = chiffrer_donnee(prenom)
    utilisateur.nom_chiffre = chiffrer_donnee(nom)
    utilisateur.digiid_public = f"DK-{nom.upper()}-0001"
    return utilisateur


def _rejoindre(session, voyage, chauffeur_id):
    return asyncio.run(
        service.rejoindre_voyage(
            session, voyage_id=voyage.id, chauffeur_id=chauffeur_id
        )
    )


class TestRejoindreVoyage:
    def test_depart_libre_est_attribue(self):
        """Cas nominal : le chauffeur prend un car sans chauffeur."""
        voyage = _voyage()
        session = SessionFactice({(Voyage, voyage.id): voyage})
        chauffeur_id = uuid.uuid4()

        resultat = _rejoindre(session, voyage, chauffeur_id)

        assert resultat.chauffeur_id == chauffeur_id
        assert session.commits == 1

    def test_deux_fois_le_meme_chauffeur_est_idempotent(self):
        """Double clic sur le téléphone : on ne doit pas lever d'erreur."""
        chauffeur_id = uuid.uuid4()
        voyage = _voyage(chauffeur_id=chauffeur_id)
        session = SessionFactice({(Voyage, voyage.id): voyage})

        resultat = _rejoindre(session, voyage, chauffeur_id)

        assert resultat.chauffeur_id == chauffeur_id
        assert session.commits == 0  # aucun nouvel engagement à enregistrer

    def test_voyage_deja_parti_refuse(self):
        """Un car en route ne se rejoint pas : on renvoie l'utilisateur au guichet."""
        voyage = _voyage(statut="en_cours")
        session = SessionFactice({(Voyage, voyage.id): voyage})

        with pytest.raises(HTTPException) as erreur:
            _rejoindre(session, voyage, uuid.uuid4())

        assert erreur.value.status_code == 409
        assert "en_cours" in erreur.value.detail

    def test_car_deja_engage_par_un_autre_refuse(self):
        """Le nom du chauffeur déjà engagé est cité : le voyageur sait à qui parler."""
        autre = _utilisateur("Moussa", "Diop")
        voyage = _voyage(chauffeur_id=autre.id)
        session = SessionFactice(
            {(Voyage, voyage.id): voyage, (Utilisateur, autre.id): autre}
        )

        with pytest.raises(HTTPException) as erreur:
            _rejoindre(session, voyage, uuid.uuid4())

        assert erreur.value.status_code == 409
        assert "Moussa Diop" in erreur.value.detail

    def test_voyage_introuvable(self):
        voyage = _voyage()
        session = SessionFactice()

        with pytest.raises(HTTPException) as erreur:
            _rejoindre(session, voyage, uuid.uuid4())

        assert erreur.value.status_code == 404


class TestQuitterVoyage:
    def _quitter(self, session, voyage, chauffeur_id):
        return asyncio.run(
            service.quitter_voyage(
                session, voyage_id=voyage.id, chauffeur_id=chauffeur_id
            )
        )

    def test_le_chauffeur_libere_son_car(self):
        """Se retirer avant le départ libère le car pour un collègue."""
        chauffeur_id = uuid.uuid4()
        voyage = _voyage(chauffeur_id=chauffeur_id)
        session = SessionFactice({(Voyage, voyage.id): voyage})

        resultat = self._quitter(session, voyage, chauffeur_id)

        assert resultat.chauffeur_id is None
        assert session.commits == 1

    def test_un_autre_chauffeur_ne_peut_pas_retirer(self):
        """On ne « débarque » pas le car d'un collègue à sa place."""
        voyage = _voyage(chauffeur_id=uuid.uuid4())
        session = SessionFactice({(Voyage, voyage.id): voyage})

        with pytest.raises(HTTPException) as erreur:
            self._quitter(session, voyage, uuid.uuid4())

        assert erreur.value.status_code == 409
        assert "pas le chauffeur" in erreur.value.detail

    def test_pas_de_retrait_apres_le_depart(self):
        """Colis et passagers sont à bord : le chauffeur termine son voyage."""
        chauffeur_id = uuid.uuid4()
        voyage = _voyage(statut="en_cours", chauffeur_id=chauffeur_id)
        session = SessionFactice({(Voyage, voyage.id): voyage})

        with pytest.raises(HTTPException) as erreur:
            self._quitter(session, voyage, chauffeur_id)

        assert erreur.value.status_code == 409
        assert "déjà commencé" in erreur.value.detail
