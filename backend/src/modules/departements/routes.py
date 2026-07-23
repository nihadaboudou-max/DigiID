# -*- coding: utf-8 -*-
"""Routes API pour les départements."""
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from typing import Annotated
from sqlalchemy import select
from src.modeles.domaine import Domaine
from src.noyau import dechiffrer_donnee

from src.modules.authentification.dependances import utilisateur_courant
from src.modeles.utilisateur import Utilisateur

from src.modeles.departement import Departement
from src.base_donnees.session import obtenir_session
from src.modules.departements.schemas import (
    DepartementCreate, DepartementUpdate, DepartementResponse, DepartementListResponse
)
from src.modules.departements.service import (
    creer_departement, lister_departements,
    modifier_departement, supprimer_departement
)
from src.modules.departements.dependances import obtenir_departement_ou_404
from src.noyau.permissions import require_permission


# =============================================================================
# Fonctions utilitaires
# =============================================================================

async def _enrichir_departement(dept: Departement, session: AsyncSession) -> dict:
    """Ajoute chef_nom et domaine_nom à un département."""
    data = {
        "id": dept.id,
        "nom": dept.nom,
        "type_departement": dept.type_departement,
        "description": dept.description,
        "capacite_max": dept.capacite_max,
        "domaine_id": dept.domaine_id,
        "domaine_nom": None,
        "chef_id": dept.chef_id,
        "chef_nom": None,
        "est_actif": dept.est_actif,
                "date_creation": dept.date_creation,
        "date_modification": dept.date_modification,
    }
    
    # Domaine
    if dept.domaine_id:
        domaine = await session.get(Domaine, dept.domaine_id)
        if domaine:
            data["domaine_nom"] = domaine.nom
    
    # Chef
    if dept.chef_id:
        chef = await session.get(Utilisateur, dept.chef_id)
        if chef and chef.prenom_chiffre:
            prenom = dechiffrer_donnee(chef.prenom_chiffre) or ""
            nom = dechiffrer_donnee(chef.nom_chiffre) or ""
            data["chef_nom"] = f"{prenom} {nom}".strip() or "Chef"
    
    return data

routeur_departements = APIRouter(prefix="/api/v1/departements", tags=["Départements"])


@routeur_departements.post(
    "",
    response_model=DepartementResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un département",
)
@require_permission("departement.ecrire")
async def creer(
    donnees: DepartementCreate,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Crée un nouveau département dans un domaine."""
    dept = await creer_departement(session, donnees)
    return await _enrichir_departement(dept, session)


@routeur_departements.get(
    "",
    response_model=DepartementListResponse,
    summary="Lister les départements",
)
@require_permission("departement.lire")
async def lister(
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    domaine_id: UUID | None = Query(None, description="Filtrer par domaine"),
    type_departement: str | None = Query(None, description="Filtrer par type"),
    page: int = Query(1, ge=1),
    par_page: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(obtenir_session),
):
    """Liste les départements avec filtres."""
    departements, total = await lister_departements(
        session, domaine_id, type_departement, page, par_page
    )
    # Enrichir chaque département avec chef_nom et domaine_nom
    enrichis = [await _enrichir_departement(d, session) for d in departements]
    return DepartementListResponse(
        departements=enrichis,
        total=total,
        page=page,
        par_page=par_page,
    )


@routeur_departements.get(
    "/{departement_id}",
    response_model=DepartementResponse,
    summary="Obtenir un département",
)
@require_permission("departement.lire")
async def obtenir(
    departement: Departement = Depends(obtenir_departement_ou_404),
    session: AsyncSession = Depends(obtenir_session),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
):
    """Récupère les détails d'un département."""
    return await _enrichir_departement(departement, session)


@routeur_departements.patch(
    "/{departement_id}",
    response_model=DepartementResponse,
    summary="Modifier un département",
)
@require_permission("departement.ecrire")
async def modifier(
    donnees: DepartementUpdate,
    departement: Departement = Depends(obtenir_departement_ou_404),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Modifie un département existant."""
    dept_modifie = await modifier_departement(session, departement.id, donnees)
    return await _enrichir_departement(dept_modifie, session)


@routeur_departements.delete(
    "/{departement_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer un département",
)
@require_permission("departement.supprimer")
async def supprimer(
    departement: Departement = Depends(obtenir_departement_ou_404),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Supprime un département."""
    await supprimer_departement(session, departement.id)