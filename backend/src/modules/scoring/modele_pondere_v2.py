# -*- coding: utf-8 -*-
"""
Modèle de scoring pondéré DigiID — version 3 avec données 100% RÉELLES.

Plus AUCUNE donnée simulée. Tous les facteurs utilisent des données
réelles traquées dans la base de données.

Facteurs (100 pts) :
  1. Ancienneté & Stabilité (25 pts) — âge compte, âge téléphone, opérateur
  2. Vérifications Identité (20 pts) — email, CNI, visage, 2FA, consentements
  3. Stabilité Géographique (20 pts) — ancrage ville, changements tracés
  4. Réseau & Engagement (15 pts) — parrainage, bonus cumulé (faible évolution)
  5. Attestations Communautaires (20 pts) — validation sociale réelle

Conforme à l'article 22 RGPD (pas de décision purement automatisée).
"""
from dataclasses import dataclass
from typing import Tuple

from src.modules.scoring.generateur_donnees import DonneesComportementales


# --- Poids réels (sur 100 au total) ---
# Étape 1 : Ancienneté compte + stabilité téléphone (25)
POIDS_ANCIENNETE = 25.0
# Étape 2 : Vérifications identité (email, CNI, visage, 2FA, consentements)
POIDS_VERIFICATIONS = 20.0
# Étape 3 : Stabilité géographique (20)
POIDS_GEOGRAPHIE = 20.0
# Étape 4 : Réseau & Engagement (bonus cumulé, parrainage) — faible évolution
POIDS_RESEAU_BONUS = 15.0
# Étape 5 : Attestations communautaires (20 — revalorisé car fiable)
POIDS_ATTESTATIONS = 20.0

# Poids des sous-facteurs bonus (intégré dans POIDS_RESEAU_BONUS)
POIDS_BONUS_DANS_RESEAU = 5.0   # 5 pts sur 15 pour le bonus_score_cumule
POIDS_PARRAINAGE_DANS_RESEAU = 10.0  # 10 pts sur 15 pour les filleuls

# Vérification
assert POIDS_ANCIENNETE + POIDS_VERIFICATIONS + POIDS_GEOGRAPHIE + POIDS_RESEAU_BONUS + POIDS_ATTESTATIONS == 100, \
    f"Les poids doivent sommer à 100 (actuel={POIDS_ANCIENNETE+POIDS_VERIFICATIONS+POIDS_GEOGRAPHIE+POIDS_RESEAU_BONUS+POIDS_ATTESTATIONS})"

# Anciens alias pour compatibilité ascendante (utilisés dans _construire_detail)
POIDS_ANCIENNETE_SIM = POIDS_ANCIENNETE
POIDS_MOBILE_MONEY = POIDS_VERIFICATIONS
POIDS_RESEAU = POIDS_RESEAU_BONUS

METHODE_VERSION = "ponderee_v3_reelle"


@dataclass
class ResultatCalcul:
    """Résultat complet d'un calcul de score (100% données réelles)."""
    score_total: int                  # 0-100
    sous_score_sim: float             # Ancienneté & stabilité
    sous_score_mobile_money: float    # Vérifications identité
    sous_score_geographie: float      # Stabilité géographique
    sous_score_reseau: float          # Réseau & Engagement
    sous_score_attestations: float    # Attestations communautaires
    donnees_brutes: dict              # Pour audit



def _score_anciennete(d: DonneesComportementales) -> float:
    """
    Sous-score ancienneté compte & stabilité téléphone (max 25).

    Composantes (100% RÉELLES) :
      - Âge du compte : 0 mois = 0, 60 mois = max (0.5 * 25 = 12.5 pts)
      - Âge du téléphone actuel : proxy stabilité (0.3 * 25 = 7.5 pts)
      - Opérateur renseigné : +0.1 (bonus déclaratif, 2.5 pts)
      - Changements téléphone : 0 changement = max, pénalité par changement (0.1 * 25 = 2.5 pts)
    """
    # Âge réel du compte (récupéré depuis cree_le)
    composante_age = min(1.0, d.age_compte_mois / 60) * 0.5
    # Âge du téléphone actuel (proxy de la stabilité du numéro)
    composante_age_tel = min(1.0, d.age_telephone_mois / 36) * 0.3
    # Opérateur déclaré
    composante_operateur = 0.1 if d.operateur_renseigne else 0.0
    # Pénalité changements téléphone
    composante_changements = max(0, 0.1 - d.nombre_changements_telephone * 0.03)

    pourcentage = composante_age + composante_age_tel + composante_operateur + composante_changements
    return min(POIDS_ANCIENNETE, pourcentage * POIDS_ANCIENNETE)


def _score_verifications(d: DonneesComportementales) -> float:
    """
    Sous-score vérifications identité (max 20).

    REMPLACE Mobile Money (25 pts) car pas d'API opérateur.
    Utilise les vérifications RÉELLES de l'utilisateur.

    Composantes (20 pts max) :
      - Email vérifié : 0.15 * 20 = 3 pts
      - 2FA activée : 0.20 * 20 = 4 pts (plus fort car sécurité)
      - CNI vérifiée : 0.25 * 20 = 5 pts
      - Visage vérifié : 0.25 * 20 = 5 pts
      - Consentements facultatifs : 0.10 * 20 = 2 pts (0-5, 3 pour max)
      - Champs profil : 0.05 * 20 = 1 pt (7 champs pour max)
    """
    composante_email = d.email_verifie * 0.15
    composante_2fa = d.deux_fa_active * 0.20
    composante_cni = d.cni_verifiee * 0.25
    composante_visage = d.visage_verifie * 0.25
    composante_consentements = min(1.0, d.nb_consentements / 3) * 0.10
    composante_profil = min(1.0, d.champs_profil / 7) * 0.05

    pourcentage = (composante_email + composante_2fa + composante_cni
                   + composante_visage + composante_consentements + composante_profil)
    return min(POIDS_VERIFICATIONS, pourcentage * POIDS_VERIFICATIONS)


def _score_geographie(d: DonneesComportementales) -> float:
    """
    Sous-score stabilité géographique (max 20).

    Composantes (100% RÉELLES) :
      - Mois dans la même ville : 36 mois pour plein score (0.7 * 20 = 14 pts)
      - Pénalité changements ville : 0 = max (0.2 * 20 = 4 pts)
      - Pénalité changements quartier (0.1 * 20 = 2 pts max)
    """
    composante_stabilite = min(1.0, d.mois_stabilite_ville / 36) * 0.7
    composante_chg_ville = max(0, 0.2 - d.nombre_changements_ville * 0.05)
    composante_quartier = max(0, 0.1 - d.nombre_changements_quartier * 0.05)

    pourcentage = composante_stabilite + composante_chg_ville + composante_quartier
    return min(POIDS_GEOGRAPHIE, pourcentage * POIDS_GEOGRAPHIE)


def _score_reseau_bonus(d: DonneesComportementales) -> float:
    """
    Sous-score réseau & engagement (max 15).

    REMPLACE Réseau de contacts (simulé) par des données RÉELLES :
      - Parrainage : filleuls réels (10 pts max)
      - Bonus cumulé (badges + streak + parrainage) : faible évolution (5 pts max)

    Composantes :
      - Filleuls : 5 filleuls pour plein score (0.67 * 15 = 10 pts)
      - Bonus cumulé : compressé (0.33 * 15 = 5 pts)
        Évolution lente : il faut 50 points de bonus pour 5 pts de score
    """
    # Parrainage réel (max 10 pts sur 15)
    composante_filleuls = min(1.0, d.nombre_filleuls / 5) * 0.67
    # Bonus cumulé réel, compressé pour éviter l'inflation (max 5 pts sur 15)
    composante_bonus = min(1.0, d.bonus_score_cumule / 50) * 0.33

    pourcentage = composante_filleuls + composante_bonus
    return min(POIDS_RESEAU_BONUS, pourcentage * POIDS_RESEAU_BONUS)


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
    # Poids effectif (pondéré par crédibilité de l'attestant) remplace le poids brut
    composante_nombre = min(1.0, d.attestations_approuvees_recues / 10) * 0.5
    composante_poids = min(1.0, d.poids_total_effectif_attestations / 50) * 0.35
    composante_diversite = min(1.0, d.attestants_uniques / 8) * 0.15

    pourcentage = composante_nombre + composante_poids + composante_diversite
    return min(POIDS_ATTESTATIONS, pourcentage * POIDS_ATTESTATIONS)


def calculer(donnees: DonneesComportementales) -> ResultatCalcul:
    """
    Calcule le score total et tous les sous-scores.

    Toutes les données sont 100% RÉELLES — plus aucune simulation.
    Le score total est arrondi a l'entier le plus proche.
    """
    anciennete = _score_anciennete(donnees)
    verifications = _score_verifications(donnees)
    geo = _score_geographie(donnees)
    reseau_bonus = _score_reseau_bonus(donnees)
    attestations = _score_attestations(donnees)

    total = round(anciennete + verifications + geo + reseau_bonus + attestations)
    total = max(0, min(100, total))

    return ResultatCalcul(
        score_total=total,
        sous_score_sim=round(anciennete, 2),
        sous_score_mobile_money=round(verifications, 2),
        sous_score_geographie=round(geo, 2),
        sous_score_reseau=round(reseau_bonus, 2),
        sous_score_attestations=round(attestations, 2),
        donnees_brutes={
            # Ancienneté & Stabilité
            "age_compte_mois": donnees.age_compte_mois,
            "age_telephone_mois": donnees.age_telephone_mois,
            "operateur_renseigne": donnees.operateur_renseigne,
            "changements_telephone": donnees.nombre_changements_telephone,
            # Vérifications
            "email_verifie": donnees.email_verifie,
            "deux_fa_active": donnees.deux_fa_active,
            "cni_verifiee": donnees.cni_verifiee,
            "visage_verifie": donnees.visage_verifie,
            "consentements": donnees.nb_consentements,
            "champs_profil": donnees.champs_profil,
            # Géographie
            "mois_stabilite_ville": donnees.mois_stabilite_ville,
            "changements_ville": donnees.nombre_changements_ville,
            "changements_quartier": donnees.nombre_changements_quartier,
            # Réseau & Engagement
            "nombre_filleuls": donnees.nombre_filleuls,
            "bonus_score_cumule": donnees.bonus_score_cumule,
            # Attestations
            "attestations_approuvees_recues": donnees.attestations_approuvees_recues,
            "poids_total_attestations": donnees.poids_total_attestations,
            "poids_total_effectif_attestations": donnees.poids_total_effectif_attestations,
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
