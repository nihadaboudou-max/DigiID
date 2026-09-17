# -*- coding: utf-8 -*-
"""
Mapping canonique des champs extraits.

PROBLÈME RÉSOLU
---------------
Les extracteurs (nlp_extractor, MRZ, zones) produisent des clés BRUTES qui ne
correspondent pas toujours aux champs du schéma `DonneesDocumentExtraites`
(communs) ni aux clés attendues par `documents_identite` / le frontend
(`donnees_specifiques`). Résultat : des informations correctement extraites
n'étaient pas attribuées à leur champ (n° de police jamais rangé dans
`numero_contrat`, n° de permis jamais exposé, etc.).

Ce module est LE SEUL endroit où l'on traduit une clé d'extracteur vers un
champ canonique. Si un extracteur change de nom de clé, on ne touche qu'ici.
"""
from typing import Any, Dict, Optional, Tuple

from src.modules.inspection_documents.schemas import TypeDocument

# =============================================================================
# 1. Champs communs du schéma (à plat sur DonneesDocumentExtraites)
# =============================================================================
CHAMPS_COMMUNS = {
    "numero_document", "date_expiration", "date_delivrance",
    "nom_famille", "prenoms", "date_naissance", "sexe",
    "lieu_naissance", "autorite_delivrance", "nationalite",
    "pays_emetteur", "taille",
}

# =============================================================================
# 2. Alias globaux : clé brute -> champ canonique commun
# =============================================================================
_ALIAS_COMMUNS: Dict[str, str] = {
    "nom": "nom_famille",
    "nom_souscripteur": "nom_famille",
    "nom_assure": "nom_famille",
    "prenom": "prenoms",
    "prenoms_assure": "prenoms",
    "prenom_assure": "prenoms",
    "numero": "numero_document",
    "num_document": "numero_document",
    "n_document": "numero_document",
    "date_naissance_date": "date_naissance",
    "date_expiration_date": "date_expiration",
    "date_delivrance_date": "date_delivrance",
    "lieu": "lieu_naissance",
    "pays": "pays_emetteur",
    "code_pays": "pays_emetteur",
    "nationalite_nom": "nationalite",
}

# =============================================================================
# 3. Clés spécifiques canoniques par type de document.
#    clé_canonique -> (clés brutes candidates, par ordre de priorité)
#    Alignées sur `documents_identite` (backend) et le frontend.
# =============================================================================
_SPECIFIQUES_PAR_TYPE: Dict[str, Dict[str, Tuple[str, ...]]] = {
    TypeDocument.CARTE_ASSURANCE.value: {
        "compagnie_assurance": ("compagnie_assurance", "compagnie", "assureur", "assurance"),
        "numero_contrat": ("numero_contrat", "numero_police", "police", "contrat", "num_contrat"),
        "immatriculation_vehicule": ("immatriculation_vehicule", "immatriculation", "immat", "plaque"),
        "marque_vehicule": ("marque_vehicule", "marque"),
        "modele_vehicule": ("modele_vehicule", "modele"),
        "type_couverture": ("type_couverture", "couverture", "formule"),
        "annee_vehicule": ("annee_vehicule", "annee"),
    },
    TypeDocument.PERMIS_CONDUIRE.value: {
        "numero_permis": ("numero_permis", "numero_document", "numero"),
        "categories_permis": ("categories_permis", "categories"),
        "centre_examen": ("centre_examen", "autorite_delivrance"),
    },
}


def _est_vide(valeur: Any) -> bool:
    if valeur is None:
        return True
    if isinstance(valeur, str):
        return not valeur.strip()
    if isinstance(valeur, (list, tuple, dict)):
        return len(valeur) == 0
    return False


def mapper_champs_extraits(
    brut: Optional[Dict[str, Any]],
    type_document: TypeDocument,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Traduit les clés brutes d'un extracteur vers :
      - `communs`      : champs à plat du schéma DonneesDocumentExtraites
      - `specifiques`  : clés canoniques de `donnees_specifiques` (par type)

    Déterministe : aucune heuristique de contenu, uniquement des renommages
    et le dispatch commun / spécifique selon le type de document.
    """
    communs: Dict[str, Any] = {}
    specifiques: Dict[str, Any] = {}

    if not brut:
        return communs, specifiques

    type_val = getattr(type_document, "value", str(type_document))

    # ── Étape A : normalisation des alias (renommage brut -> canonique) ──
    normalises: Dict[str, Any] = {}
    for cle, valeur in brut.items():
        if _est_vide(valeur):
            continue
        normalises[_ALIAS_COMMUNS.get(cle, cle)] = valeur

    # ── Étape B : dispatch commun vs spécifique ──
    for cle, valeur in normalises.items():
        if cle in CHAMPS_COMMUNS:
            communs.setdefault(cle, valeur)
        else:
            specifiques[cle] = valeur

    # ── Étape C : (re)construction des clés spécifiques canoniques du type ──
    consommees = set()
    for canon, candidats in _SPECIFIQUES_PAR_TYPE.get(type_val, {}).items():
        if not _est_vide(specifiques.get(canon)):
            continue
        for src in candidats:
            valeur = communs.get(src) if src in CHAMPS_COMMUNS else normalises.get(src)
            if not _est_vide(valeur):
                specifiques[canon] = valeur
                if src != canon:
                    consommees.add(src)
                break

    # Nettoyage : ne pas laisser les clés brutes redondantes (ex: numero_police,
    # immatriculation) une fois qu'elles ont été rangées dans leur champ canonique.
    for cle in consommees:
        specifiques.pop(cle, None)

    # ── Étape D : garantir le numéro de document (commun) ──
    # Pour un permis/assurance, le n° spécifique EST aussi le n° du document.
    if _est_vide(communs.get("numero_document")):
        for canon in ("numero_permis", "numero_contrat"):
            if not _est_vide(specifiques.get(canon)):
                communs["numero_document"] = specifiques[canon]
                break

    return communs, specifiques
