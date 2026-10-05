# -*- coding: utf-8 -*-
"""
Tarification des frais de service colis (Plan B — S6).

Deux montants **distincts** sont manipulés :

- le **prix du transport** du colis (``colis.frais_fcfa``) : saisi — ou pas — au
  guichet, c'est le revenu du transporteur. **DigiID ne l'encaisse jamais** ;
- le **frais de service DigiID**, payé par le client, barème **dégressif** selon
  le nombre de colis que ce client suit :

  | Colis suivis (mois en cours) | Frais/colis | dont receveur | dont DigiID |
  |------------------------------|-------------|---------------|-------------|
  | 1 à 3                        | 100 FCFA    | 25 FCFA       | 75 FCFA     |
  | 4 à 7                        | 75 FCFA     | 25 FCFA       | 50 FCFA     |
  | 8 et plus                    | 50 FCFA     | 25 FCFA       | 25 FCFA     |

Le barème est **configurable** (``PALIER_FRAIS_SERVICE_COLIS`` dans le ``.env``) :
il suffit d'y écrire ``1:100,4:75,8:50``. Ce module ne contient donc aucune
valeur métier en dur : il lit les paliers de la configuration et se contente de
les appliquer.

Le frais n'est prélevé **qu'une seule fois par colis** : c'est le service
paiement qui l'impose (contrôle applicatif + index unique partiel en base).
"""
from dataclasses import dataclass

from src.config import parametres


@dataclass(frozen=True)
class FraisService:
    """Frais de service d'un colis et sa répartition."""

    nb_colis_suivis: int
    frais_fcfa: int
    part_receveur_fcfa: int
    part_plateforme_fcfa: int

    def as_dict(self) -> dict:
        return {
            "nb_colis_suivis": self.nb_colis_suivis,
            "frais_fcfa": self.frais_fcfa,
            "part_receveur_fcfa": self.part_receveur_fcfa,
            "part_plateforme_fcfa": self.part_plateforme_fcfa,
        }


def _paliers() -> tuple[tuple[int, int], ...]:
    return parametres.paliers_frais_service_colis


def palier_pour(nb_colis_suivis: int) -> tuple[int, int]:
    """
    Palier applicable : ``(nb_colis_min, frais_fcfa)``.

    ``nb_colis_suivis`` est le rang du colis (1 pour le premier colis du client,
    4 pour le quatrième…).
    """
    rang = max(int(nb_colis_suivis), 1)
    retenu = _paliers()[0]
    for seuil, prix in _paliers():
        if rang >= seuil:
            retenu = (seuil, prix)
        else:
            break
    return retenu


def frais_service(nb_colis_suivis: int) -> FraisService:
    """
    Calcule le frais de service du colis de rang ``nb_colis_suivis``.

    La part receveur est **constante** : c'est l'incitation du guichet, elle ne
    baisse pas avec le volume. Notre part absorbe donc la remise commerciale.
    """
    rang = max(int(nb_colis_suivis), 1)
    _, frais = palier_pour(rang)
    part_receveur = min(max(int(parametres.part_receveur_colis_fcfa), 0), frais)
    return FraisService(
        nb_colis_suivis=rang,
        frais_fcfa=frais,
        part_receveur_fcfa=part_receveur,
        part_plateforme_fcfa=frais - part_receveur,
    )


def prochain_palier(nb_colis_suivis: int) -> tuple[int, int] | None:
    """
    Palier suivant, pour informer le guichet (« dès le 4e colis : 75 F »).

    Retourne ``(nb_colis_min, frais_fcfa)`` ou ``None`` si déjà au dernier palier.
    """
    rang = max(int(nb_colis_suivis), 1)
    seuil_actuel, _ = palier_pour(rang)
    for seuil, prix in _paliers():
        if seuil > seuil_actuel:
            return seuil, prix
    return None


def bareme() -> list[dict]:
    """Barème complet (affichage côté guichet / documentation)."""
    return [
        {
            "nb_colis_min": seuil,
            "frais_fcfa": prix,
            "part_receveur_fcfa": min(
                max(int(parametres.part_receveur_colis_fcfa), 0), prix
            ),
        }
        for seuil, prix in _paliers()
    ]
