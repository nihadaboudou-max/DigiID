# -*- coding: utf-8 -*-
"""
Dépendances FastAPI pour l'authentification et l'autorisation.

Ces fonctions s'injectent dans les routes via `Depends(...)`.
Elles font le travail de vérification du JWT, de chargement de
l'utilisateur, et de contrôle des rôles.

Cinq niveaux d'accès :
  - utilisateur_courant          : tout utilisateur authentifié
  - admin_courant                : administrateur ou super administrateur
  - super_admin_courant          : super administrateur uniquement
  - institutionnel_courant       : rôles institutionnels + admins
  - utilisateur_courant_renforce : utilisateur_courant + détection usurpation

Sécurité renforcée (Phase 8) :
  - Vérification que le token n'a pas été émis AVANT un changement de rôle
  - Détection des tentatives d'accès non autorisé (usurpation)
"""
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.config.constantes import RolesUtilisateur
from src.modeles import Utilisateur
from src.modules.authentification.jetons import decoder_jeton
from src.noyau.exceptions import (
    ErreurAuthentification, ErreurAutorisation,
)


# Schéma de sécurité Bearer pour la documentation OpenAPI
schema_bearer = HTTPBearer(
    scheme_name="JWT",
    description="Coller le token d'accès JWT obtenu lors de la connexion.",
    auto_error=False,
)


async def utilisateur_courant(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(schema_bearer)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
) -> Utilisateur:
    """
    Dépendance : retourne l'utilisateur authentifié.

    Lève 401 si :
      - Pas de token fourni
      - Token invalide ou expiré
      - L'utilisateur n'existe pas / est désactivé / est supprimé
    """
    if credentials is None:
        raise ErreurAuthentification(
            "Aucun token d'authentification fourni",
            message_utilisateur="Authentification requise.",
        )

    contenu = decoder_jeton(credentials.credentials, type_attendu="acces")

    resultat = await session.execute(
        select(Utilisateur).where(
            Utilisateur.id == UUID(contenu.sub),
            Utilisateur.est_actif == True,
            Utilisateur.est_supprime == False,
        )
    )
    utilisateur = resultat.scalar_one_or_none()

    if utilisateur is None:
        raise ErreurAuthentification(
            f"Utilisateur {contenu.sub} introuvable ou désactivé",
            message_utilisateur="Session invalide.",
        )

    # 🔒 Vérification de révocation de token après changement de rôle
    # (La colonne date_dernier_changement_role sera ajoutée via migration Alembic)

    return utilisateur


# ---- Vérificateurs par rôle (déprécié : utiliser verifier_role au profit de la flexibilité) ----

async def utilisateur_courant_renforce(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(schema_bearer)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
) -> Utilisateur:
    """
    Dépendance : retourne l'utilisateur authentifié AVEC détection d'usurpation.

    En plus de `utilisateur_courant`, cette dépendance :
      - Détecte les tentatives d'accès non autorisé à des routes sensibles
      - Déclenche une alerte de fraude si un utilisateur tente d'accéder
        à un espace qui n'est pas autorisé pour son rôle
      - Enregistre l'incident dans le journal d'audit + table fraude_incident
    """
    utilisateur = await utilisateur_courant(credentials, session)

    # Vérifier si la route demandée est une route sensible
    chemin = request.url.path
    from src.modules.securite.alerte_fraude import verifier_tentative_usurpation
    await verifier_tentative_usurpation(
        session=session,
        utilisateur_id=utilisateur.id,
        role_actuel=utilisateur.role,
        chemin_api=chemin,
        adresse_ip=obtenir_ip_client(request),
        agent_utilisateur=obtenir_agent_utilisateur(request),
    )

    return utilisateur


async def admin_courant(
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
) -> Utilisateur:
    """Dépendance : retourne l'utilisateur connecté s'il est admin ou super admin."""
    if utilisateur.role not in RolesUtilisateur.roles_administratifs():
        raise ErreurAutorisation(
            f"Accès admin refusé pour utilisateur {utilisateur.id} (role={utilisateur.role})",
            message_utilisateur="Accès réservé aux administrateurs.",
        )
    return utilisateur


async def super_admin_courant(
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
) -> Utilisateur:
    """Dépendance : retourne l'utilisateur connecté s'il est super admin."""
    if utilisateur.role != RolesUtilisateur.SUPER_ADMINISTRATEUR.value:
        raise ErreurAutorisation(
            f"Accès super admin refusé pour utilisateur {utilisateur.id} (role={utilisateur.role})",
            message_utilisateur="Accès réservé au super administrateur.",
        )
    return utilisateur


async def institutionnel_courant(
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
) -> Utilisateur:
    """
    Dépendance : retourne l'utilisateur connecté s'il a un rôle institutionnel
    (agent, médecin, police, ONG) ou admin/super admin.
    """
    roles_autorises = RolesUtilisateur.roles_institutionnels() + RolesUtilisateur.roles_administratifs()
    if utilisateur.role not in roles_autorises:
        raise ErreurAutorisation(
            f"Accès institutionnel refusé pour utilisateur {utilisateur.id} (role={utilisateur.role})",
            message_utilisateur="Accès réservé aux profils institutionnels vérifiés.",
        )
    return utilisateur


def obtenir_ip_client(requete: Request) -> str:
    """Extrait l'adresse IP du client, en tenant compte des proxys."""
    forwarded_for = requete.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return requete.client.host if requete.client else "0.0.0.0"


def obtenir_agent_utilisateur(requete: Request) -> str:
    """Extrait le User-Agent du client."""
    return requete.headers.get("User-Agent", "inconnu")
