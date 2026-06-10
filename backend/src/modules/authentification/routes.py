# -*- coding: utf-8 -*-
"""
Routes API d'authentification — endpoints publics.

Préfixe : /api/v1/auth

Endpoints :
  POST   /inscription          Inscription d'un nouvel utilisateur
  POST   /connexion            Connexion (retourne tokens)
  POST   /deconnexion          Déconnexion (révoque la session)
  POST   /rafraichir           Rafraîchit le token d'accès
  GET    /moi                  Profil minimal de l'utilisateur connecté
"""
from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.config import parametres
from src.modeles import Utilisateur
from src.modules.authentification import service
from src.modules.authentification.dependances import (
    utilisateur_courant, obtenir_ip_client, obtenir_agent_utilisateur,
)
from src.noyau.chiffrement import dechiffrer_donnee
from src.schemas.authentification import (
    InscriptionRequete, InscriptionReponse,
    ConnexionRequete, ConnexionReponse,
    RafraichissementRequete, JetonsReponse,
    UtilisateurReponse,
)


routeur_authentification = APIRouter(
    prefix="/api/v1/auth",
    tags=["Authentification"],
)


def _construire_utilisateur_reponse(utilisateur: Utilisateur) -> UtilisateurReponse:
    """Convertit un objet Utilisateur en réponse API publique, en déchiffrant
    les champs sensibles."""
    return UtilisateurReponse(
        id=utilisateur.id,
        digiid_public=utilisateur.digiid_public,
        email=dechiffrer_donnee(utilisateur.email_chiffre),
        prenom=dechiffrer_donnee(utilisateur.prenom_chiffre) if utilisateur.prenom_chiffre else None,
        nom=dechiffrer_donnee(utilisateur.nom_chiffre) if utilisateur.nom_chiffre else None,
        telephone=dechiffrer_donnee(utilisateur.telephone_chiffre) if utilisateur.telephone_chiffre else None,
        ville=utilisateur.ville,
        role=utilisateur.role,
        deux_fa_active=utilisateur.deux_fa_active,
        est_email_verifie=utilisateur.est_email_verifie,
        score_actuel=utilisateur.score_actuel,
        date_creation=utilisateur.cree_le,
    )


@routeur_authentification.post(
    "/inscription",
    response_model=InscriptionReponse,
    status_code=status.HTTP_201_CREATED,
    summary="Inscription d'un nouvel utilisateur",
)
async def inscription(
    requete: Request,
    donnees: InscriptionRequete,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """
    Crée un compte utilisateur + une session automatique.
    Retourne l'utilisateur ET les tokens JWT pour que le frontend
    puisse accéder immédiatement à la page de vérification d'identité.
    """
    utilisateur = await service.inscrire_utilisateur(
        session=session,
        email=donnees.email,
        mot_de_passe=donnees.mot_de_passe,
        prenom=donnees.prenom,
        nom=donnees.nom,
        telephone=donnees.telephone,
        ville=donnees.ville,
        code_parrainage=donnees.code_parrainage,
        adresse_ip=obtenir_ip_client(requete),
    )

    # Créer une session automatiquement après inscription
    token_acces, token_rafraichissement = await service.creer_session_apres_inscription(
        session=session,
        utilisateur=utilisateur,
        adresse_ip=obtenir_ip_client(requete),
        agent_utilisateur=obtenir_agent_utilisateur(requete),
    )

    return InscriptionReponse(
        utilisateur=_construire_utilisateur_reponse(utilisateur),
        jetons=JetonsReponse(
            token_acces=token_acces,
            token_rafraichissement=token_rafraichissement,
            duree_validite_secondes=parametres.duree_token_acces_minutes * 60,
        ),
    )


@routeur_authentification.post(
    "/connexion",
    response_model=ConnexionReponse,
    summary="Connexion — retourne token d'accès et de rafraîchissement",
)
async def connexion(
    requete: Request,
    donnees: ConnexionRequete,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Authentifie et retourne les tokens."""
    utilisateur, token_acces, token_rafraichissement = await service.authentifier_utilisateur(
        session=session,
        email=donnees.email,
        mot_de_passe=donnees.mot_de_passe,
        code_2fa=donnees.code_2fa,
        adresse_ip=obtenir_ip_client(requete),
        agent_utilisateur=obtenir_agent_utilisateur(requete),
    )
    return ConnexionReponse(
        utilisateur=_construire_utilisateur_reponse(utilisateur),
        jetons=JetonsReponse(
            token_acces=token_acces,
            token_rafraichissement=token_rafraichissement,
            duree_validite_secondes=parametres.duree_token_acces_minutes * 60,
        ),
    )


@routeur_authentification.post(
    "/rafraichir",
    response_model=JetonsReponse,
    summary="Rafraîchit le token d'accès",
)
async def rafraichir(
    donnees: RafraichissementRequete,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Échange un refresh token contre une nouvelle paire de tokens."""
    nouveau_acces, nouveau_refresh = await service.rafraichir_token(
        session=session,
        refresh_token=donnees.refresh_token,
    )
    return JetonsReponse(
        token_acces=nouveau_acces,
        token_rafraichissement=nouveau_refresh,
        duree_validite_secondes=parametres.duree_token_acces_minutes * 60,
    )


@routeur_authentification.post(
    "/deconnexion",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Déconnexion — révoque la session",
)
async def deconnexion(
    donnees: RafraichissementRequete,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """Révoque le refresh token courant."""
    await service.deconnecter_session(
        session=session,
        refresh_token=donnees.refresh_token,
        utilisateur_id=utilisateur.id,
    )


@routeur_authentification.get(
    "/moi",
    response_model=UtilisateurReponse,
    summary="Profil minimal de l'utilisateur connecté",
)
async def moi(
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """Retourne les informations de base de l'utilisateur connecté."""
    return _construire_utilisateur_reponse(utilisateur)
