# -*- coding: utf-8 -*-
"""
Détection et enregistrement des tentatives d'usurpation de rôle.

Un citoyen qui tente d'accéder à /api/v1/admin/* = alerte.
Un agent qui tente d'accéder à /api/v1/super-admin/* = alerte.

Ces alertes sont :
  1. Journalisées dans la table `fraude_incident`
  2. Enregistrées dans le journal d'audit
  3. Logguées au niveau WARNING dans les logs applicatifs
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.constantes import RolesUtilisateur
from src.modeles import FraudeIncident, JournalAudit
from src.noyau import journal


# ==============================================================================
# Routes sensibles par niveau de rôle
# ==============================================================================

ROUTES_SENSIBLES: dict[str, str] = {
    "/api/v1/admin/": "ESPACE_ADMIN",
    "/api/v1/super-admin/": "ESPACE_SUPER_ADMIN",
}

# Rôles autorisés par espace
ACCES_PAR_ESPACE: dict[str, list[str]] = {
    "ESPACE_ADMIN": RolesUtilisateur.roles_administratifs(),  # admin, super_admin
    "ESPACE_SUPER_ADMIN": [RolesUtilisateur.SUPER_ADMINISTRATEUR.value],  # super_admin uniquement
}

# Score de risque par niveau de violation
SCORE_RISQUE_USURPATION: dict[str, int] = {
    "citoyen_tente_admin": 70,
    "citoyen_tente_super_admin": 90,
    "institutionnel_tente_super_admin": 80,
    "admin_tente_super_admin": 60,
}


def _calculer_score_risque(role_actuel: str, espace_tente: str) -> int:
    """Calcule un score de risque pour une tentative d'accès non autorisé."""
    if espace_tente == "ESPACE_SUPER_ADMIN":
        if role_actuel == RolesUtilisateur.CITOYEN.value:
            return SCORE_RISQUE_USURPATION["citoyen_tente_super_admin"]
        elif role_actuel in RolesUtilisateur.roles_institutionnels():
            return SCORE_RISQUE_USURPATION["institutionnel_tente_super_admin"]
        elif role_actuel == RolesUtilisateur.ADMINISTRATEUR.value:
            return SCORE_RISQUE_USURPATION["admin_tente_super_admin"]
    elif espace_tente == "ESPACE_ADMIN":
        if role_actuel == RolesUtilisateur.CITOYEN.value:
            return SCORE_RISQUE_USURPATION["citoyen_tente_admin"]
    return 50  # Risque modéré par défaut


def _detecter_espace_sensible(chemin: str) -> Optional[str]:
    """Détecte si un chemin API correspond à un espace sensible."""
    for prefixe, nom_espace in ROUTES_SENSIBLES.items():
        if chemin.startswith(prefixe):
            return nom_espace
    return None


async def verifier_tentative_usurpation(
    session: AsyncSession,
    utilisateur_id: UUID,
    role_actuel: str,
    chemin_api: str,
    adresse_ip: Optional[str] = None,
    agent_utilisateur: Optional[str] = None,
) -> bool:
    """
    Vérifie si une requête constitue une tentative d'usurpation.

    Retourne True si une alerte a été déclenchée, False sinon.

    Conditions d'alerte :
      - Un citoyen accède à /api/v1/admin/
      - Un citoyen accède à /api/v1/super-admin/
      - Un non-admin accède à /api/v1/super-admin/
    """
    espace_sensible = _detecter_espace_sensible(chemin_api)
    if espace_sensible is None:
        return False  # Route non sensible, pas de vérification

    # Vérifier si le rôle est autorisé pour cet espace
    roles_autorises = ACCES_PAR_ESPACE.get(espace_sensible, [])
    if role_actuel in roles_autorises:
        return False  # Accès autorisé

    # === TENTATIVE D'USURPATION DÉTECTÉE ===
    score_risque = _calculer_score_risque(role_actuel, espace_sensible)

    description = (
        f"Tentative d'accès non autorisé : utilisateur={utilisateur_id} "
        f"(role={role_actuel}) a tenté d'accéder à {espace_sensible} "
        f"via {chemin_api} depuis {adresse_ip or 'IP inconnue'}"
    )

    # 1. Enregistrer dans le journal d'audit
    entree_audit = JournalAudit(
        date_evenement=datetime.now(timezone.utc),
        utilisateur_id=utilisateur_id,
        role_acteur=role_actuel,
        type_evenement="tentative_intrusion",
        description=description,
        adresse_ip=adresse_ip,
        agent_utilisateur=agent_utilisateur,
        score_risque=score_risque,
        donnees_supplementaires={
            "chemin_api": chemin_api,
            "espace_sensible": espace_sensible,
            "roles_autorises": roles_autorises,
            "type_detection": "usurpation_role",
        },
    )
    session.add(entree_audit)

    # 2. Enregistrer dans la table des incidents de fraude
    incident = FraudeIncident(
        utilisateur_id=utilisateur_id,
        type_incident="tentative_usurpation_role",
        niveau_risque=score_risque,
        description=description,
        adresse_ip=adresse_ip,
        agent_utilisateur=agent_utilisateur,
        donnees_contexte={
            "chemin_api": chemin_api,
            "espace_sensible": espace_sensible,
            "role_actuel": role_actuel,
            "roles_autorises": roles_autorises,
        },
    )
    session.add(incident)
    await session.flush()

    # 3. Log applicatif
    journal.warning(
        f"[FRAUDE] Tentative d'usurpation rôle={role_actuel} → {espace_sensible} "
        f"| user={utilisateur_id} | ip={adresse_ip} | score={score_risque}"
    )

    return True


async def enregistrer_alerte_fraude(
    session: AsyncSession,
    type_incident: str,
    description: str,
    utilisateur_id: Optional[UUID] = None,
    role_acteur: Optional[str] = None,
    adresse_ip: Optional[str] = None,
    agent_utilisateur: Optional[str] = None,
    score_risque: int = 50,
    donnees_contexte: Optional[dict] = None,
) -> FraudeIncident:
    """
    Enregistre une alerte de fraude dans le système.

    Utilisé pour :
      - Tentative de modification non autorisée du rôle
      - Changement suspect d'email
      - Pattern d'accès anormal
      - Multiples échecs d'authentification
    """
    # Audit
    entree = JournalAudit(
        date_evenement=datetime.now(timezone.utc),
        utilisateur_id=utilisateur_id,
        role_acteur=role_acteur,
        type_evenement="alerte_fraude",
        description=description,
        adresse_ip=adresse_ip,
        agent_utilisateur=agent_utilisateur,
        score_risque=score_risque,
        donnees_supplementaires=donnees_contexte,
    )
    session.add(entree)

    # Incident
    incident = FraudeIncident(
        utilisateur_id=utilisateur_id,
        type_incident=type_incident,
        niveau_risque=score_risque,
        description=description,
        adresse_ip=adresse_ip,
        agent_utilisateur=agent_utilisateur,
        donnees_contexte=donnees_contexte,
    )
    session.add(incident)
    await session.flush()

    journal.warning(
        f"[ALERTE FRAUDE] {type_incident} | user={utilisateur_id} | "
        f"ip={adresse_ip} | score={score_risque}"
    )

    return incident
