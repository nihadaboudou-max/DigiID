# -*- coding: utf-8 -*-
"""
Modèle de scoring pondéré DigiID — version 1.

Approche transparente et interprétable : chaque facteur a un poids fixe
défini dans le Cahier des Charges (25/35/20/20). Pour chaque famille,
on calcule un sous-score entre 0 et le poids maximum.

Avantages de cette approche par règles métier :
  - 100 % explicable à l'utilisateur (transparence)
  - Stable et prévisible
  - Pas besoin de données d'entraînement
  - Conforme à l'article 22 RGPD (pas de décision purement automatisée)

En Phase 4, on ajoutera un modèle XGBoost en complément pour capturer
les interactions non linéaires, mais ce modèle pondéré restera
l'explication par défaut (interprétabilité).
"""
from dataclasses import dataclass
from typing import Tuple

from src.modules.scoring.generateur_donnees import DonneesComportementales


# --- Poids du Cahier des Charges (sur 100 au total) ---
POIDS_ANCIENNETE_SIM = 25.0
POIDS_MOBILE_MONEY = 35.0
POIDS_GEOGRAPHIE = 20.0
POIDS_RESEAU = 20.0

# Vérification : la somme doit être 100
assert POIDS_ANCIENNETE_SIM + POIDS_MOBILE_MONEY + POIDS_GEOGRAPHIE + POIDS_RESEAU == 100, \
    "Les poids doivent sommer à 100"

METHODE_VERSION = "ponderee_v1"


@dataclass
class ResultatCalcul:
    """Résultat complet d'un calcul de score."""
    score_total: int                  # 0-100
    sous_score_sim: float
    sous_score_mobile_money: float
    sous_score_geographie: float
    sous_score_reseau: float
    donnees_brutes: dict              # Pour audit


def _score_sim(d: DonneesComportementales) -> float:
    """
    Sous-score ancienneté & stabilité SIM (max 25).

    Composantes :
      - Ancienneté : 0 mois = 0, 60 mois = max (0.6 * 25 = 15 points)
      - Stabilité : opérateur stable = 0.3 * 25 = 7.5 points
      - Changements : 0 changement = 0.1 * 25 = 2.5 points, dégressif
    """
    # Ancienneté (60 mois = 5 ans pour plein score)
    composante_anciennete = min(1.0, d.anciennete_sim_mois / 60) * 0.6
    # Stabilité opérateur
    composante_stabilite = 0.3 if d.operateur_stable else 0.1
    # Pénalité changements
    composante_changements = max(0, 0.1 - d.nombre_changements_sim * 0.04)

    pourcentage = composante_anciennete + composante_stabilite + composante_changements
    return min(POIDS_ANCIENNETE_SIM, pourcentage * POIDS_ANCIENNETE_SIM)


def _score_mobile_money(d: DonneesComportementales) -> float:
    """
    Sous-score régularité mobile money (max 35).

    Composantes :
      - Fréquence : 50 tx/mois pour plein score (0.4 * 35 = 14 pts)
      - Régularité temporelle : déjà entre 0-1 (0.4 * 35 = 14 pts)
      - Diversité partenaires : 10 partenaires pour plein score (0.2 * 35 = 7 pts)
    """
    composante_frequence = min(1.0, d.transactions_par_mois / 50) * 0.4
    composante_regularite = d.regularite_temporelle * 0.4
    composante_diversite = min(1.0, d.diversite_partenaires / 10) * 0.2

    pourcentage = composante_frequence + composante_regularite + composante_diversite
    return min(POIDS_MOBILE_MONEY, pourcentage * POIDS_MOBILE_MONEY)


def _score_geographie(d: DonneesComportementales) -> float:
    """
    Sous-score stabilité géographique (max 20).

    Composantes :
      - Constance ville : 24 mois pour plein score (0.7 * 20 = 14 pts)
      - Pénalité changements de quartier (0.3 * 20 = 6 pts max)
    """
    composante_constance = min(1.0, d.nombre_mois_meme_ville / 24) * 0.7
    composante_quartier = max(0, 0.3 - d.nombre_changements_quartier * 0.1)

    pourcentage = composante_constance + composante_quartier
    return min(POIDS_GEOGRAPHIE, pourcentage * POIDS_GEOGRAPHIE)


def _score_reseau(d: DonneesComportementales) -> float:
    """
    Sous-score réseau de contacts (max 20).

    Composantes :
      - Taille répertoire : 150 contacts pour plein score (0.4 * 20 = 8 pts)
      - Contacts anciens : ratio anciens/total (0.4 * 20 = 8 pts)
      - Recoupement DigiID : 15 contacts communs (0.2 * 20 = 4 pts)
    """
    composante_taille = min(1.0, d.taille_repertoire / 150) * 0.4
    ratio_anciens = d.contacts_anciens / d.taille_repertoire if d.taille_repertoire > 0 else 0
    composante_anciens = ratio_anciens * 0.4
    composante_communs = min(1.0, d.contacts_communs_digiid / 15) * 0.2

    pourcentage = composante_taille + composante_anciens + composante_communs
    return min(POIDS_RESEAU, pourcentage * POIDS_RESEAU)


def calculer(donnees: DonneesComportementales) -> ResultatCalcul:
    """
    Calcule le score total et tous les sous-scores.

    Le score total est arrondi à l'entier le plus proche.
    """
    sim = _score_sim(donnees)
    mm = _score_mobile_money(donnees)
    geo = _score_geographie(donnees)
    reseau = _score_reseau(donnees)

    total = round(sim + mm + geo + reseau)
    total = max(0, min(100, total))

    return ResultatCalcul(
        score_total=total,
        sous_score_sim=round(sim, 2),
        sous_score_mobile_money=round(mm, 2),
        sous_score_geographie=round(geo, 2),
        sous_score_reseau=round(reseau, 2),
        donnees_brutes={
            "anciennete_sim_mois": donnees.anciennete_sim_mois,
            "nombre_changements_sim": donnees.nombre_changements_sim,
            "operateur_stable": donnees.operateur_stable,
            "transactions_par_mois": donnees.transactions_par_mois,
            "montant_moyen_fcfa": donnees.montant_moyen_transaction_fcfa,
            "regularite_temporelle": round(donnees.regularite_temporelle, 3),
            "diversite_partenaires": donnees.diversite_partenaires,
            "nombre_mois_meme_ville": donnees.nombre_mois_meme_ville,
            "nombre_changements_quartier": donnees.nombre_changements_quartier,
            "taille_repertoire": donnees.taille_repertoire,
            "contacts_anciens": donnees.contacts_anciens,
            "contacts_communs_digiid": donnees.contacts_communs_digiid,
        },
    )


def interpreter_score(score: int) -> Tuple[str, str]:
    """Renvoie (niveau, interprétation) pour un score donné."""
    if score >= 70:
        return ("Élevé",
                "Excellent. Tu peux ouvrir un compte bancaire et solliciter "
                "un microcrédit auprès des partenaires DigiID.")
    if score >= 40:
        return ("Moyen",
                "Correct. Continue d'utiliser tes services habituels — ton "
                "score augmentera naturellement avec le temps.")
    return ("Faible",
            "En construction. Patience, ton historique va s'étoffer dans les "
            "semaines à venir. Utilise régulièrement ton mobile money.")
