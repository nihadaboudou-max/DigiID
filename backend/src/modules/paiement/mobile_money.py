# -*- coding: utf-8 -*-
"""
Abstraction « fournisseur de paiement » (S6).

Deux fournisseurs pour la démo :

- ``EspecesProvider`` : encaissement au guichet, **immédiat** (paiement réussi
  dès l'initiation, aucune dépendance réseau).
- ``WaveProvider`` : opérateur mobile money — **mode MOCK** en développement
  (aucun appel réseau, aucun secret). En production, brancher l'API réelle de
  Wave dans ``initier`` (les clés restent dans le .env, jamais en base).

Le reste du code (service, routes) ne dépend QUE de l'interface
``FournisseurPaiement`` : ajouter Orange Money / MTN / Moov revient à écrire
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


class WaveProvider(FournisseurPaiement):
    """
    Wave (mobile money) — **mode MOCK**.

    En développement, aucun appel réseau n'est fait : on renvoie une demande
    « en attente » que l'endpoint de confirmation simulera. Le passage en
    production consiste à implémenter l'appel réel ici (clé via .env).
    """

    code = "wave"
    libelle = "Wave (mobile money)"
    immediat = False

    def initier(self, montant_fcfa, telephone, reference) -> ResultatInitiation:
        reference_externe = f"WAVE-MOCK-{secrets.token_hex(4).upper()}"
        return ResultatInitiation(
            statut="en_attente",
            reference_externe=reference_externe,
            instruction=(
                f"Demande envoyée au {telephone or 'numéro du payeur'} (réf. "
                f"{reference_externe}). Le client valide {montant_fcfa} FCFA sur "
                f"son téléphone. Mode démo : la confirmation peut être simulée."
            ),
        )


# Registre des fournisseurs disponibles
FOURNISSEURS: dict[str, FournisseurPaiement] = {
    EspecesProvider.code: EspecesProvider(),
    WaveProvider.code: WaveProvider(),
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
