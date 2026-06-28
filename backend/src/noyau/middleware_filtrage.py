# -*- coding: utf-8 -*-
"""
Middleware de filtrage automatique — Cloisonnement des données par domaine/département.

Ce module fournit des fonctions pour filtrer automatiquement les requêtes SQL
selon le rôle et le domaine/département de l'utilisateur.

Architecture:
    - Super Admin: pas de filtre (accès total)
    - Admin Domaine: WHERE domaine_id = X
    - Chef/Agent: WHERE domaine_id = X AND departement_id = Y
"""
from typing import TypeVar
from uuid import UUID

from sqlalchemy import Select, and_
from sqlalchemy.orm import InstrumentedAttribute

from src.noyau.constantes_roles import (
    RoleUtilisateur, ROLES_SUPER_ADMIN, ROLES_ADMIN_DOMAINE,
    ROLES_CHEF, ROLES_AGENT
)

ModelType = TypeVar("ModelType")


def filtrer_par_domaine_et_departement(
    query: Select,
    modele: type[ModelType],
    utilisateur_role: str,
    utilisateur_domaine_id: UUID | None,
    utilisateur_departement_id: UUID | None,
    champ_domaine: InstrumentedAttribute | None = None,
    champ_departement: InstrumentedAttribute | None = None,
) -> Select:
    """
    Applique un filtrage automatique sur une requête SQL selon le rôle.
    
    Args:
        query: Requête SQLAlchemy à filtrer
        modele: Modèle SQLAlchemy (ex: VerificationPolice)
        utilisateur_role: Rôle de l'utilisateur
        utilisateur_domaine_id: Domaine de l'utilisateur
        utilisateur_departement_id: Département de l'utilisateur
        champ_domaine: Champ du modèle pour le domaine (défaut: modele.domaine_id)
        champ_departement: Champ du modèle pour le département (défaut: modele.departement_id)
    
    Returns:
        Requête filtrée
    
    Raises:
        ValueError: Si les champs ne sont pas trouvés dans le modèle
    
    Exemple:
        query = select(VerificationPolice)
        query = filtrer_par_domaine_et_departement(
            query=query,
            modele=VerificationPolice,
            utilisateur_role="chef_police",
            utilisateur_domaine_id=domaine_id,
            utilisateur_departement_id=departement_id,
        )
    """
    # Super Admin — pas de filtre
    if utilisateur_role in ROLES_SUPER_ADMIN:
        return query
    
    # Déterminer les champs à utiliser
    if champ_domaine is None:
        if not hasattr(modele, "domaine_id"):
            raise ValueError(
                f"Le modèle {modele.__name__} n'a pas de champ 'domaine_id'. "
                f"Spécifiez-le explicitement avec le paramètre 'champ_domaine'."
            )
        champ_domaine = modele.domaine_id
    
    # Admin Domaine — filtre par domaine
    if utilisateur_role in ROLES_ADMIN_DOMAINE:
        if utilisateur_domaine_id is None:
            raise ValueError(
                "Admin de Domaine sans domaine_id — configuration invalide"
            )
        return query.where(champ_domaine == utilisateur_domaine_id)
    
    # Chef et Agent — filtre par domaine ET département
    if utilisateur_role in ROLES_CHEF or utilisateur_role in ROLES_AGENT:
        if utilisateur_domaine_id is None or utilisateur_departement_id is None:
            raise ValueError(
                "Chef/Agent sans domaine_id ou departement_id — configuration invalide"
            )
        
        if champ_departement is None:
            if not hasattr(modele, "departement_id"):
                raise ValueError(
                    f"Le modèle {modele.__name__} n'a pas de champ 'departement_id'. "
                    f"Spécifiez-le explicitement avec le paramètre 'champ_departement'."
                )
            champ_departement = modele.departement_id
        
        return query.where(
            and_(
                champ_domaine == utilisateur_domaine_id,
                champ_departement == utilisateur_departement_id,
            )
        )
    
    # Citoyen — pas de filtre automatique (géré au niveau service)
    if utilisateur_role == RoleUtilisateur.CITOYEN:
        return query
    
    # Rôle inconnu — pas de filtre (comportement par défaut)
    return query


def verifier_acces_ressource(
    utilisateur_role: str,
    utilisateur_domaine_id: UUID | None,
    utilisateur_departement_id: UUID | None,
    ressource_domaine_id: UUID | None,
    ressource_departement_id: UUID | None,
) -> bool:
    """
    Vérifie si un utilisateur peut accéder à une ressource spécifique.
    
    Args:
        utilisateur_role: Rôle de l'utilisateur
        utilisateur_domaine_id: Domaine de l'utilisateur
        utilisateur_departement_id: Département de l'utilisateur
        ressource_domaine_id: Domaine de la ressource
        ressource_departement_id: Département de la ressource
    
    Returns:
        True si l'accès est autorisé, False sinon
    """
    # Super Admin — accès total
    if utilisateur_role in ROLES_SUPER_ADMIN:
        return True
    
    # Admin Domaine — accès à son domaine
    if utilisateur_role in ROLES_ADMIN_DOMAINE:
        return (
            ressource_domaine_id is None
            or utilisateur_domaine_id == ressource_domaine_id
        )
    
    # Chef/Agent — accès à son département
    if utilisateur_role in ROLES_CHEF or utilisateur_role in ROLES_AGENT:
        return (
            utilisateur_domaine_id == ressource_domaine_id
            and utilisateur_departement_id == ressource_departement_id
        )
    
    # Citoyen — accès à ses propres données (géré ailleurs)
    if utilisateur_role == RoleUtilisateur.CITOYEN:
        return True
    
    return False


def construire_filtre_utilisateur(
    modele: type[ModelType],
    utilisateur_role: str,
    utilisateur_id: UUID,
    utilisateur_domaine_id: UUID | None,
    utilisateur_departement_id: UUID | None,
) -> list:
    """
    Construit une liste de conditions WHERE pour filtrer les données.
    
    Utile pour les requêtes complexes où filtrer_par_domaine_et_departement
    ne suffit pas.
    
    Returns:
        Liste de conditions SQLAlchemy à combiner avec and_()
    
    Exemple:
        conditions = construire_filtre_utilisateur(...)
        query = query.where(and_(*conditions))
    """
    conditions = []
    
    # Super Admin — pas de filtre
    if utilisateur_role in ROLES_SUPER_ADMIN:
        return conditions
    
    # Admin Domaine — filtre par domaine
    if utilisateur_role in ROLES_ADMIN_DOMAINE:
        if hasattr(modele, "domaine_id"):
            conditions.append(modele.domaine_id == utilisateur_domaine_id)
        return conditions
    
    # Chef/Agent — filtre par domaine + département
    if utilisateur_role in ROLES_CHEF or utilisateur_role in ROLES_AGENT:
        if hasattr(modele, "domaine_id"):
            conditions.append(modele.domaine_id == utilisateur_domaine_id)
        if hasattr(modele, "departement_id"):
            conditions.append(modele.departement_id == utilisateur_departement_id)
        return conditions
    
    # Citoyen — filtre par utilisateur_id
    if utilisateur_role == RoleUtilisateur.CITOYEN:
        if hasattr(modele, "utilisateur_id"):
            conditions.append(modele.utilisateur_id == utilisateur_id)
        return conditions
    
    return conditions