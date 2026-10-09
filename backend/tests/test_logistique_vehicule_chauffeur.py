# -*- coding: utf-8 -*-
"""Tests « un car appartient à un chauffeur » (service logistique).

Comme `test_logistique_voyage.py`, ces tests vérifient la **logique métier** sans
base de données : une session factice rend les objets préparés et l'on prouve les
garde-fous — pas le SQL. Ce qui est verrouillé ici :

  * le guichet affecte un car à un chauffeur (et peut le retirer) ;
  * on ne confie pas un car à un compte qui n'est pas chauffeur ;
  * un chauffeur ne voit — et ne peut engager — que ses cars : ceux qui lui sont
    affectés, plus celui dont il a déclaré la plaque dans son dossier pro ;
  * une plaque libre (flotte inscrite par le super-admin) revient au chauffeur
    qui la déclare, mais une plaque déjà affectée ne se prend pas.
"""
import asyncio
import uuid

import pytest
from fastapi import HTTPException

from src.modeles import ActeurLogistique, ProfilLogistique, Utilisateur, Vehicule
from src.modules.logistique import schemas, service


class ResultatFactice:
    def __init__(self, elements):
        self._elements = elements

    def scalars(self):
        return self

    def all(self):
        return list(self._elements)


class SessionFactice:
    """Session minimale : on prépare les objets, `scalar`/`execute` les rendent."""

    def __init__(
        self,
        *,
        utilisateurs=(),
        acteurs=(),
        profils=(),
        vehicules=(),
        gares=(),
    ):
        self.utilisateurs = {u.id: u for u in utilisateurs}
        self.acteurs = list(acteurs)
        self.profils = list(profils)
        self.vehicules = list(vehicules)
        self.gares = {g.id: g for g in gares}
        self.commits = 0
        self.ajoutes = []

    # ─── API de session utilisée par le service ───
    async def get(self, modele, identifiant):
        if modele is Utilisateur:
            return self.utilisateurs.get(identifiant)
        if modele is Vehicule:
            return next((v for v in self.vehicules if v.id == identifiant), None)
        if modele is ActeurLogistique:
            return next((a for a in self.acteurs if a.id == identifiant), None)
        return self.gares.get(identifiant)

    async def scalar(self, requete):
        """Rend le premier objet préparé du type interrogé (NULL si aucun)."""
        entite = requete.column_descriptions[0]["entity"]
        for liste in (self.acteurs, self.profils, self.vehicules):
            if liste and isinstance(liste[0], entite):
                return liste[0]
        return None

    async def execute(self, requete):
        entite = requete.column_descriptions[0]["entity"]
        for liste in (self.vehicules, self.profils):
            if liste and isinstance(liste[0], entite):
                return ResultatFactice(liste)
        return ResultatFactice([])

    def add(self, obj):
        self.ajoutes.append(obj)

    async def commit(self):
        self.commits += 1

    async def refresh(self, obj):
        return obj


# ─── Fabriques ───────────────────────────────────────────────────────

def _utilisateur(prenom: str = "Moussa", nom: str = "Diop") -> Utilisateur:
    utilisateur = Utilisateur()
    utilisateur.id = uuid.uuid4()
    utilisateur.prenom_chiffre = None
    utilisateur.nom_chiffre = None
    utilisateur.digiid_public = f"DK-{nom.upper()}-0001"
    utilisateur.role = "chauffeur"
    return utilisateur


def _vehicule(immatriculation: str, chauffeur_id: uuid.UUID | None = None) -> Vehicule:
    vehicule = Vehicule(immatriculation=immatriculation)
    vehicule.id = uuid.uuid4()
    vehicule.chauffeur_id = chauffeur_id
    vehicule.actif = True
    return vehicule


def _acteur_chauffeur(utilisateur_id: uuid.UUID) -> ActeurLogistique:
    acteur = ActeurLogistique(utilisateur_id=utilisateur_id, role="chauffeur")
    acteur.id = uuid.uuid4()
    acteur.actif = True
    return acteur


def _profil_chauffeur(utilisateur_id: uuid.UUID, plaque: str | None) -> ProfilLogistique:
    profil = ProfilLogistique(utilisateur_id=utilisateur_id, type_profil="chauffeur")
    profil.id = uuid.uuid4()
    profil.vehicule_immatriculation = plaque
    return profil


def _creer(immatriculation: str, chauffeur_impose: uuid.UUID | None = None, **session):
    donnees = schemas.VehiculeCreate(immatriculation=immatriculation)
    return asyncio.run(
        service.creer_vehicule(
            SessionFactice(**session), donnees, chauffeur_impose=chauffeur_impose
        )
    )


# ─── Le guichet affecte (et retire) un car ───────────────────────────

class TestAffectationCar:
    def test_affecter_un_car_a_un_chauffeur(self):
        chauffeur = _utilisateur()
        car = _vehicule("AB-1234-XX")
        session = SessionFactice(
            utilisateurs=[chauffeur],
            acteurs=[_acteur_chauffeur(chauffeur.id)],
            vehicules=[car],
        )

        resultat = asyncio.run(service.affecter_vehicule(session, car.id, chauffeur.id))

        assert resultat.chauffeur_id == chauffeur.id
        assert session.commits == 1

    def test_retirer_un_car_le_laisse_au_referentiel(self):
        """Retirer un chauffeur ne supprime pas le car : il redevient à affecter."""
        chauffeur = _utilisateur()
        car = _vehicule("AB-1234-XX", chauffeur_id=chauffeur.id)
        session = SessionFactice(utilisateurs=[chauffeur], vehicules=[car])

        resultat = asyncio.run(service.affecter_vehicule(session, car.id, None))

        assert resultat.chauffeur_id is None
        assert car in session.vehicules

    def test_refuse_un_compte_qui_n_est_pas_chauffeur(self):
        """Un car se confie à quelqu'un qui conduit : le compte doit être reconnu."""
        inconnu = _utilisateur("Alice", "Martin")
        car = _vehicule("AB-1234-XX")
        session = SessionFactice(utilisateurs=[inconnu], vehicules=[car])

        with pytest.raises(HTTPException) as erreur:
            asyncio.run(service.affecter_vehicule(session, car.id, inconnu.id))

        assert erreur.value.status_code == 400
        assert "pas reconnu comme chauffeur" in erreur.value.detail

    def test_car_introuvable(self):
        chauffeur = _utilisateur()
        session = SessionFactice(utilisateurs=[chauffeur])

        with pytest.raises(HTTPException) as erreur:
            asyncio.run(service.affecter_vehicule(session, uuid.uuid4(), chauffeur.id))

        assert erreur.value.status_code == 404


# ─── Ce qu'un chauffeur voit (et peut engager) ───────────────────────

class TestCarsDuChauffeur:
    def _session(self):
        moussa = _utilisateur("Moussa", "Diop")
        autre = _utilisateur("Ali", "Traoré")
        mon_car = _vehicule("AB-1234-XX", chauffeur_id=moussa.id)
        car_declare = _vehicule("CD 5678 YY")
        car_du_collegue = _vehicule("EF-9012-ZZ", chauffeur_id=autre.id)
        session = SessionFactice(
            utilisateurs=[moussa, autre],
            acteurs=[_acteur_chauffeur(moussa.id), _acteur_chauffeur(autre.id)],
            profils=[_profil_chauffeur(moussa.id, "cd5678yy")],
            vehicules=[mon_car, car_declare, car_du_collegue],
        )
        return session, moussa, mon_car, car_declare, car_du_collegue

    def test_ne_voit_que_ses_cars(self):
        """Le car affecté + celui dont la plaque est déclarée, jamais celui d'un autre."""
        session, moussa, mon_car, car_declare, car_du_collegue = self._session()

        cars = asyncio.run(
            service.vehicules_autorises_pour_chauffeur(session, moussa.id)
        )

        assert [c.immatriculation for c in cars] == [
            mon_car.immatriculation,
            car_declare.immatriculation,
        ]
        assert car_du_collegue not in cars

    def test_plaque_declaree_avec_tirets_ou_espaces(self):
        """« CD 5678 YY » déclarée « cd5678yy » : c'est bien le même car."""
        session, moussa, _, car_declare, _ = self._session()

        assert service.normaliser_immatriculation("cd-5678 yy") == "CD5678YY"
        assert car_declare in asyncio.run(
            service.vehicules_autorises_pour_chauffeur(session, moussa.id)
        )

    def test_planifier_avec_le_car_d_un_collegue_est_refuse(self):
        """Appel direct compris : on ne conduit pas le car d'un collègue."""
        session, moussa, _, _, car_du_collegue = self._session()

        with pytest.raises(HTTPException) as erreur:
            asyncio.run(
                service.verifier_vehicule_du_chauffeur(
                    session, car_du_collegue.id, moussa.id
                )
            )

        assert erreur.value.status_code == 403
        assert "ne vous est pas affecté" in erreur.value.detail

    def test_ses_propres_cars_passent_le_garde_fou(self):
        session, moussa, mon_car, _, _ = self._session()

        verifie = asyncio.run(
            service.verifier_vehicule_du_chauffeur(session, mon_car.id, moussa.id)
        )

        assert verifie.id == mon_car.id


# ─── Le chauffeur déclare sa plaque (flotte inscrite par le super-admin) ──

class TestPlaqueDeclareeParLeChauffeur:
    def test_plaque_libre_devient_la_sienne(self):
        """Le super-admin a inscrit la flotte sans savoir qui conduit : le chauffeur récupère son car."""
        chauffeur = _utilisateur()
        car = _vehicule("AB-1234-XX")
        session = SessionFactice(
            utilisateurs=[chauffeur],
            acteurs=[_acteur_chauffeur(chauffeur.id)],
            vehicules=[car],
        )

        resultat = asyncio.run(
            service.creer_vehicule(
                session,
                schemas.VehiculeCreate(immatriculation="AB-1234-XX"),
                chauffeur_impose=chauffeur.id,
            )
        )

        assert resultat.chauffeur_id == chauffeur.id
        assert session.commits == 1

    def test_plaque_deja_affectee_ne_se_prend_pas(self):
        """Si le car est déjà à un collègue, on refuse : un car ne se vole pas."""
        chauffeur = _utilisateur("Moussa", "Diop")
        autre = _utilisateur("Ali", "Traoré")
        car = _vehicule("AB-1234-XX", chauffeur_id=autre.id)
        session = SessionFactice(
            utilisateurs=[chauffeur, autre],
            acteurs=[_acteur_chauffeur(chauffeur.id)],
            vehicules=[car],
        )

        with pytest.raises(HTTPException) as erreur:
            asyncio.run(
                service.creer_vehicule(
                    session,
                    schemas.VehiculeCreate(immatriculation="AB-1234-XX"),
                    chauffeur_impose=chauffeur.id,
                )
            )

        assert erreur.value.status_code == 403
        assert "déjà affecté à un autre chauffeur" in erreur.value.detail

    def test_redeclarer_sa_propre_plaque_est_idempotent(self):
        """Le chauffeur qui enregistre deux fois sa plaque (double clic) n'a pas d'erreur."""
        chauffeur = _utilisateur()
        car = _vehicule("AB-1234-XX", chauffeur_id=chauffeur.id)
        session = SessionFactice(
            utilisateurs=[chauffeur],
            acteurs=[_acteur_chauffeur(chauffeur.id)],
            vehicules=[car],
        )

        resultat = asyncio.run(
            service.creer_vehicule(
                session,
                schemas.VehiculeCreate(immatriculation="AB-1234-XX"),
                chauffeur_impose=chauffeur.id,
            )
        )

        assert resultat.id == car.id
        assert session.commits == 0

    def test_le_guichet_affecte_a_l_enregistrement(self):
        """Gérant de gare / receveur : il désigne le chauffeur sans attendre personne."""
        chauffeur = _utilisateur()
        session = SessionFactice(
            utilisateurs=[chauffeur],
            acteurs=[_acteur_chauffeur(chauffeur.id)],
        )

        resultat = asyncio.run(
            service.creer_vehicule(
                session,
                schemas.VehiculeCreate(
                    immatriculation="AB-1234-XX", chauffeur_id=chauffeur.id
                ),
            )
        )

        assert resultat.chauffeur_id == chauffeur.id

    def test_un_car_peut_etre_enregistre_sans_chauffeur(self):
        """Cas réel : le car se présente, le chauffeur sera désigné plus tard."""
        session = SessionFactice()

        resultat = asyncio.run(
            service.creer_vehicule(
                session, schemas.VehiculeCreate(immatriculation="AB-1234-XX")
            )
        )

        assert resultat.chauffeur_id is None
        assert session.ajoutes  # le car est bien inscrit au référentiel
