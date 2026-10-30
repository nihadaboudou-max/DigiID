# -*- coding: utf-8 -*-
"""Tests des garde-fous de planification et de départ des voyages."""
import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from src.modeles import Utilisateur, Voyage
from src.modules.logistique import service


class _ResultatVide:
    def __init__(self, elements=None):
        self.elements = elements or []

    def scalars(self):
        return self

    def all(self):
        return self.elements

    def first(self):
        return self.elements[0] if self.elements else None


class SessionFactice:
    """Session minimale pour vérifier la logique métier sans base de données."""

    def __init__(self, objets: dict | None = None, resultat_execute=None):
        self.objets = objets or {}
        self.resultat_execute = resultat_execute or _ResultatVide()
        self.commits = 0

    async def get(self, modele, identifiant):
        return self.objets.get((modele, identifiant))

    async def execute(self, requete):
        return self.resultat_execute

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
    from src.noyau import chiffrer_donnee

    utilisateur.prenom_chiffre = chiffrer_donnee(prenom)
    utilisateur.nom_chiffre = chiffrer_donnee(nom)
    utilisateur.digiid_public = f"DK-{nom.upper()}-0001"
    return utilisateur


class TestAnnulerEtCharge:
    """Annulation et actions groupées : garde-fous métier."""

    def test_creation_refuse_un_depart_deja_planifie_sur_la_meme_ligne(self):
        from src.modules.logistique import schemas
        from src.modeles import Ligne, Vehicule

        ligne_id = uuid.uuid4()
        vehicule_id = uuid.uuid4()
        depart = datetime.now(timezone.utc) + timedelta(days=1)
        voyage_existant = _voyage()
        voyage_existant.ligne_id = ligne_id
        voyage_existant.date_depart = depart
        session = SessionFactice(
            {
                (Ligne, ligne_id): Ligne(),
                (Vehicule, vehicule_id): object(),
            },
            resultat_execute=_ResultatVide([voyage_existant]),
        )

        with pytest.raises(HTTPException) as erreur:
            asyncio.run(
                service.creer_voyage(
                    session,
                    schemas.VoyageCreate(
                        ligne_id=ligne_id,
                        vehicule_id=vehicule_id,
                        date_depart=depart,
                    ),
                )
            )

        assert erreur.value.status_code == 409
        assert "déjà planifié" in erreur.value.detail.lower()
        assert session.commits == 0

    def test_annulation_refusee_si_en_cours(self):
        from src.modules.logistique import schemas

        voyage = _voyage(statut="en_cours")
        session = SessionFactice({(Voyage, voyage.id): voyage})

        with pytest.raises(HTTPException) as erreur:
            asyncio.run(
                service.modifier_voyage(
                    session,
                    voyage.id,
                    schemas.VoyageUpdate(statut="annule"),
                )
            )

        assert erreur.value.status_code == 409
        assert "annuler" in erreur.value.detail.lower()

    def test_depart_refuse_si_car_vide(self):
        voyage = _voyage(statut="planifie")
        session = SessionFactice({(Voyage, voyage.id): voyage})
        chauffeur = _utilisateur("Awa", "Fall")

        with pytest.raises(HTTPException) as erreur:
            asyncio.run(service.valider_depart_voyage(session, voyage.id, chauffeur))

        assert erreur.value.status_code == 409
        assert "aucun passager ni colis" in erreur.value.detail.lower()

    def test_depart_refuse_avant_le_jour_planifie(self):
        voyage = _voyage(statut="planifie")
        voyage.date_depart = datetime.now(timezone.utc) + timedelta(days=1)
        session = SessionFactice({(Voyage, voyage.id): voyage})
        chauffeur = _utilisateur("Awa", "Fall")

        with pytest.raises(HTTPException) as erreur:
            asyncio.run(service.valider_depart_voyage(session, voyage.id, chauffeur))

        assert erreur.value.status_code == 409
        assert "jour planifié" in erreur.value.detail.lower()
        assert session.commits == 0

    def test_depart_le_jour_planifie_poursuit_les_controles_existants(self):
        voyage = _voyage(statut="planifie")
        session = SessionFactice({(Voyage, voyage.id): voyage})
        chauffeur = _utilisateur("Awa", "Fall")

        with pytest.raises(HTTPException) as erreur:
            asyncio.run(service.valider_depart_voyage(session, voyage.id, chauffeur))

        assert erreur.value.status_code == 409
        assert "aucun passager ni colis" in erreur.value.detail.lower()