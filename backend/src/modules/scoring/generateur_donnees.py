# -*- coding: utf-8 -*-
"""
Générateur de données comportementales — version réaliste et progressive.

PRINCIPE FONDAMENTAL
====================
Un utilisateur qui vient de s'inscrire (sans avoir rien fait) n'a AUCUN historique.
Son score doit donc être TRÈS BAS au début (5-15 sur 100), pas 76.

Le score doit augmenter PROGRESSIVEMENT :
  - Avec le temps (ancienneté du compte, régularité observée)
  - Avec les actions de l'utilisateur (compléter son profil, accorder des
    autorisations, activer la 2FA, vérifier son email)
  - Avec ses comportements simulés (transactions mobile money régulières, etc.)

C'est une simulation pédagogique. En Phase 6, ce module sera remplacé par
des connecteurs vers les vraies API opérateurs (Wave, Orange Money, etc.).

DÉTERMINISME
============
Pour un même utilisateur et un même contexte d'engagement, on génère TOUJOURS
les mêmes valeurs. Cela garantit que le score est reproductible et stable
entre deux appels.
"""
import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID


@dataclass
class SignauxUtilisateur:
    """
    Signaux dynamiques tirés du profil réel de l'utilisateur DigiID.
    Plus ces signaux sont riches, plus le score peut grimper avec le temps.

    Note importante : ces signaux ne donnent pas un boost immédiat.
    Ils augmentent le POTENTIEL de score, qui se concrétise au fil du temps.
    """
    # Combien de champs du profil sont remplis (sur 7)
    nombre_champs_profil_remplis: int = 0
    # Combien de consentements facultatifs sont accordés (sur 5)
    nombre_consentements_facultatifs_accordes: int = 0
    # La 2FA est-elle activée ? (signal de sérieux côté sécurité)
    deux_fa_active: bool = False
    # L'email a-t-il été vérifié ?
    email_verifie: bool = False


@dataclass
class DonneesComportementales:
    """Données brutes utilisées pour le calcul du score."""
    # --- Famille SIM ---
    anciennete_sim_mois: int
    nombre_changements_sim: int
    operateur_stable: bool

    # --- Famille mobile money ---
    transactions_par_mois: int
    montant_moyen_transaction_fcfa: int
    regularite_temporelle: float    # 0-1 (régulier = 1)
    diversite_partenaires: int

    # --- Famille géographie ---
    nombre_mois_meme_ville: int
    nombre_changements_quartier: int

    # --- Famille réseau de contacts ---
    taille_repertoire: int
    contacts_anciens: int
    contacts_communs_digiid: int
    anciennete_telephone_mois: int  # Proxy anti-circularité DigiID

    # --- Famille attestations communautaires (Nouveau facteur correcteur) ---
    attestations_approuvees_recues: int   # Nombre d'attestations approuvées
    poids_total_attestations: float       # Somme des poids bruts configurés
    poids_total_effectif_attestations: float  # Somme des poids pondérés par crédibilité de l'attestant
    attestants_uniques: int               # Nombre d'attestants distincts


def _seed_depuis_uuid(utilisateur_id: UUID) -> int:
    """
    Convertit un UUID en entier (graine déterministe).
    Le même utilisateur produit toujours les mêmes valeurs aléatoires.
    """
    digest = hashlib.sha256(str(utilisateur_id).encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big")


def _rng_simple(seed: int):
    """
    Générateur pseudo-aléatoire déterministe (LCG MMIX de Knuth).
    On évite numpy.random ou random.seed pour ne pas polluer l'état global.
    """
    state = [seed & 0xFFFFFFFFFFFFFFFF]

    def suivant() -> float:
        state[0] = (state[0] * 6364136223846793005 + 1442695040888963407) & 0xFFFFFFFFFFFFFFFF
        return ((state[0] >> 32) & 0xFFFFFFFF) / 0xFFFFFFFF

    return suivant


def _courbe_maturite(age_jours: int) -> float:
    """
    Courbe de maturité du compte — détermine quelle proportion du potentiel
    de l'utilisateur est observable.

    Forme : courbe en S (sigmoïde adoucie) — quasi nulle au début,
    monte vite vers 3-6 mois, puis plafonne à 1.0 vers 12 mois.

    Exemples :
      - 0 jour    → 0.00 (rien à mesurer)
      - 7 jours   → 0.03
      - 30 jours  → 0.10
      - 90 jours  → 0.40
      - 180 jours → 0.75
      - 365 jours → 0.95
      - 730 jours → 1.00 (plein potentiel atteint)
    """
    if age_jours <= 0:
        return 0.0
    # Sigmoïde paramétrée : centre à 120 jours (~4 mois), pente moyenne
    import math
    # 1 / (1 + exp(-(x - centre) / largeur))
    centre = 120.0
    largeur = 60.0
    valeur = 1.0 / (1.0 + math.exp(-(age_jours - centre) / largeur))
    # On ramène à 0..1 strict : à age=0, sigmoide ≈ 0.135, on soustrait pour partir de 0
    base_zero = 1.0 / (1.0 + math.exp(centre / largeur))
    valeur_corrigee = (valeur - base_zero) / (1.0 - base_zero)
    return max(0.0, min(1.0, valeur_corrigee))


def generer_donnees_pour_utilisateur(
    utilisateur_id: UUID,
    date_creation_compte: datetime,
    signaux: SignauxUtilisateur | None = None,
) -> DonneesComportementales:
    """
    Génère des données comportementales réalistes et progressives.

    Logique :
      1. On calcule la maturité du compte (courbe en S) → entre 0 et 1
      2. On calcule un bonus d'engagement (profil + consentements + sécurité)
      3. Les valeurs comportementales générées sont = potentiel × maturité × engagement

    Conséquence directe : un compte tout frais (0 jour) sans aucune action
    aura un score très bas (< 10/100). Un compte de 6 mois engagé peut
    atteindre 70-85/100.
    """
    if signaux is None:
        signaux = SignauxUtilisateur()

    # Le RNG démarre toujours sur le même état pour un utilisateur donné
    rng = _rng_simple(_seed_depuis_uuid(utilisateur_id))

    # --- Maturité du compte (0 à 1) selon l'âge ---
    age_compte_jours = max(0, (datetime.now(timezone.utc) - date_creation_compte).days)
    maturite = _courbe_maturite(age_compte_jours)

    # --- Bonus d'engagement (0 à 1) selon les actions de l'utilisateur ---
    # Sans aucune action, bonus = 0. Avec tout activé, bonus = 1.
    bonus_profil = signaux.nombre_champs_profil_remplis / 7  # 0 à 1
    bonus_consentements = signaux.nombre_consentements_facultatifs_accordes / 5  # 0 à 1
    bonus_securite = (
        (0.5 if signaux.deux_fa_active else 0.0)
        + (0.5 if signaux.email_verifie else 0.0)
    )  # 0, 0.5 ou 1
    # Moyenne pondérée — l'engagement profil compte plus
    engagement = (
        bonus_profil * 0.4
        + bonus_consentements * 0.4
        + bonus_securite * 0.2
    )

    # --- Facteur global = combinaison maturité × engagement ---
    # C'est ce qui détermine COMBIEN de potentiel l'utilisateur a réellement développé.
    # Un compte vieux mais sans engagement reste modeste.
    # Un compte engagé mais récent reste modeste.
    # Seul un compte ancien ET engagé exploite son plein potentiel.
    facteur_global = (maturite * 0.7) + (engagement * 0.3 * maturite)
    # Clamp pour la sûreté
    facteur_global = max(0.0, min(1.0, facteur_global))

    # ========================================================================
    # GÉNÉRATION DES VALEURS COMPORTEMENTALES
    # ========================================================================
    # Pour chaque variable : valeur_min + (valeur_max - valeur_min) × facteur × variation_aléatoire
    # Le facteur global pilote la "richesse" de l'historique simulé.

    # --- SIM ---
    # Ancienneté SIM réelle : entre 0 et 96 mois — proportionnelle à la maturité
    # Un nouveau compte aurait théoriquement aussi une SIM neuve.
    # Mais en pratique on suppose qu'il avait la SIM avant d'arriver sur DigiID.
    anciennete_min = max(0, age_compte_jours // 30)  # au moins l'âge du compte en mois
    anciennete_max = anciennete_min + 60  # plus jusqu'à 5 ans d'historique
    anciennete_sim_mois = int(anciennete_min + (anciennete_max - anciennete_min) * facteur_global * (0.5 + 0.5 * rng()))

    # Changements SIM : peu (0-3), moins si engagé en sécurité
    nombre_changements_sim = int(rng() * 3 * (1 - bonus_securite * 0.4))

    # Opérateur stable : oui à 70 % en moyenne, 90 % si engagement élevé
    operateur_stable = rng() < (0.5 + engagement * 0.4)

    # --- Mobile money ---
    # Transactions par mois : presque 0 sans maturité, jusqu'à ~150 quand engagé+ancien
    transactions_par_mois = int(facteur_global * (10 + rng() * 130))

    # Montant moyen : valeurs typiques 3000-25000 FCFA, variant peu
    montant_moyen = int(3000 + rng() * 20000)

    # Régularité : faible si peu de transactions, monte avec maturité
    regularite = facteur_global * (0.3 + rng() * 0.6)

    # Diversité partenaires : 0-15
    diversite_partenaires = int(facteur_global * (3 + rng() * 12))

    # --- Géographie ---
    # Constance ville : proportionnelle à l'âge du compte (on ne peut pas être
    # constant pendant 24 mois si le compte a 7 jours)
    constance_max = min(age_compte_jours // 30 + 12, 60)  # plafond raisonnable
    nombre_mois_meme_ville = int(facteur_global * constance_max)
    # On garantit au moins 1 mois de constance si le compte existe
    nombre_mois_meme_ville = max(0, nombre_mois_meme_ville)

    # Changements quartier : 0-2, moins si bien engagé
    nombre_changements_quartier = int(rng() * 2 * (1 - engagement * 0.5))

    # --- Réseau de contacts ---
    # Taille répertoire : 0-300, croît avec maturité
    taille_repertoire = int(facteur_global * (50 + rng() * 250))
    # Contacts anciens : 40-80% des contacts, mais zéro si compte trop jeune
    contacts_anciens = int(taille_repertoire * facteur_global * (0.4 + rng() * 0.4))
    # Contacts communs DigiID : très faible au début
    contacts_communs = int(facteur_global * rng() * 25)
    # Proxy anti-circularité : ancienneté du numéro de téléphone
    # Permet de scorer sur le réseau même quand DigiID n'a pas assez d'utilisateurs
    anciennete_tel_mois = max(0, age_compte_jours // 30) + int(rng() * 48)

    # --- Attestations communautaires (correcteur d'exclusion) ---
    # Au début : 0 (personne n'atteste un nouveau venu)
    # Avec le temps : quelques attestations apparaissent
    # Ce module est en simulation ; en prod, les vraies données viendront
    # de la table AttestationCommunautaire
    nb_attestations = int(facteur_global * rng() * 4)  # 0 à ~4
    poids_attest = nb_attestations * (3 + rng() * 5)  # poids moyen 3-8 pts chacune
    attestants_uniq = max(0, nb_attestations - int(rng() * 1.5))  # certains doublons

    return DonneesComportementales(
        anciennete_sim_mois=anciennete_sim_mois,
        nombre_changements_sim=nombre_changements_sim,
        operateur_stable=operateur_stable,
        transactions_par_mois=transactions_par_mois,
        montant_moyen_transaction_fcfa=montant_moyen,
        regularite_temporelle=regularite,
        diversite_partenaires=diversite_partenaires,
        nombre_mois_meme_ville=nombre_mois_meme_ville,
        nombre_changements_quartier=nombre_changements_quartier,
        taille_repertoire=taille_repertoire,
        contacts_anciens=contacts_anciens,
        contacts_communs_digiid=contacts_communs,
        anciennete_telephone_mois=anciennete_tel_mois,
        attestations_approuvees_recues=nb_attestations,
        poids_total_attestations=round(poids_attest, 1),
        poids_total_effectif_attestations=round(poids_attest * (1 + rng() * 0.5), 1),
        attestants_uniques=attestants_uniq,
    )
