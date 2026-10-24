# -*- coding: utf-8 -*-
"""Vérification visuelle : pas de document d'identité → pas de validation.

Règle métier : comparer un selfie suppose une **photo de référence** issue d'un
titre d'identité (CNI, passeport, permis, carte de séjour, carte consulaire).
Sans ce document, il n'y a rien à comparer : le selfie doit être **rejeté** et
l'utilisateur renvoyé vers la page des documents — auparavant il était approuvé
tel quel, ce qui validait un visage sans aucune preuve d'identité.
"""
import asyncio
import uuid

from src.modeles import Utilisateur
from src.modules.verification_visuelle import photo_document, service


class SessionFactice:
    """Session minimale : la vérification est ajoutée puis committée."""

    def __init__(self):
        self.ajoutes: list = []
        self.commits = 0

    def add(self, objet):
        self.ajoutes.append(objet)

    async def commit(self):
        self.commits += 1

    async def refresh(self, objet):
        if getattr(objet, "id", None) is None:
            objet.id = uuid.uuid4()


class FichierFactice:
    filename = "selfie.jpg"
    content_type = "image/jpeg"


def _utilisateur() -> Utilisateur:
    utilisateur = Utilisateur()
    utilisateur.id = uuid.uuid4()
    utilisateur.role = "citoyen"
    utilisateur.est_visage_verifie = False
    return utilisateur


def _neutraliser_biometrie(monkeypatch, *, references):
    """Court-circuite détection/anti-spoofing/embedding et les références."""

    async def lire_image(fichier):
        return b"image-selfie"

    async def sans_doublon(session, embedding, utilisateur_id):
        return []

    async def charger_references(session, utilisateur_id):
        return references

    monkeypatch.setattr(service, "_lire_image", lire_image)
    monkeypatch.setattr(service, "_chercher_doublons", sans_doublon)
    monkeypatch.setattr(
        service.detection_visage, "detecter_visage", lambda contenu: (True, [(0, 0, 10, 10)])
    )
    monkeypatch.setattr(
        service.anti_spoofing, "evaluer_anti_spoofing", lambda contenu: (0.9, "vivant")
    )
    monkeypatch.setattr(
        service.embedding_facial, "generer_embedding", lambda contenu: [0.01] * 8
    )
    monkeypatch.setattr(photo_document, "charger_references_faciales", charger_references)


def test_sans_document_le_selfie_est_rejete(monkeypatch):
    """Aucune référence faciale → rejet + action « ajouter un document »."""
    _neutraliser_biometrie(monkeypatch, references=[])
    utilisateur = _utilisateur()
    session = SessionFactice()

    verification = asyncio.run(
        service.traiter_upload_photo(
            session=session, utilisateur=utilisateur, fichier=FichierFactice()
        )
    )

    assert verification.statut == "rejete"
    assert verification.date_verification is None
    assert verification.details["action_requise"] == "ajouter_document_identite"
    assert verification.details["document_correspondant"] is None
    # Le profil ne doit surtout pas être marqué « visage vérifié ».
    assert not utilisateur.est_visage_verifie
    assert getattr(utilisateur, "empreinte_faciale", None) is None


def test_avec_document_correspondant_le_selfie_est_approuve(monkeypatch):
    """Référence présente et similaire → approuvé (la règle n'a pas bougé)."""
    _neutraliser_biometrie(
        monkeypatch, references=[("cni", [0.01] * 8)]
    )
    utilisateur = _utilisateur()

    verification = asyncio.run(
        service.traiter_upload_photo(
            session=SessionFactice(), utilisateur=utilisateur, fichier=FichierFactice()
        )
    )

    assert verification.statut == "approuve"
    assert verification.details["action_requise"] is None
    assert verification.details["document_correspondant"] == "cni"
    assert utilisateur.est_visage_verifie is True
