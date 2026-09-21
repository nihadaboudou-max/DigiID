# -*- coding: utf-8 -*-
"""
Moteur de vérification de cohérence d'identité.
Compare les données du document avec le profil utilisateur.
Gère deux modes : citoyen (comparaison stricte) et agent terrain (pas de comparaison).
"""
from typing import Optional
import unicodedata
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from src.modeles import Utilisateur
from src.modules.inspection_documents.schemas import (
    DonneesDocumentExtraites,
    ResultatCoherence,
)
from src.noyau import journal, dechiffrer_donnee

def normaliser_chaine(chaine: str) -> str:
    """
    Normalise une chaîne pour une comparaison robuste :
    - Supprime les accents (é -> e, è -> e)
    - Met en majuscules
    - Supprime tous les espaces, tirets et apostrophes
    
    Exemples :
    "ABOUDOU TRAORE" -> "ABOUDOUTRAORE"
    "ABOUDOUTRAORE"  -> "ABOUDOUTRAORE"
    "M'Bala"         -> "MBALA"
    """
    if not chaine:
        return ""
    
    # 1. Supprimer les accents
    chaine = unicodedata.normalize('NFD', chaine)
    chaine = ''.join(c for c in chaine if unicodedata.category(c) != 'Mn')
    
    # 2. Mettre en majuscules et supprimer les espaces/caractères spéciaux
    chaine = chaine.upper().replace(" ", "").replace("-", "").replace("'", "").replace("`", "")
    
    return chaine.strip()

async def verifier_coherence_identite(
    session: AsyncSession,
    utilisateur: Utilisateur,
    nouvelles_donnees: DonneesDocumentExtraites,
    utilisateur_cible_id: Optional[UUID] = None,
) -> ResultatCoherence:
    """
    Vérifie la cohérence entre le document et le profil utilisateur.
    Utilise une normalisation robuste pour éviter les faux positifs (espaces, accents).
    """
    # ── Mode agent terrain : pas de vérification de cohérence ──
    if hasattr(utilisateur, 'role') and utilisateur.role in ("agent_terrain", "enroleur"):
        if utilisateur_cible_id:
            journal.info(
                f"Mode agent terrain : pas de vérification de cohérence "
                f"(agent={utilisateur.id}, cible={utilisateur_cible_id})"
            )
            return ResultatCoherence(
                est_coherent=True,
                mode="agent_terrain",
                message="Mode agent terrain : cohérence vérifiée ultérieurement.",
            )
    
    # ── Mode citoyen : comparaison normalisée ──
    incoherences = []
    
    # 1. Comparaison Nom
    nom_utilisateur = dechiffrer_donnee(utilisateur.nom_chiffre) if utilisateur.nom_chiffre else ""
    if nom_utilisateur and nouvelles_donnees.nom_famille:
        # On normalise les deux chaînes pour la comparaison
        nom_doc_norm = normaliser_chaine(nouvelles_donnees.nom_famille)
        nom_profil_norm = normaliser_chaine(nom_utilisateur)
        
        if nom_profil_norm != nom_doc_norm:
            # On utilise les versions originales (juste upper/strip) pour le message d'erreur
            incoherences.append(
                f"Nom document ({nouvelles_donnees.nom_famille.upper().strip()}) ≠ Nom profil ({nom_utilisateur.upper().strip()})"
            )
    
    # 2. Comparaison Prénom (premier prénom uniquement)
    prenom_utilisateur = dechiffrer_donnee(utilisateur.prenom_chiffre) if utilisateur.prenom_chiffre else ""
    if prenom_utilisateur and nouvelles_donnees.prenoms:
        # On extrait d'abord le premier prénom, puis on le normalise
        prenom_doc_brut = _extraire_premier_prenom(nouvelles_donnees.prenoms)
        prenom_profil_brut = _extraire_premier_prenom(prenom_utilisateur)
        
        prenom_doc_norm = normaliser_chaine(prenom_doc_brut)
        prenom_profil_norm = normaliser_chaine(prenom_profil_brut)
        
        if prenom_profil_norm != prenom_doc_norm:
            incoherences.append(
                f"Prénom document ({prenom_doc_brut.upper().strip()}) ≠ Prénom profil ({prenom_profil_brut.upper().strip()})"
            )
    
    # ── Résultat ──
    if incoherences:
        journal.warning(
            f"Incohérence identité détectée : utilisateur={utilisateur.id}, "
            f"incoherences={incoherences}"
        )
        return ResultatCoherence(
            est_coherent=False,
            mode="citoyen",
            message="Incohérence détectée : " + "; ".join(incoherences) + ". Veuillez corriger votre nom/prénom dans vos paramètres avant de scanner.",
            incoherences=incoherences,
        )
    
    journal.info(f"Cohérence identité vérifiée : utilisateur={utilisateur.id}")
    return ResultatCoherence(
        est_coherent=True,
        mode="citoyen",
        message="Identité cohérente avec le profil.",
    )


def _extraire_premier_prenom(prenoms_complets: str) -> str:
    """Extrait le premier prénom d'une chaîne."""
    if not prenoms_complets:
        return ""
    return prenoms_complets.strip().split()[0]