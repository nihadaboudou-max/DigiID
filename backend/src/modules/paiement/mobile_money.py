# -*- coding: utf-8 -*-
"""
Abstraction « fournisseur de paiement » (S6).

Trois moyens de paiement pour le prototype :

- ``EspecesProvider`` : encaissement au guichet, **immédiat** (paiement réussi
  dès l'initiation, aucune dépendance réseau).
- ``MtnMomoProvider`` et ``MoovMoneyProvider`` : opérateurs mobiles béninois —
  **mode MOCK** (aucun appel réseau, aucune collecte réelle). En production,
  brancher les API opérateurs dans ``initier``.

Le reste du code (service, routes) ne dépend QUE de l'interface
``FournisseurPaiement`` : ajouter Orange Money revient à écrire
un nouvel adaptateur, sans toucher au cœur.
"""
from __future__ import annotations

import secrets
from dataclasses import dataclass


@dataclass
class ResultatInitiation:
    """Résultat d'une demande de paiement auprès d'un fournisseur."""
    statut: str                        # "reussi" | "en_attente" | "echoue"
    reference_externe: str | None      # référence côté opérateur
    instruction: str | None            # message à afficher à l'utilisateur


class FournisseurPaiement:
    """Interface commune à tous les moyens de paiement."""

    code: str = "?"
    libelle: str = "?"
    # True si le paiement est réussi immédiatement (pas d'attente de webhook).
    immediat: bool = False

    def initier(
        self, montant_fcfa: int, telephone: str | None, reference: str
    ) -> ResultatInitiation:
        raise NotImplementedError


class EspecesProvider(FournisseurPaiement):
    """Encaissement en espèces au guichet (fonctionne hors ligne)."""

    code = "especes"
    libelle = "Espèces (guichet)"
    immediat = True

    def initier(self, montant_fcfa, telephone, reference) -> ResultatInitiation:
        return ResultatInitiation(
            statut="reussi",
            reference_externe=f"ESP-{reference}",
            instruction="Espèces encaissées au guichet.",
        )


class MtnMomoProvider(FournisseurPaiement):
    """
    MTN MoMo — **mode MOCK**.

    Aucun appel réseau n'est fait : la transaction reste en attente, sans
    prélèvement réel. L'API MTN doit être intégrée avant toute mise en production.
    """

    code = "mtn"
    libelle = "MTN MoMo"
    immediat = False

    def initier(self, montant_fcfa, telephone, reference) -> ResultatInitiation:
        reference_externe = f"MTN-MOCK-{secrets.token_hex(4).upper()}"
        return ResultatInitiation(
            statut="en_attente",
            reference_externe=reference_externe,
            instruction=(
                f"Paiement MTN MoMo simulé pour {telephone or 'le numéro du payeur'} "
                f"({montant_fcfa} FCFA, réf. {reference_externe}). Aucun débit réel "
                "n'a été effectué : l'intégration MTN n'est pas encore activée."
            ),
        )


class MoovMoneyProvider(FournisseurPaiement):
    """Moov Money — mode MOCK, sans appel réseau ni débit réel."""

    code = "moov"
    libelle = "Moov Money"
    immediat = False

    def initier(self, montant_fcfa, telephone, reference) -> ResultatInitiation:
        reference_externe = f"MOOV-MOCK-{secrets.token_hex(4).upper()}"
        return ResultatInitiation(
            statut="en_attente",
            reference_externe=reference_externe,
            instruction=(
                f"Paiement Moov Money simulé pour {telephone or 'le numéro du payeur'} "
                f"({montant_fcfa} FCFA, réf. {reference_externe}). Aucun débit réel "
                "n'a été effectué : l'intégration Moov n'est pas encore activée."
            ),
        )


# Registre des fournisseurs disponibles
FOURNISSEURS: dict[str, FournisseurPaiement] = {
    EspecesProvider.code: EspecesProvider(),
    MtnMomoProvider.code: MtnMomoProvider(),
    MoovMoneyProvider.code: MoovMoneyProvider(),
}


class MoyenPaiementInconnu(ValueError):
    """Moyen de paiement non supporté."""


def obtenir_fournisseur(moyen: str) -> FournisseurPaiement:
    """Retourne l'adaptateur d'un moyen de paiement, sinon lève une erreur."""
    fournisseur = FOURNISSEURS.get((moyen or "").strip().lower())
    if fournisseur is None:
        raise MoyenPaiementInconnu(
            f"Moyen de paiement « {moyen} » non supporté "
            f"(disponibles : {', '.join(FOURNISSEURS)})"
        )
    return fournisseur


def lister_moyens() -> list[dict]:
    """Catalogue des moyens de paiement (pour l'UI)."""
    return [
        {"code": f.code, "libelle": f.libelle, "immediat": f.immediat}
        for f in FOURNISSEURS.values()
    ]
