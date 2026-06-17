# -*- coding: utf-8 -*-
"""
Routes API du module consentements.

Préfixe : /api/v1/utilisateur/consentements
"""
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import (
    utilisateur_courant, obtenir_ip_client,
)
from src.modules.consentements import service
from src.modules.consentements.schemas import (
    ConsentementBascule, ConsentementDetail, ConsentementTexteLegalDetail,
    ListeConsentements,
)
from src.modules.scoring import declencher_recalcul_score
from src.noyau import journal as journal_module


routeur_consentements = APIRouter(
    prefix="/api/v1/utilisateur/consentements",
    tags=["Consentements"],
)


@routeur_consentements.get(
    "",
    response_model=ListeConsentements,
    summary="Lister tous mes consentements",
)
async def lister_mes_consentements(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """Tous les consentements avec leur état actuel (accordé/refusé/retiré)."""
    return await service.lister_pour_utilisateur(session, utilisateur)


@routeur_consentements.get(
    "/{categorie}",
    response_model=ConsentementTexteLegalDetail,
    summary="Détail d'un consentement avec son texte légal complet",
)
async def detail_consentement(
    categorie: str,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """Utile pour afficher le texte légal dans la modale frontend."""
    return await service.obtenir_avec_texte(session, utilisateur, categorie)


@routeur_consentements.patch(
    "/{categorie}",
    response_model=ConsentementDetail,
    summary="Accorder ou retirer un consentement",
)
async def basculer_mon_consentement(
    requete: Request,
    categorie: str,
    donnees: ConsentementBascule,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """Bascule l'état d'un consentement. Les obligatoires ne peuvent pas être retirés."""
    resultat = await service.basculer_consentement(
        session=session,
        utilisateur=utilisateur,
        categorie=categorie,
        accorder=donnees.accorder,
        adresse_ip=obtenir_ip_client(requete),
    )
    # Chaque consentement facultatif accordé/retiré impacte le score
    action = "consentement_accorde" if donnees.accorder else "consentement_retire"
    try:
        await declencher_recalcul_score(
            session=session,
            utilisateur=utilisateur,
            raison=action,
            adresse_ip=obtenir_ip_client(requete),
        )
    except Exception as e:
        journal_module.warning(f"Recalcul score ignoré ({action}) : {e}")
    return resultat
