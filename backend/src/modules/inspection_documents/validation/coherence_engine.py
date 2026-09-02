# -*- coding: utf-8 -*-
"""
Moteur de vérification de cohérence d'identité.
Compare les données du document avec le profil utilisateur.
Gère deux modes : citoyen (comparaison stricte) et agent terrain (pas de comparaison).
"""
from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from src.modeles import Utilisateur
from src.modules.inspection_documents.schemas import (
    DonneesDocumentExtraites,
    ResultatCoherence,
)
from src.noyau import journal, dechiffrer_donnee


async def verifier_coherence_identite(
    session: AsyncSession,
    utilisateur: Utilisateur,
    nouvelles_donnees: DonneesDocumentExtraites,
    utilisateur_cible_id: Optional[UUID] = None,
) -> ResultatCoherence:
    """
    Vérifie la cohérence entre le document et le profil utilisateur.
    
    Deux modes :
    - Citoyen : comparaison stricte Nom/Prénom avec le profil
    - Agent terrain : pas de comparaison (l'agent enrôle un tiers)
    
    Args:
        session: Session DB
        utilisateur: Utilisateur connecté (celui qui upload)
        nouvelles_donnees: Données extraites du document
        utilisateur_cible_id: UUID de l'utilisateur cible (si agent terrain)
    
    Returns:
        ResultatCoherence avec statut et message
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
    
    # ── Mode citoyen : comparaison stricte ──
    incoherences = []
    
    # 1. Comparaison Nom
    nom_utilisateur = dechiffrer_donnee(utilisateur.nom_chiffre) if utilisateur.nom_chiffre else ""
    if nom_utilisateur and nouvelles_donnees.nom_famille:
        nom_doc = nouvelles_donnees.nom_famille.upper().strip()
        nom_profil = nom_utilisateur.upper().strip()
        if nom_profil != nom_doc:
            incoherences.append(
                f"Nom document ({nom_doc}) ≠ Nom profil ({nom_profil})"
            )
    
    # 2. Comparaison Prénom (premier prénom uniquement)
    prenom_utilisateur = dechiffrer_donnee(utilisateur.prenom_chiffre) if utilisateur.prenom_chiffre else ""
    if prenom_utilisateur and nouvelles_donnees.prenoms:
        prenom_doc = _extraire_premier_prenom(nouvelles_donnees.prenoms).upper()
        prenom_profil = _extraire_premier_prenom(prenom_utilisateur).upper()
        if prenom_profil != prenom_doc:
            incoherences.append(
                f"Prénom document ({prenom_doc}) ≠ Prénom profil ({prenom_profil})"
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
            message="Incohérence détectée : " + "; ".join(incoherences),
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