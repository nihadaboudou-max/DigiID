# -*- coding: utf-8 -*-
"""
Routes API dédiées à l'espace Admin Domaine.

Préfixe : /api/v1/admin-domaine

Contrairement aux routes /api/v1/admin qui servent les admins système
(administrateur, super_administrateur), ici les endpoints sont adaptés
spécifiquement aux besoins des admins de domaine (admin_domaine).

Fonctionnalités :
  - Tableau de bord : KPIs du domaine (chefs, agents, départements)
  - Statistiques : métriques détaillées du domaine
  - Audit : journal filtré par domaine
"""
from datetime import datetime, timezone, timedelta
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.config.constantes import RolesUtilisateur
from src.modeles import Utilisateur, JournalAudit
from src.modeles.departement import Departement
from src.modeles.invitation import Invitation
from src.modules.authentification.dependances import (
    admin_courant, utilisateur_courant, obtenir_ip_client,
)
from src.noyau import dechiffrer_donnee
from src.noyau.permissions import require_permission

routeur_admin_domaine = APIRouter(
    prefix="/api/v1/admin-domaine",
    tags=["Admin Domaine"],
    # admin_courant accepte déjà les rôles admin_domaine, administrateur, super_administrateur
    dependencies=[Depends(admin_courant)],
)


# =============================================================================
# Schémas
# =============================================================================

class StatsTableauDeBord(BaseModel):
    """KPIs du tableau de bord pour l'admin de domaine."""
    chefs_actifs: int = 0
    agents_total: int = 0
    departements_actifs: int = 0
    invitations_en_attente: int = 0


class StatsDomaine(BaseModel):
    """Statistiques détaillées du domaine."""
    total_chefs: int = 0
    chefs_par_type: dict[str, int] = {}
    total_departements: int = 0
    departements_par_type: dict[str, int] = {}
    total_agents: int = 0
    invitations_envoyees: int = 0
    invitations_acceptees: int = 0
    taux_acceptation: int = 0


class EvenementAuditItem(BaseModel):
    """Événement d'audit pour l'admin de domaine."""
    id: str
    date_evenement: str
    type_evenement: str
    description: str
    utilisateur_id: str | None = None
    role_acteur: str | None = None
    adresse_ip: str | None = None


class ListeAuditReponse(BaseModel):
    """Liste paginée des événements d'audit."""
    donnees: list[EvenementAuditItem]
    total: int
    page: int


# =============================================================================
# Utilitaires
# =============================================================================

def _obtenir_domaine_id(utilisateur: Utilisateur) -> UUID:
    """Retourne le domaine_id de l'utilisateur connecté, ou lève une erreur."""
    if not utilisateur.domaine_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucun domaine associé à ton profil. Contacte un super administrateur.",
        )
    return utilisateur.domaine_id


# =============================================================================
# ENDPOINTS
# =============================================================================

@routeur_admin_domaine.get(
    "/tableau-de-bord",
    response_model=StatsTableauDeBord,
    summary="KPIs du tableau de bord pour l'admin de domaine",
)
async def tableau_de_bord_admin_domaine(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(admin_courant)],
):
    """
    Retourne les KPIs du domaine de l'admin connecté :
      - chefs_actifs : nombre de chefs actifs dans le domaine
      - agents_total : nombre total d'agents dans le domaine
      - departements_actifs : nombre de départements actifs
      - invitations_en_attente : invitations en attente pour ce domaine
    """
    domaine_id = _obtenir_domaine_id(utilisateur)

    # Chefs actifs
    chefs_actifs = await session.scalar(
        select(func.count(Utilisateur.id)).where(
            Utilisateur.domaine_id == domaine_id,
            Utilisateur.role.in_(RolesUtilisateur.roles_chefs()),
            Utilisateur.est_actif == True,
            Utilisateur.est_supprime == False,
        )
    )

    # Agents (non-chefs) du domaine
    roles_chefs = RolesUtilisateur.roles_chefs()
    agents_total = await session.scalar(
        select(func.count(Utilisateur.id)).where(
            Utilisateur.domaine_id == domaine_id,
            Utilisateur.role.notin_(roles_chefs),
            Utilisateur.role.notin_([
                RolesUtilisateur.ADMINISTRATEUR.value,
                RolesUtilisateur.SUPER_ADMINISTRATEUR.value,
            ]),
            Utilisateur.est_supprime == False,
        )
    )

    # Départements actifs
    departements_actifs = await session.scalar(
        select(func.count(Departement.id)).where(
            Departement.domaine_id == domaine_id,
            Departement.est_actif == True,
        )
    )

    # Invitations en attente
    invitations_en_attente = await session.scalar(
        select(func.count(Invitation.id)).where(
            Invitation.domaine_id == domaine_id,
            Invitation.statut == "en_attente",
        )
    )

    return StatsTableauDeBord(
        chefs_actifs=chefs_actifs or 0,
        agents_total=agents_total or 0,
        departements_actifs=departements_actifs or 0,
        invitations_en_attente=invitations_en_attente or 0,
    )


@routeur_admin_domaine.get(
    "/statistiques",
    response_model=StatsDomaine,
    summary="Statistiques détaillées du domaine",
)
async def statistiques_admin_domaine(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(admin_courant)],
):
    """
    Retourne les statistiques détaillées du domaine :
      - total_chefs + répartition par type
      - total_départements + répartition par type
      - total_agents
      - invitations (envoyées, acceptées, taux)
    """
    domaine_id = _obtenir_domaine_id(utilisateur)
    roles_chefs = RolesUtilisateur.roles_chefs()

    # Total chefs
    resultat_chefs = await session.execute(
        select(Utilisateur.role, func.count(Utilisateur.id)).where(
            Utilisateur.domaine_id == domaine_id,
            Utilisateur.role.in_(roles_chefs),
            Utilisateur.est_supprime == False,
        ).group_by(Utilisateur.role)
    )
    chefs_par_type = {role: count for role, count in resultat_chefs.all()}
    total_chefs = sum(chefs_par_type.values())

    # Total agents (non-chefs)
    total_agents = await session.scalar(
        select(func.count(Utilisateur.id)).where(
            Utilisateur.domaine_id == domaine_id,
            Utilisateur.role.notin_(roles_chefs),
            Utilisateur.role.notin_([
                RolesUtilisateur.ADMINISTRATEUR.value,
                RolesUtilisateur.SUPER_ADMINISTRATEUR.value,
            ]),
            Utilisateur.est_supprime == False,
        )
    )

    # Départements par type
    resultat_depts = await session.execute(
        select(Departement.type_departement, func.count(Departement.id)).where(
            Departement.domaine_id == domaine_id,
        ).group_by(Departement.type_departement)
    )
    departements_par_type = {type_: count for type_, count in resultat_depts.all()}
    total_departements = sum(departements_par_type.values())

    # Invitations
    invitations_envoyees = await session.scalar(
        select(func.count(Invitation.id)).where(
            Invitation.domaine_id == domaine_id,
        )
    )
    invitations_acceptees = await session.scalar(
        select(func.count(Invitation.id)).where(
            Invitation.domaine_id == domaine_id,
            Invitation.statut == "acceptee",
        )
    )
    total_envoyees = invitations_envoyees or 0
    total_acceptees = invitations_acceptees or 0
    taux = round((total_acceptees / total_envoyees) * 100) if total_envoyees > 0 else 0

    return StatsDomaine(
        total_chefs=total_chefs,
        chefs_par_type=chefs_par_type,
        total_departements=total_departements,
        departements_par_type=departements_par_type,
        total_agents=total_agents or 0,
        invitations_envoyees=total_envoyees,
        invitations_acceptees=total_acceptees,
        taux_acceptation=taux,
    )


@routeur_admin_domaine.get(
    "/audit",
    response_model=ListeAuditReponse,
    summary="Journal d'audit filtré par domaine",
)
@require_permission("audit.lire")
async def audit_admin_domaine(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(admin_courant)],
    limite: int = Query(default=100, ge=1, le=500, description="Nombre max d'événements"),
    domaine_id: UUID | None = Query(
        default=None,
        description="Filtrer par domaine (utilise celui de l'admin par défaut)",
    ),
):
    """
    Retourne les événements d'audit liés au domaine de l'admin.

    Filtre automatiquement par le domaine_id de l'admin connecté.
    """
    domaine_filtre = domaine_id or _obtenir_domaine_id(utilisateur)

    # Récupérer les IDs des utilisateurs du domaine
    utilisateurs_domaine = (await session.execute(
        select(Utilisateur.id).where(
            Utilisateur.domaine_id == domaine_filtre,
            Utilisateur.est_supprime == False,
        )
    )).scalars().all()

    if not utilisateurs_domaine:
        return ListeAuditReponse(donnees=[], total=0, page=1)

    conditions = [JournalAudit.utilisateur_id.in_(utilisateurs_domaine)]

    query = (
        select(JournalAudit)
        .where(and_(*conditions))
        .order_by(JournalAudit.date_evenement.desc())
        .limit(limite)
    )

    result = await session.execute(query)
    evenements = result.scalars().all()

    total = await session.scalar(
        select(func.count(JournalAudit.id)).where(and_(*conditions))
    )

    return ListeAuditReponse(
        donnees=[
            EvenementAuditItem(
                id=str(e.id),
                date_evenement=e.date_evenement.strftime("%Y-%m-%dT%H:%M:%S") if e.date_evenement else "",
                type_evenement=e.type_evenement,
                description=e.description,
                utilisateur_id=str(e.utilisateur_id) if e.utilisateur_id else None,
                role_acteur=e.role_acteur,
                adresse_ip=e.adresse_ip,
            )
            for e in evenements
        ],
        total=total or 0,
        page=1,
    )


@routeur_admin_domaine.get(
    "/chefs",
    summary="Liste des chefs du domaine (pour admin domaine)",
)
async def lister_chefs_domaine(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(admin_courant)],
    role: str | None = Query(None, description="Filtrer par rôle spécifique"),
    domaine_id: UUID | None = Query(None, description="ID du domaine (optionnel)"),
):
    """
    Liste les chefs de département du domaine.
    Compatible avec le format attendu par le frontend admin-domaine/chefs.
    """
    domaine_filtre = domaine_id or _obtenir_domaine_id(utilisateur)

    conditions = [
        Utilisateur.domaine_id == domaine_filtre,
        Utilisateur.role.in_(RolesUtilisateur.roles_chefs()),
        Utilisateur.est_supprime == False,
    ]
    if role:
        conditions.append(Utilisateur.role == role)

    result = await session.execute(
        select(Utilisateur).where(and_(*conditions)).order_by(Utilisateur.cree_le.desc())
    )
    chefs = result.scalars().all()

    # Charger les départements
    dept_ids = [c.departement_id for c in chefs if c.departement_id]
    departements = {}
    if dept_ids:
        dept_result = await session.execute(
            select(Departement).where(Departement.id.in_(dept_ids))
        )
        for d in dept_result.scalars().all():
            departements[str(d.id)] = d.nom

    resultats = []
    for chef in chefs:
        email = dechiffrer_donnee(chef.email_chiffre) if chef.email_chiffre else ""
        prenom = dechiffrer_donnee(chef.prenom_chiffre) if chef.prenom_chiffre else ""
        nom = dechiffrer_donnee(chef.nom_chiffre) if chef.nom_chiffre else ""

        email_masque = email[:1] + "***" + email[email.index("@"):] if "@" in email else email

        resultats.append({
            "id": str(chef.id),
            "prenom_initiale": prenom[0].upper() + "." if prenom else None,
            "nom_initiale": nom[0].upper() + "." if nom else None,
            "email_masque": email_masque,
            "ville": chef.ville,
            "role": chef.role,
            "departement_nom": departements.get(str(chef.departement_id)) if chef.departement_id else None,
            "departement_id": str(chef.departement_id) if chef.departement_id else None,
            "est_verrouille": chef.est_verrouille,
            "date_inscription": chef.cree_le.strftime("%Y-%m-%d") if chef.cree_le else None,
        })

    return resultats


@routeur_admin_domaine.get(
    "/chefs/{chef_id}/detail",
    summary="Détail d'un chef du domaine",
)
async def detail_chef_domaine(
    chef_id: UUID,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(admin_courant)],
):
    """Retourne le détail complet d'un chef du même domaine."""
    domaine_id = _obtenir_domaine_id(utilisateur)

    chef = (await session.scalars(
        select(Utilisateur).where(
            Utilisateur.id == chef_id,
            Utilisateur.domaine_id == domaine_id,
            Utilisateur.role.in_(RolesUtilisateur.roles_chefs()),
            Utilisateur.est_supprime == False,
        )
    )).first()

    if not chef:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chef introuvable ou hors de ton domaine.",
        )

    email = dechiffrer_donnee(chef.email_chiffre) if chef.email_chiffre else ""
    prenom = dechiffrer_donnee(chef.prenom_chiffre) if chef.prenom_chiffre else ""
    nom = dechiffrer_donnee(chef.nom_chiffre) if chef.nom_chiffre else ""
    telephone = dechiffrer_donnee(chef.telephone_chiffre) if chef.telephone_chiffre else ""

    # Département
    departement_nom = None
    if chef.departement_id:
        dept = await session.get(Departement, chef.departement_id)
        if dept:
            departement_nom = dept.nom

    return {
        "id": str(chef.id),
        "email": email,
        "prenom": prenom,
        "nom": nom,
        "telephone": telephone,
        "ville": chef.ville,
        "role": chef.role,
        "est_actif": chef.est_actif,
        "est_verrouille": chef.est_verrouille,
        "domaine_id": str(chef.domaine_id) if chef.domaine_id else None,
        "departement_id": str(chef.departement_id) if chef.departement_id else None,
        "departement_nom": departement_nom,
        "date_creation": chef.cree_le.strftime("%Y-%m-%dT%H:%M:%S") if chef.cree_le else "",
        "date_derniere_connexion": chef.date_derniere_connexion.strftime("%Y-%m-%dT%H:%M:%S") if chef.date_derniere_connexion else None,
        "motif_suspension": chef.motif_suspension if hasattr(chef, 'motif_suspension') else None,
    }
