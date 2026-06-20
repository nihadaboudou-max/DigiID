# -*- coding: utf-8 -*-
"""
Générateur de données comportementales — version 100% RÉELLE.

PHASE 6 : Plus AUCUNE simulation.
Toutes les données proviennent de la base (traçage réel).

Facteurs rendus réels :
  - Ancienneté → âge réel du compte utilisateur
  - Stabilité téléphone → suivi des changements (date_derniere_modification_telephone)
  - Géographie → ville déclarée + date dernier changement
  - Réseau → nombre de filleuls réel (parrainage)
  - Attestations → données réelles (déjà fait)
  - Bonus → bonus_score_cumule réel (badges + parrainage + streak)

Facteurs à 0 (en attente d'API opérateur) :
  - Mobile money
  - Répertoire contacts
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID


@dataclass
class SignauxUtilisateur:
    """
    Signaux RÉELS tirés du profil utilisateur et de la base de données.
    Aucune valeur aléatoire : tout vient du vrai profil.
    """
    # === Profil & engagement ===
    nombre_champs_profil_remplis: int = 0
    nombre_consentements_facultatifs_accordes: int = 0
    deux_fa_active: bool = False
    email_verifie: bool = False

    # === Ancienneté & Stabilité (RÉEL) ===
    age_compte_jours: int = 0
    age_telephone_mois: int = 0
    operateur: Optional[str] = None
    nombre_changements_telephone: int = 0

    # === Géographie (RÉELLE) ===
    mois_stabilite_ville: int = 0
    nombre_changements_ville: int = 0
    nombre_changements_quartier: int = 0

    # === Réseau & Parrainage (RÉEL) ===
    nombre_filleuls: int = 0
    bonus_score_cumule: int = 0

    # === Vérifications fortes ===
    cni_verifiee: bool = False
    visage_verifie: bool = False
    mois_depuis_verification_cni: int = 999
    mois_depuis_verification_visage: int = 999

    # === Documents d'identité (CNI + Permis + Assurance) ===
    document_cni_present: bool = False
    document_permis_present: bool = False
    document_assurance_present: bool = False
    nb_champs_cni_remplis: int = 0
    nb_champs_permis_remplis: int = 0
    nb_champs_assurance_remplis: int = 0
    mois_depuis_derniere_modif_document: int = 999


@dataclass
class DonneesComportementales:
    """Données brutes 100% réelles pour le calcul du score.

    Les champs sans API partenaire sont mis à 0.
    """
    # --- Ancienneté & Stabilité (RÉEL) ---
    age_compte_mois: int = 0
    age_telephone_mois: int = 0
    operateur_renseigne: bool = False
    nombre_changements_telephone: int = 0

    # --- Mobile money (EN ATTENTE API) ---
    transactions_par_mois: int = 0
    montant_moyen_transaction_fcfa: int = 0
    regularite_temporelle: float = 0.0
    diversite_partenaires: int = 0

    # --- Géographie (RÉELLE) ---
    mois_stabilite_ville: int = 0
    nombre_changements_ville: int = 0
    nombre_changements_quartier: int = 0

    # --- Réseau (RÉEL : parrainage) ---
    nombre_filleuls: int = 0
    bonus_score_cumule: int = 0

    # --- Vérifications identité (RÉELLES) ---
    email_verifie: int = 0       # 0 ou 1
    deux_fa_active: int = 0      # 0 ou 1
    cni_verifiee: int = 0        # 0 ou 1
    visage_verifie: int = 0      # 0 ou 1
    nb_consentements: int = 0    # 0-5
    champs_profil: int = 0       # 0-7

    # --- Documents d'identité (RÉELS) ---
    document_cni_present: int = 0
    document_permis_present: int = 0
    document_assurance_present: int = 0
    nb_champs_cni_remplis: int = 0
    nb_champs_permis_remplis: int = 0
    nb_champs_assurance_remplis: int = 0
    mois_depuis_derniere_modif_document: int = 999

    # --- Attestations (RÉELLES, écrasées par service.py) ---
    attestations_approuvees_recues: int = 0
    poids_total_attestations: float = 0.0
    poids_total_effectif_attestations: float = 0.0
    attestants_uniques: int = 0


def generer_donnees_pour_utilisateur(
    utilisateur_id: UUID,
    date_creation_compte: Optional[datetime] = None,
    signaux: Optional[SignauxUtilisateur] = None,
) -> DonneesComportementales:
    """
    Construit les données comportementales à partir des signaux RÉELS uniquement.

    Plus aucune simulation : les données non disponibles sont mises à 0.
    """
    if signaux is None:
        signaux = SignauxUtilisateur()

    return DonneesComportementales(
        age_compte_mois=signaux.age_compte_jours // 30,
        age_telephone_mois=signaux.age_telephone_mois,
        operateur_renseigne=signaux.operateur is not None,
        nombre_changements_telephone=signaux.nombre_changements_telephone,
        # Géographie
        mois_stabilite_ville=signaux.mois_stabilite_ville,
        nombre_changements_ville=signaux.nombre_changements_ville,
        nombre_changements_quartier=signaux.nombre_changements_quartier,
        # Réseau
        nombre_filleuls=signaux.nombre_filleuls,
        bonus_score_cumule=signaux.bonus_score_cumule,
        # Vérifications
        email_verifie=1 if signaux.email_verifie else 0,
        deux_fa_active=1 if signaux.deux_fa_active else 0,
        cni_verifiee=1 if signaux.cni_verifiee else 0,
        visage_verifie=1 if signaux.visage_verifie else 0,
        nb_consentements=signaux.nombre_consentements_facultatifs_accordes,
        champs_profil=signaux.nombre_champs_profil_remplis,
        # Documents d'identité
        document_cni_present=1 if signaux.document_cni_present else 0,
        document_permis_present=1 if signaux.document_permis_present else 0,
        document_assurance_present=1 if signaux.document_assurance_present else 0,
        nb_champs_cni_remplis=signaux.nb_champs_cni_remplis,
        nb_champs_permis_remplis=signaux.nb_champs_permis_remplis,
        nb_champs_assurance_remplis=signaux.nb_champs_assurance_remplis,
        mois_depuis_derniere_modif_document=signaux.mois_depuis_derniere_modif_document,
        # Attestations (écrasées par _collecter_attestations dans service.py)
    )
