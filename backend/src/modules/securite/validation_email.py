# -*- coding: utf-8 -*-
"""
Validation des emails institutionnels pour les rôles sensibles.

Chaque rôle institutionnel a des domaines email autorisés.
Un médecin doit avoir un email en `.sante.sn`, un policier en `.police.sn`, etc.

Cela empêche un utilisateur lambda de s'inscrire avec un rôle institutionnel
en utilisant un email Gmail personnel.
"""
import re
from typing import Optional

from src.config.constantes import RolesUtilisateur


# ==============================================================================
# Domaines autorisés par rôle institutionnel
# ==============================================================================
# Format : domaine ou motif regex partiel
# Les motifs sont testés en fin d'email (suffixe)

DOMAINES_INSTITUTIONNELS: dict[str, list[str]] = {
    RolesUtilisateur.MEDECIN.value: [
        "sante.sn",
        "hopital.sn",
        "medecin.sn",
        "doctor.sn",
        "clinique.sn",
        "chu.sn",
        "centre-sante.sn",
    ],
    RolesUtilisateur.POLICE.value: [
        "police.sn",
        "interieur.gouv.sn",
        "securite.gouv.sn",
        "gendarmerie.sn",
    ],
    RolesUtilisateur.AGENT.value: [
        "administration.sn",
        "gouv.sn",
        "fonction-publique.sn",
        "etat-civil.sn",
        "impots.sn",
        "prestation.sn",
    ],
    RolesUtilisateur.ONG.value: [
        "ong.sn",
        "asso.sn",
        "org.sn",
        "humanitaire.sn",
    ],
}

# Domaines grand public TOUJOURS refusés pour les rôles institutionnels
DOMAINES_BANNIS: list[str] = [
    "gmail.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "icloud.com",
    "protonmail.com",
    "mail.com",
    "yandex.com",
    "aol.com",
]


def _domaine_email(email: str) -> str:
    """Extrait le domaine d'un email (tout après le @)."""
    partie = email.split("@")
    if len(partie) != 2:
        return ""
    return partie[1].strip().lower()


def _domaine_est_banni(domaine: str) -> bool:
    """Vérifie si le domaine est dans la liste des domaines bannis."""
    for banni in DOMAINES_BANNIS:
        if domaine == banni or domaine.endswith("." + banni):
            return True
    return False


def _domaine_correspond_a_role(domaine: str, role: str) -> bool:
    """Vérifie si le domaine correspond à un rôle institutionnel donné."""
    domaines_autorises = DOMAINES_INSTITUTIONNELS.get(role, [])
    for autorise in domaines_autorises:
        # Vérifie si le domaine se termine par le suffixe autorisé
        if domaine == autorise or domaine.endswith("." + autorise):
            return True
    return False


def valider_email_institutionnel(
    email: str,
    role_cible: str,
) -> tuple[bool, Optional[str]]:
    """
    Valide qu'un email est compatible avec un rôle institutionnel.

    Args :
        email : L'adresse email à valider.
        role_cible : Le rôle que l'utilisateur veut obtenir.

    Returns :
        Tuple (est_valide, raison).
        Si est_valide = True, le changement peut continuer.
        Si est_valide = False, raison explique pourquoi.
    """
    # Si le rôle n'est pas institutionnel, pas de vérification
    if role_cible not in DOMAINES_INSTITUTIONNELS:
        return True, None

    domaine = _domaine_email(email)
    if not domaine:
        return False, "Email invalide : impossible d'extraire le domaine."

    # Vérifier les domaines bannis
    if _domaine_est_banni(domaine):
        return (
            False,
            f"Domaine '{domaine}' non autorisé pour le rôle '{role_cible}'. "
            f"Utilise un email professionnel/institutionnel.",
        )

    # Vérifier la correspondance avec le rôle
    if not _domaine_correspond_a_role(domaine, role_cible):
        domaines_attendus = DOMAINES_INSTITUTIONNELS.get(role_cible, [])
        return (
            False,
            f"Le domaine '{domaine}' n'est pas reconnu pour le rôle '{role_cible}'. "
            f"Domaines acceptés : {', '.join(domaines_attendus)}.",
        )

    return True, None


def suggerer_role_depuis_email(email: str) -> Optional[str]:
    """
    Suggère un rôle institutionnel basé sur le domaine de l'email.

    Utile pour l'interface d'inscription : si l'utilisateur saisit un email
    en `.sante.sn`, on peut lui suggérer le rôle 'medecin'.

    Returns :
        Le nom du rôle suggéré, ou None si aucun rôle ne correspond.
    """
    domaine = _domaine_email(email)
    if not domaine:
        return None

    for role, domaines in DOMAINES_INSTITUTIONNELS.items():
        for autorise in domaines:
            if domaine == autorise or domaine.endswith("." + autorise):
                return role

    return None
