# -*- coding: utf-8 -*-
"""Vérification manuelle des règles « rejoindre / quitter un voyage ».

Pytest n'est pas installé dans cet environnement : ce script joue les mêmes
scénarios avec de simples `assert`, afin de valider la logique métier dès
maintenant (et sans base de données). À terme, `tests/test_logistique_voyage.py`
prend le relais dans la suite de tests.

Usage (depuis ``backend``) :
    .venv\\Scripts\\python.exe scripts\\verifier_voyage_chauffeur.py
"""
import asyncio
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException  # noqa: E402

from src.modeles import Utilisateur, Voyage  # noqa: E402
from src.modules.logistique import service  # noqa: E402
from src.noyau import chiffrer_donnee  # noqa: E402


class SessionFactice:
    def __init__(self, objets=None):
        self.objets = objets or {}
        self.commits = 0

    async def get(self, modele, identifiant):
        return self.objets.get((modele, identifiant))

    async def commit(self):
        self.commits += 1

    async def refresh(self, obj):
        return obj


def voyage(statut="planifie", chauffeur_id=None):
    v = Voyage(
        ligne_id=uuid.uuid4(),
        vehicule_id=uuid.uuid4(),
        date_depart=datetime.now(timezone.utc),
        statut=statut,
    )
    v.id = uuid.uuid4()
    v.chauffeur_id = chauffeur_id
    return v


def utilisateur(prenom, nom):
    u = Utilisateur()
    u.id = uuid.uuid4()
    u.prenom_chiffre = chiffrer_donnee(prenom)
    u.nom_chiffre = chiffrer_donnee(nom)
    u.digiid_public = f"DK-{nom.upper()}-0001"
    return u


def attendre_conflit(coroutine, extrait):
    try:
        asyncio.run(coroutine)
    except HTTPException as erreur:
        assert erreur.status_code == 409, f"statut attendu 409, reçu {erreur.status_code}"
        assert extrait in erreur.detail, f"« {extrait} » absent de : {erreur.detail}"
        return
    raise AssertionError("Aucune erreur levée alors qu'un refus était attendu")


def main() -> None:
    # 1. Un départ libre est attribué au chauffeur volontaire.
    v = voyage()
    session = SessionFactice({(Voyage, v.id): v})
    chauffeur = uuid.uuid4()
    resultat = asyncio.run(
        service.rejoindre_voyage(session, voyage_id=v.id, chauffeur_id=chauffeur)
    )
    assert resultat.chauffeur_id == chauffeur
    assert session.commits == 1
    print("OK  départ libre attribué")

    # 2. Le même chauffeur qui reclique ne crée pas de doublon.
    session = SessionFactice({(Voyage, v.id): v})
    resultat = asyncio.run(
        service.rejoindre_voyage(session, voyage_id=v.id, chauffeur_id=chauffeur)
    )
    assert resultat.chauffeur_id == chauffeur and session.commits == 0
    print("OK  double clic idempotent")

    # 3. Un car déjà parti ne se rejoint plus.
    parti = voyage(statut="en_cours")
    attendre_conflit(
        service.rejoindre_voyage(
            SessionFactice({(Voyage, parti.id): parti}),
            voyage_id=parti.id,
            chauffeur_id=uuid.uuid4(),
        ),
        "en_cours",
    )
    print("OK  voyage parti refusé")

    # 4. Un car déjà engagé cite le nom du collègue (déchiffré).
    autre = utilisateur("Moussa", "Diop")
    engage = voyage(chauffeur_id=autre.id)
    attendre_conflit(
        service.rejoindre_voyage(
            SessionFactice({(Voyage, engage.id): engage, (Utilisateur, autre.id): autre}),
            voyage_id=engage.id,
            chauffeur_id=uuid.uuid4(),
        ),
        "Moussa Diop",
    )
    print("OK  car engagé refusé avec le nom du chauffeur")

    # 5. Le chauffeur se retire avant le départ.
    mien = voyage(chauffeur_id=chauffeur)
    session = SessionFactice({(Voyage, mien.id): mien})
    resultat = asyncio.run(
        service.quitter_voyage(session, voyage_id=mien.id, chauffeur_id=chauffeur)
    )
    assert resultat.chauffeur_id is None and session.commits == 1
    print("OK  retrait avant départ")

    # 6. On ne retire pas le car d'un collègue.
    attendre_conflit(
        service.quitter_voyage(
            SessionFactice({(Voyage, engage.id): engage}),
            voyage_id=engage.id,
            chauffeur_id=uuid.uuid4(),
        ),
        "pas le chauffeur",
    )
    print("OK  retrait d'un car d'autrui refusé")

    # 7. Pas de retrait une fois le car parti (même par son propre chauffeur).
    parti_mien = voyage(statut="en_cours", chauffeur_id=chauffeur)
    attendre_conflit(
        service.quitter_voyage(
            SessionFactice({(Voyage, parti_mien.id): parti_mien}),
            voyage_id=parti_mien.id,
            chauffeur_id=chauffeur,
        ),
        "déjà commencé",
    )
    print("OK  retrait après départ refusé")

    print("\nToutes les règles « choisir mes voyages » sont respectées.")


if __name__ == "__main__":
    main()
