# -*- coding: utf-8 -*-
"""
Constantes des rôles — Hiérarchie complète des rôles du système.

Hiérarchie (du plus élevé au plus bas):
    1. super_admin          — Super Admin Global (infra)
    2. admin_domaine        — Admin de Domaine (gouverneur)
    3. chef_*               — Chefs de Département (police, medical, ong, agent)
    4. agent_*              — Agents terrain (police, medical, ong, agent)
    5. citoyen              — Citoyen standard
"""
from enum import Enum
from typing import Final


class RoleUtilisateur(str, Enum):
    """Énumération de tous les rôles du système."""
    
    # ─── Niveau 1 : Infrastructure ───────────────────────────────────
    SUPER_ADMIN = "super_admin"
    
    # ─── Niveau 2 : Administration de Domaine ────────────────────────
    ADMIN_DOMAINE = "admin_domaine"
    
    # ─── Niveau 3 : Chefs de Département ─────────────────────────────
    CHEF_POLICE = "chef_police"
    CHEF_MEDICAL = "chef_medical"
    CHEF_ONG = "chef_ong"
    CHEF_AGENT = "chef_agent"
    
    # ─── Niveau 4 : Agents Terrain ───────────────────────────────────
    AGENT_POLICE = "agent_police"
    AGENT_MEDICAL = "agent_medical"  # Médecin, infirmier
    AGENT_ONG = "agent_ong"  # Bénévole ONG
    AGENT_TERRAIN = "agent_terrain"  # Agent administratif
    
    # ─── Niveau 5 : Citoyen ──────────────────────────────────────────
    CITOYEN = "citoyen"


# ─── Groupes de rôles ────────────────────────────────────────────────

ROLES_SUPER_ADMIN: Final[frozenset] = frozenset({
    RoleUtilisateur.SUPER_ADMIN,
})

ROLES_ADMIN_DOMAINE: Final[frozenset] = frozenset({
    RoleUtilisateur.ADMIN_DOMAINE,
    # Rétrocompatibilité : 'administrateur' legacy a les mêmes droits
    "administrateur",
})

ROLES_CHEF: Final[frozenset] = frozenset({
    RoleUtilisateur.CHEF_POLICE,
    RoleUtilisateur.CHEF_MEDICAL,
    RoleUtilisateur.CHEF_ONG,
    RoleUtilisateur.CHEF_AGENT,
})

ROLES_AGENT: Final[frozenset] = frozenset({
    RoleUtilisateur.AGENT_POLICE,
    RoleUtilisateur.AGENT_MEDICAL,
    RoleUtilisateur.AGENT_ONG,
    RoleUtilisateur.AGENT_TERRAIN,
})

ROLES_CITOYEN: Final[frozenset] = frozenset({
    RoleUtilisateur.CITOYEN,
})

# ─── Groupes fonctionnels ────────────────────────────────────────────

ROLES_POLICE: Final[frozenset] = frozenset({
    RoleUtilisateur.CHEF_POLICE,
    RoleUtilisateur.AGENT_POLICE,
})

ROLES_MEDICAL: Final[frozenset] = frozenset({
    RoleUtilisateur.CHEF_MEDICAL,
    RoleUtilisateur.AGENT_MEDICAL,
})

ROLES_ONG: Final[frozenset] = frozenset({
    RoleUtilisateur.CHEF_ONG,
    RoleUtilisateur.AGENT_ONG,
})

ROLES_AGENT_TERRAIN: Final[frozenset] = frozenset({
    RoleUtilisateur.CHEF_AGENT,
    RoleUtilisateur.AGENT_TERRAIN,
})

# ─── Rôles professionnels (tous sauf citoyen) ────────────────────────

ROLES_PROFESSIONNELS: Final[frozenset] = frozenset({
    RoleUtilisateur.SUPER_ADMIN,
    RoleUtilisateur.ADMIN_DOMAINE,
    RoleUtilisateur.CHEF_POLICE,
    RoleUtilisateur.CHEF_MEDICAL,
    RoleUtilisateur.CHEF_ONG,
    RoleUtilisateur.CHEF_AGENT,
    RoleUtilisateur.AGENT_POLICE,
    RoleUtilisateur.AGENT_MEDICAL,
    RoleUtilisateur.AGENT_ONG,
    RoleUtilisateur.AGENT_TERRAIN,
})

# ─── Tous les rôles ─────────────────────────────────────────────────

TOUS_ROLES: Final[frozenset] = frozenset({role for role in RoleUtilisateur})


# ─── Mapping type département → rôle chef/agent ─────────────────────

TYPE_DEPARTEMENT_VERS_ROLES = {
    "police": {
        "chef": RoleUtilisateur.CHEF_POLICE,
        "agent": RoleUtilisateur.AGENT_POLICE,
    },
    "medical": {
        "chef": RoleUtilisateur.CHEF_MEDICAL,
        "agent": RoleUtilisateur.AGENT_MEDICAL,
    },
    "ong": {
        "chef": RoleUtilisateur.CHEF_ONG,
        "agent": RoleUtilisateur.AGENT_ONG,
    },
    "agent": {
        "chef": RoleUtilisateur.CHEF_AGENT,
        "agent": RoleUtilisateur.AGENT_TERRAIN,
    },
}


# ─── Fonctions utilitaires ───────────────────────────────────────────

def est_role_admin(role: str) -> bool:
    """Vérifie si le rôle est un rôle d'administration."""
    return role in ROLES_SUPER_ADMIN or role in ROLES_ADMIN_DOMAINE


def est_role_chef(role: str) -> bool:
    """Vérifie si le rôle est un rôle de chef de département."""
    return role in ROLES_CHEF


def est_role_agent(role: str) -> bool:
    """Vérifie si le rôle est un rôle d'agent terrain."""
    return role in ROLES_AGENT


def est_role_professionnel(role: str) -> bool:
    """Vérifie si le rôle est un rôle professionnel."""
    return role in ROLES_PROFESSIONNELS


def obtenir_type_departement_depuis_role(role: str) -> str | None:
    """
    Retourne le type de département associé à un rôle.
    
    Exemple:
        "chef_police" → "police"
        "agent_medical" → "medical"
        "citoyen" → None
    """
    for type_dep, roles in TYPE_DEPARTEMENT_VERS_ROLES.items():
        if role in (roles["chef"], roles["agent"]):
            return type_dep
    return None


def obtenir_niveau_hierarchie(role: str) -> int:
    """
    Retourne le niveau hiérarchique d'un rôle (1 = plus élevé).
    
    Niveaux:
        1: super_admin
        2: admin_domaine
        3: chef_*
        4: agent_*
        5: citoyen
    """
    if role in ROLES_SUPER_ADMIN:
        return 1
    if role in ROLES_ADMIN_DOMAINE:
        return 2
    if role in ROLES_CHEF:
        return 3
    if role in ROLES_AGENT:
        return 4
    if role in ROLES_CITOYEN:
        return 5
    return 99  # Rôle inconnu