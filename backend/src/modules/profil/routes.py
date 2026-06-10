# -*- coding: utf-8 -*-
"""
Routes API du module profil.

Préfixe : /api/v1/utilisateur/profil
Toutes les routes nécessitent une authentification utilisateur.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import (
    utilisateur_courant, obtenir_ip_client,
)
from src.modules.profil import service
from src.modules.profil.schemas import (
    ProfilDetail, ProfilModification, ExportDonnees, ReponseSuppression,
    Code2FARequete, Preparation2FAReponse, Activation2FAReponse,
)


routeur_profil = APIRouter(
    prefix="/api/v1/utilisateur/profil",
    tags=["Profil utilisateur"],
)


@routeur_profil.get(
    "",
    response_model=ProfilDetail,
    summary="Récupérer mon profil complet",
)
async def consulter_mon_profil(
    requete: Request,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    return await service.obtenir_profil_detail(
        session=session,
        utilisateur=utilisateur,
        adresse_ip=obtenir_ip_client(requete),
    )


@routeur_profil.patch(
    "",
    response_model=ProfilDetail,
    summary="Modifier mon profil (champs partiels)",
)
async def modifier_mon_profil(
    requete: Request,
    donnees: ProfilModification,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    return await service.modifier_profil(
        session=session,
        utilisateur=utilisateur,
        donnees=donnees,
        adresse_ip=obtenir_ip_client(requete),
    )


@routeur_profil.get(
    "/export",
    response_model=ExportDonnees,
    summary="Exporter toutes mes données (portabilité RGPD)",
)
async def exporter_mes_donnees(
    requete: Request,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """Renvoie un JSON complet de toutes mes données personnelles."""
    return await service.exporter_donnees(
        session=session,
        utilisateur=utilisateur,
        adresse_ip=obtenir_ip_client(requete),
    )


@routeur_profil.delete(
    "",
    response_model=ReponseSuppression,
    status_code=status.HTTP_200_OK,
    summary="Supprimer mon compte (droit à l'oubli)",
)
async def supprimer_mon_compte(
    requete: Request,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """
    Supprime définitivement le compte. Les données chiffrées personnelles sont
    immédiatement mises à null ; une purge complète est programmée sous 30 jours.
    """
    resultat = await service.supprimer_compte(
        session=session,
        utilisateur=utilisateur,
        adresse_ip=obtenir_ip_client(requete),
    )
    return ReponseSuppression(**resultat)


@routeur_profil.post(
    "/2fa/preparation",
    response_model=Preparation2FAReponse,
    summary="Préparer l'activation 2FA (QR code TOTP)",
)
async def preparer_2fa(
    requete: Request,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """Génère un secret TOTP et un QR code à scanner avec une app d'authentification."""
    return await service.preparer_activation_2fa(
        session=session,
        utilisateur=utilisateur,
        adresse_ip=obtenir_ip_client(requete),
    )


@routeur_profil.post(
    "/2fa/activer",
    response_model=Activation2FAReponse,
    summary="Confirmer l'activation 2FA avec un code TOTP",
)
async def activer_2fa(
    requete: Request,
    donnees: Code2FARequete,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    return await service.activer_2fa(
        session=session,
        utilisateur=utilisateur,
        code=donnees.code,
        adresse_ip=obtenir_ip_client(requete),
    )


@routeur_profil.post(
    "/2fa/desactiver",
    response_model=Activation2FAReponse,
    summary="Désactiver la 2FA (code TOTP requis)",
)
async def desactiver_2fa(
    requete: Request,
    donnees: Code2FARequete,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    return await service.desactiver_2fa(
        session=session,
        utilisateur=utilisateur,
        code=donnees.code,
        adresse_ip=obtenir_ip_client(requete),
    )
