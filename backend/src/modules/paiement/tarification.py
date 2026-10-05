# -*- coding: utf-8 -*-
"""
Tarification des frais de service colis (Plan B — S6).

Deux montants **distincts** sont manipulés :

- le **prix du transport** du colis (``colis.frais_fcfa``) : saisi — ou pas — au
  guichet, c'est le revenu du transporteur. **DigiID ne l'encaisse jamais** ;
- le **frais de service DigiID**, payé par le client, calculé selon le **nombre
  d'articles** contenus dans le colis (et non plus selon un décompte mensuel
  cumulatif de colis suivis) :

  | Articles dans le colis | Frais/colis | dont receveur | dont DigiID |
  |------------------------|-------------|---------------|-------------|
  | 1 à 3                  | 100 FCFA    | 25 FCFA       | 75 FCFA     |
  | 4 à 6                  | 200 FCFA    | 50 FCFA       | 150 FCFA    |
  | 7 à 10                 | 350 FCFA    | 80 FCFA       | 270 FCFA    |
  | plus de 10             | 500 FCFA    | 150 FCFA      | 350 FCFA    |

La **commission du receveur** est elle aussi progressive (25 / 50 / 80 / 150) :
plus le colis contient d'articles, plus sa rétribution augmente.

Le barème est **configurable** (``BAREME_FRAIS_SERVICE_COLIS`` dans le ``.env``)
sous la forme ``min-max:frais:commission`` (paliers séparés par des virgules ;
une borne max vide ou suffixée « + » désigne un palier ouvert). Ce module ne
contient donc aucune valeur métier « en dur » : il lit les paliers de la
configuration et se contente de les appliquer.

Le frais n'est prélevé **qu'une seule fois par colis** : c'est le service
paiement qui l'impose (contrôle applicatif + index unique partiel en base).

**Tarification fixe passager/enfant (P0 ajusté)** : le service de traçabilité et
de suivi familial est facturé **strictement 100 FCFA par passager/enfant**, quel
que soit le nombre de bagages transportés (le nombre de sacs sert uniquement à
la traçabilité et à la vérification anti-fraude à l'arrivée).
"""
from dataclasses import dataclass

from src.config import parametres


@dataclass(frozen=True)
class FraisService:
    """Frais de service d'un colis et sa répartition."""

    nombre_articles: int
    frais_fcfa: int
    part_receveur_fcfa: int
    part_plateforme_fcfa: int

    def as_dict(self) -> dict:
        return {
            "nombre_articles": self.nombre_articles,
            "frais_fcfa": self.frais_fcfa,
            "part_receveur_fcfa": self.part_receveur_fcfa,
            "part_plateforme_fcfa": self.part_plateforme_fcfa,
        }


def _paliers() -> tuple[tuple[int, int | None, int, int], ...]:
    return parametres.paliers_frais_service_colis


def palier_pour(nombre_articles: int) -> tuple[int, int | None, int, int]:
    """
    Palier applicable : ``(nb_articles_min, nb_articles_max, frais, commission)``.

    ``nb_articles_max`` vaut ``None`` pour le dernier palier (« plus de 10 »).
    """
    n = max(int(nombre_articles), 1)
    retenu = _paliers()[0]
    for mini, maxi, frais, commission in _paliers():
        if n >= mini and (maxi is None or n <= maxi):
            return mini, maxi, frais, commission
        if n >= mini:
            retenu = (mini, maxi, frais, commission)
    return retenu


def frais_service(nombre_articles: int) -> FraisService:
    """
    Calcule le frais de service d'un colis contenant ``nombre_articles``.

    La part du receveur est **progressive** (25 / 50 / 80 / 150 FCFA selon le
    palier) ; le reste du frais constitue notre part (frais de plateforme).
    """
    n = max(int(nombre_articles), 1)
    _, _, frais, commission = palier_pour(n)
    part_receveur = min(max(int(commission), 0), frais)
    return FraisService(
        nombre_articles=n,
        frais_fcfa=frais,
        part_receveur_fcfa=part_receveur,
        part_plateforme_fcfa=frais - part_receveur,
    )


def frais_service_passager() -> int:
    """Frais de service **fixe** d'un passager/enfant : 100 FCFA par défaut.

    Ce montant ne dépend **pas** du nombre de bagages (traçabilité seule).
    """
    return int(parametres.frais_service_passager_fcfa or 100)


def bareme() -> list[dict]:
    """Barème complet (affichage côté guichet / documentation)."""
    return [
        {
            "nb_articles_min": mini,
            "nb_articles_max": maxi,
            "frais_fcfa": frais,
            "part_receveur_fcfa": min(max(int(commission), 0), frais),
        }
        for mini, maxi, frais, commission in _paliers()
    ]
