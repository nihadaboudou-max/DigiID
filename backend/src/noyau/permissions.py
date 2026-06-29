# -*- coding: utf-8 -*-
"""
Système de permissions — Contrôle d'accès basé sur les rôles et le cloisonnement.

Architecture:
    1. Permissions par rôle (RBAC)
    2. Filtrage automatique par domaine/département
    3. Exceptions explicites (super_admin bypass)
"""
from functools import wraps
from typing import Any, Callable, TypeVar
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.noyau.constantes_roles import (
    RoleUtilisateur, ROLES_SUPER_ADMIN, ROLES_ADMIN_DOMAINE,
    ROLES_CHEF, ROLES_AGENT, obtenir_niveau_hierarchie
)

T = TypeVar("T")


# ─── Matrice de permissions ──────────────────────────────────────────

PERMISSIONS_PAR_ROLE: dict[str, frozenset[str]] = {
    # Super Admin — accès total
    RoleUtilisateur.SUPER_ADMIN: frozenset({"*"}),
    
    # Admin Domaine — accès total dans son domaine
    RoleUtilisateur.ADMIN_DOMAINE: frozenset({
        "domaine.lire", "domaine.ecrire", "domaine.supprimer",
        "departement.lire", "departement.ecrire", "departement.supprimer",
        "utilisateur.lire", "utilisateur.ecrire", "utilisateur.supprimer",
        "invitation.envoyer", "invitation.lire",
        "audit.lire", "statistiques.lire",
        "equipe.lire", "equipe.ecrire", "equipe.supprimer",
    }),
    
    # Chefs de Département — accès dans leur département
    RoleUtilisateur.CHEF_POLICE: frozenset({
        "equipe.lire", "equipe.ecrire", "equipe.supprimer",
        "police.lire", "police.ecrire",
        "verification.lire", "verification.ecrire",
        "signalement.lire", "signalement.ecrire",
        "statistiques.departement",
        "equipe.lire", "equipe.ecrire", "equipe.supprimer",
    }),
    RoleUtilisateur.CHEF_MEDICAL: frozenset({
        "equipe.lire", "equipe.ecrire", "equipe.supprimer",
        "medical.lire", "medical.ecrire",
        "dossier.lire", "dossier.ecrire",
        "statistiques.departement",
        "equipe.lire", "equipe.ecrire", "equipe.supprimer", 
    }),
    RoleUtilisateur.CHEF_ONG: frozenset({
        "equipe.lire", "equipe.ecrire", "equipe.supprimer",
        "ong.lire", "ong.ecrire",
        "beneficiaire.lire", "beneficiaire.ecrire",
        "statistiques.departement",
        "equipe.lire", "equipe.ecrire", "equipe.supprimer",
    }),
    RoleUtilisateur.CHEF_AGENT: frozenset({
        "equipe.lire", "equipe.ecrire", "equipe.supprimer",
        "agent.lire", "agent.ecrire",
        "enrolement.lire", "enrolement.ecrire",
        "statistiques.departement",
        "equipe.lire", "equipe.ecrire", "equipe.supprimer",
    }),
    
    # Agents Terrain — accès limité
    RoleUtilisateur.AGENT_POLICE: frozenset({
        "police.lire", "police.ecrire",
        "verification.lire", "verification.ecrire",
    }),
    RoleUtilisateur.AGENT_MEDICAL: frozenset({
        "medical.lire", "medical.ecrire",
        "dossier.lire", "dossier.ecrire",
    }),
    RoleUtilisateur.AGENT_ONG: frozenset({
        "ong.lire",
        "beneficiaire.lire", "beneficiaire.ecrire",
    }),
    RoleUtilisateur.AGENT_TERRAIN: frozenset({
        "agent.lire", "agent.ecrire",
        "enrolement.lire", "enrolement.ecrire",
    }),
    
    # Citoyen — accès à ses propres données uniquement
    RoleUtilisateur.CITOYEN: frozenset({
        "profil.lire", "profil.ecrire",
        "documents.lire", "documents.ecrire",
        "attestations.lire",
    }),
    
}

# ─── Fonctions de vérification ───────────────────────────────────────
def a_permission(role: str, permission: str) -> bool:
    """
    Vérifie si un rôle a une permission spécifique.

    Args:
        role: Rôle de l'utilisateur (ex: "super_administrateur" ou "super_admin")
        permission: Permission demandée (ex: "domaine.lire")

    Returns:
        True si l'utilisateur a la permission, False sinon
    """
    # ✅ Normalisation : accepter les deux variantes du super admin
    roles_super_admin_compatibles = {"super_admin", "super_administrateur"}
    if role in roles_super_admin_compatibles:
        return True

    permissions_role = PERMISSIONS_PAR_ROLE.get(role, frozenset())

    # Super Admin a toutes les permissions (fallback)
    if "*" in permissions_role:
        return True

    return permission in permissions_role

def peut_acceder_a(
    role_utilisateur: str,
    domaine_utilisateur: UUID | None,
    departement_utilisateur: UUID | None,
    domaine_cible: UUID | None,
    departement_cible: UUID | None,
) -> bool:
    """Vérifie si un utilisateur peut accéder à une ressource cible."""
    # ✅ Normalisation : accepter les deux variantes du super admin
    roles_super_admin_compatibles = {"super_admin", "super_administrateur"}
    if role_utilisateur in roles_super_admin_compatibles:
        return True
    """
    Vérifie si un utilisateur peut accéder à une ressource cible.
    
    Règles:
        - Super Admin: accès total
        - Admin Domaine: accès à tout son domaine
        - Chef: accès à son département uniquement
        - Agent: accès à son département uniquement
        - Citoyen: accès à ses propres données uniquement
    
    Args:
        role_utilisateur: Rôle de l'utilisateur
        domaine_utilisateur: Domaine de l'utilisateur
        departement_utilisateur: Département de l'utilisateur
        domaine_cible: Domaine de la ressource cible
        departement_cible: Département de la ressource cible
    
    Returns:
        True si l'accès est autorisé, False sinon
    """
    # Super Admin — accès total
    if role_utilisateur in ROLES_SUPER_ADMIN:
        return True
    
    # Admin Domaine — accès à tout son domaine
    if role_utilisateur in ROLES_ADMIN_DOMAINE:
        if domaine_cible is None:
            return True  # Ressource sans domaine (ex: stats globales)
        return domaine_utilisateur == domaine_cible
    
    # Chef et Agent — accès à leur département uniquement
    if role_utilisateur in ROLES_CHEF or role_utilisateur in ROLES_AGENT:
        if departement_cible is None:
            return False  # Ressource sans département = refus
        return (
            domaine_utilisateur == domaine_cible
            and departement_utilisateur == departement_cible
        )
    
    # Citoyen — accès à ses propres données (géré au niveau service)
    if role_utilisateur == RoleUtilisateur.CITOYEN:
        return True  # Le filtrage se fait au niveau des requêtes
    
    return False


def niveau_acces_requis(resource: str) -> int:
    """
    Retourne le niveau hiérarchique minimum requis pour accéder à une ressource.
    
    Niveaux:
        1: super_admin uniquement
        2: admin_domaine ou supérieur
        3: chef ou supérieur
        4: agent ou supérieur
        5: tout le monde (y compris citoyen)
    """
    niveaux = {
        "super_admin.*": 1,
        "domaine.*": 2,
        "departement.*": 2,
        "equipe.*": 3,
        "police.*": 4,
        "medical.*": 4,
        "ong.*": 4,
        "agent.*": 4,
        "profil.*": 5,
        "documents.*": 5,
    }
    return niveaux.get(resource, 5)


# ─── Décorateurs ─────────────────────────────────────────────────────

def require_permission(permission: str) -> Callable:
    """
    Décorateur pour vérifier qu'un utilisateur a une permission.
    
    Usage:
        @require_permission("police.ecrire")
        async def creer_verification(...):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Récupérer l'utilisateur courant (injecté par dépendance)
            utilisateur = kwargs.get("utilisateur_courant")
            if not utilisateur:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Utilisateur courant non disponible",
                )
            
            if not a_permission(utilisateur.role, permission):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission '{permission}' requise",
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def require_niveau_minimum(niveau: int) -> Callable:
    """
    Décorateur pour vérifier le niveau hiérarchique minimum.
    
    Usage:
        @require_niveau_minimum(2)  # Admin Domaine ou supérieur
        async def supprimer_domaine(...):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            utilisateur = kwargs.get("utilisateur_courant")
            if not utilisateur:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Utilisateur courant non disponible",
                )
            
            niveau_utilisateur = obtenir_niveau_hierarchie(utilisateur.role)
            if niveau_utilisateur > niveau:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Niveau {niveau} ou supérieur requis",
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator