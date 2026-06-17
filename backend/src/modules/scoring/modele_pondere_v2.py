# -*- coding: utf-8 -*-
"""
Modèle de scoring pondéré DigiID — version 2 avec attestations communautaires.

Cette version introduit un 5e facteur (Attestations Communautaires, 15 pts)
pour corriger le biais structurel du Mobile Money (réduit de 35 à 25 pts).

Changements par rapport à la v1 :
  - POIDS_MOBILE_MONEY : 35 → 25 (réduction du biais structurel)
  - POIDS_RESEAU : 20 → 15 (ajustement)
  - NOUVEAU : POIDS_ATTESTATIONS = 15.0 (correcteur d'exclusion)
  - NOUVEAU : 4 niveaux (Débutant/Établi/Fiable/Expert) au lieu de 3
  - NOUVEAU : Proxy réseau pour éviter la circularité au démarrage

Conforme à l'article 22 RGPD (pas de décision purement automatisée).
"""
from dataclasses import dataclass
from typing import Tuple

from src.modules.scoring.generateur_donnees import DonneesComportementales


# --- Poids du Cahier des Charges (sur 100 au total) ---
# Étape 1 : Ancienneté SIM et stabilité (25)
POIDS_ANCIENNETE_SIM = 25.0
# Étape 2 : Régularité mobile money (25, réduit de 35 → 25 pour compensateur attestations)
POIDS_MOBILE_MONEY = 25.0
# Étape 3 : Stabilité géographique (20)
POIDS_GEOGRAPHIE = 20.0
# Étape 4 : Réseau de contacts (15, réduit de 20 → 15 pour faire place)
POIDS_RESEAU = 15.0
# Étape 4 bis : Attestations communautaires (15 — nouveau facteur compensateur)
#   - Corrige le biais structurel du Mobile Money
#   - Permet aux populations vulnérables (réfugiés, femmes rurales, mineurs)
#     d'obtenir un score via validation sociale (ONG, agents terrain)
#   - Prouvable, révocable, non-contrefaisable
POIDS_ATTESTATIONS = 15.0

# Vérification : la somme doit être 100
assert POIDS_ANCIENNETE_SIM + POIDS_MOBILE_MONEY + POIDS_GEOGRAPHIE + POIDS_RESEAU + POIDS_ATTESTATIONS == 100, \
    "Les poids doivent sommer à 100"

METHODE_VERSION = "ponderee_v2_attestations"


@dataclass
class ResultatCalcul:
    """Résultat complet d'un calcul de score."""
    score_total: int                  # 0-100
    sous_score_sim: float
    sous_score_mobile_money: float
    sous_score_geographie: float
    sous_score_reseau: float
    sous_score_attestations: float    # Nouveau facteur compensateur (étape 4)
    donnees_brutes: dict              # Pour audit


def _score_sim(d: DonneesComportementales) -> float:
    """
    Sous-score ancienneté & stabilité SIM (max 25).

    Composantes :
      - Ancienneté : 0 mois = 0, 60 mois = max (0.6 * 25 = 15 points)
      - Stabilité : opérateur stable = 0.3 * 25 = 7.5 points
      - Changements : 0 changement = 0.1 * 25 = 2.5 points, dégressif
    """
    composante_anciennete = min(1.0, d.anciennete_sim_mois / 60) * 0.6
    composante_stabilite = 0.3 if d.operateur_stable else 0.1
    composante_changements = max(0, 0.1 - d.nombre_changements_sim * 0.04)

    pourcentage = composante_anciennete + composante_stabilite + composante_changements
    return min(POIDS_ANCIENNETE_SIM, pourcentage * POIDS_ANCIENNETE_SIM)


def _score_mobile_money(d: DonneesComportementales) -> float:
    """
    Sous-score régularité mobile money (max 25 — réduit de 35 à 25).

    Composantes :
      - Fréquence : 50 tx/mois pour plein score (0.4 * 25 = 10 pts)
      - Régularité temporelle : déjà entre 0-1 (0.4 * 25 = 10 pts)
      - Diversité partenaires : 10 partenaires pour plein score (0.2 * 25 = 5 pts)
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
    Sous-score réseau de contacts (max 15 — réduit de 20 pour faire place aux attestations).

    Composantes :
      - Taille répertoire : 150 contacts pour plein score (0.4 * 15 = 6 pts)
      - Contacts anciens : ratio anciens/total (0.4 * 15 = 6 pts)
      - Recoupement DigiID **ou proxy ancienneté numéro** : 15 contacts communs
        ou 24 mois d'ancienneté téléphone (0.2 * 15 = 3 pts)
        -> Corrige le problème de circularité : au démarrage, si personne n'a DigiID,
          on utilise l'ancienneté du numéro comme proxy du réseau social.
    """
    composante_taille = min(1.0, d.taille_repertoire / 150) * 0.4
    ratio_anciens = d.contacts_anciens / d.taille_repertoire if d.taille_repertoire > 0 else 0
    composante_anciens = ratio_anciens * 0.4
    # Proxy anti-circularité : si DigiID communs < 3, le proxy prend le relais
    composante_communs = min(1.0, d.contacts_communs_digiid / 15) * 0.2
    composante_proxy = min(1.0, d.anciennete_telephone_mois / 24) * 0.2
    composante_reseau = max(composante_communs, composante_proxy * 0.6)

    pourcentage = composante_taille + composante_anciens + composante_reseau
    return min(POIDS_RESEAU, pourcentage * POIDS_RESEAU)


def _score_attestations(d: DonneesComportementales) -> float:
    """
    Sous-score attestations communautaires (max 15).

    NOUVEAU FACTEUR — Etape 4.
    Role : compenser le biais structurel du Mobile Money (25 pts) en permettant
    aux populations vulnérables (refugies, femmes rurales, mineurs, precaires)
    d'obtenir un score via validation sociale decentralisee.

    Composantes :
      - Nombre d'attestations approuvees : 5 attestations pour plein score (0.6 * 15 = 9 pts)
      - Poids total : somme des poids > 30 pour plein score (0.3 * 15 = 4.5 pts)
      - Diversite des attestants : 5 attestants uniques (0.1 * 15 = 1.5 pts)
    """
    composante_nombre = min(1.0, d.attestations_approuvees_recues / 5) * 0.6
    composante_poids = min(1.0, d.poids_total_attestations / 30) * 0.3
    composante_diversite = min(1.0, d.attestants_uniques / 5) * 0.1

    pourcentage = composante_nombre + composante_poids + composante_diversite
    return min(POIDS_ATTESTATIONS, pourcentage * POIDS_ATTESTATIONS)


def calculer(donnees: DonneesComportementales) -> ResultatCalcul:
    """
    Calcule le score total et tous les sous-scores.

    Le score total est arrondi a l'entier le plus proche.
    """
    sim = _score_sim(donnees)
    mm = _score_mobile_money(donnees)
    geo = _score_geographie(donnees)
    reseau = _score_reseau(donnees)
    attestations = _score_attestations(donnees)

    total = round(sim + mm + geo + reseau + attestations)
    total = max(0, min(100, total))

    return ResultatCalcul(
        score_total=total,
        sous_score_sim=round(sim, 2),
        sous_score_mobile_money=round(mm, 2),
        sous_score_geographie=round(geo, 2),
        sous_score_reseau=round(reseau, 2),
        sous_score_attestations=round(attestations, 2),
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
            "attestations_approuvees_recues": donnees.attestations_approuvees_recues,
            "poids_total_attestations": donnees.poids_total_attestations,
            "attestants_uniques": donnees.attestants_uniques,
        },
    )


def interpreter_score(score: int) -> Tuple[str, str]:
    """Renvoie (niveau, interpretation) pour un score donne. 4 niveaux."""
    if score >= 80:
        return ("Expert",
                "Excellent. Tu peux ouvrir un compte bancaire et solliciter "
                "un microcredit aupres des partenaires DigiID.")
    if score >= 55:
        return ("Fiable",
                "Bonne confiance. Ton profil est bien etabli. Continue comme ca.")
    if score >= 30:
        return ("Etabli",
                "Correct. Continue d'utiliser tes services habituels -- ton "
                "score augmentera naturellement avec le temps. Les attestations "
                "communautaires peuvent t'aider a monter plus vite.")
    return ("Debutant",
            "En construction. Patience, ton historique va s'etofer dans les "
            "semaines a venir. Invite des proches a t'attester et utilise "
            "regulierement ton mobile money.")
