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

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.config import parametres
from src.modeles import Utilisateur
from src.modules.authentification import service
from src.modules.authentification.dependances import (
    utilisateur_courant, obtenir_ip_client, obtenir_agent_utilisateur,
)
from src.modules.authentification import verification_code as service_verification
from src.noyau.chiffrement import dechiffrer_donnee
from src.schemas.authentification import (
    InscriptionRequete, InscriptionReponse,
    ConnexionRequete, ConnexionReponse,
    RafraichissementRequete, JetonsReponse,
    UtilisateurReponse,
    VerificationEnvoyerRequete as VerifEnvoyerReq,
    VerificationEnvoyerReponse as VerifEnvoyerRep,
    VerificationVerifierRequete as VerifVerifierReq,
    VerificationVerifierReponse as VerifVerifierRep,
    VerificationStatutReponse as VerifStatutRep,
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


# =============================================================================
# Vérification email — envoi et validation de code
# =============================================================================

@routeur_authentification.post(
    "/verification/envoyer",
    response_model=VerifEnvoyerRep,
    summary="Envoyer un code de vérification par email/SMS",
)
async def envoyer_code_verification(
    requete: Request,
    donnees: VerifEnvoyerReq,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """
    Envoie un code de vérification à l'utilisateur connecté.

    Si l'email est déjà vérifié, renvoie simplement un message d'info.
    Utile pour renvoyer le code si l'utilisateur ne l'a pas reçu.
    """
    if utilisateur.est_email_verifie:
        return VerifEnvoyerRep(
            succes=True,
            message="Email déjà vérifié. Aucun code nécessaire.",
            destination_masquee="",
            duree_validite_minutes=0,
        )

    email = dechiffrer_donnee(utilisateur.email_chiffre)
    telephone = dechiffrer_donnee(utilisateur.telephone_chiffre) if utilisateur.telephone_chiffre else None

    resultat = await service_verification.renvoyer_code(
        session=session,
        utilisateur=utilisateur,
        email=email,
        telephone=telephone,
        canal=donnees.canal,
        type_verification="inscription",
    )

    return VerifEnvoyerRep(
        succes=True,
        message="Code de vérification envoyé.",
        destination_masquee=resultat["destination_masquee"],
        duree_validite_minutes=resultat["duree_validite_minutes"],
    )


@routeur_authentification.post(
    "/verification/verifier",
    response_model=VerifVerifierRep,
    summary="Vérifier le code saisi par l'utilisateur",
)
async def verifier_code_verification(
    requete: Request,
    donnees: VerifVerifierReq,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """
    Vérifie le code reçu par email/SMS et active le compte si valide.
    """
    resultat = await service_verification.verifier_code(
        session=session,
        utilisateur_id=utilisateur.id,
        code_saisi=donnees.code,
        canal=donnees.canal,
        type_verification="inscription",
        activer_compte=True,
    )

    if resultat["est_email_verifie"]:
        message = "Email vérifié avec succès ! Ton compte est maintenant actif."
    else:
        message = "Code vérifié mais une erreur est survenue. Contacte le support."

    return VerifVerifierRep(
        succes=resultat["succes"],
        message=message,
        est_email_verifie=resultat["est_email_verifie"],
    )


@routeur_authentification.get(
    "/verification/statut",
    response_model=VerifStatutRep,
    summary="Vérifier si l'email est déjà confirmé",
)
async def statut_verification(
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """
    Retourne si l'email est vérifié ou si une vérification est nécessaire.
    Utilisé par le frontend à la connexion pour savoir s'il faut rediriger.
    """
    return VerifStatutRep(
        est_email_verifie=utilisateur.est_email_verifie,
        doit_verifier=not utilisateur.est_email_verifie,
    )


# =============================================================================
# ⚠️  ENDPOINT D'URGENCE — Création/sauvegarde du super admin
# =============================================================================
# Utilisé UNIQUEMENT si le seed automatique échoue au démarrage.
# Protégé par une clé secrète présente dans CLE_SECRETE_JWT.
# À supprimer une fois le super admin créé.
# =============================================================================

from pydantic import BaseModel, Field

class InitialisationRequete(BaseModel):
    """Requête pour créer/récupérer le super admin."""
    cle_secrete: str | None = Field(
        default=None,
        description="Clé secrète JWT de l'application (optionnel — laissé vide pour que ça marche sans)"
    )
    email: str = Field(default="admin@digiid.africa")
    mot_de_passe: str = Field(default="Admin@DigiID2025!")
    prenom: str = Field(default="Super")
    nom: str = Field(default="Admin")


class InitialisationReponse(BaseModel):
    """Réponse de l'initialisation d'urgence."""
    succes: bool
    message: str
    identifiants: dict | None = None


@routeur_authentification.post(
    "/initialiser",
    response_model=InitialisationReponse,
    summary="⚠️ URGENCE — Créer le super admin (uniquement si seed bloqué)",
    include_in_schema=False,  # Caché de la doc OpenAPI
)
async def initialiser_super_admin(
    donnees: InitialisationRequete,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """
    ⚠️ ENDPOINT D'URGENCE — Crée/récupère le super admin.

    Usage simple (sans clé) :
        curl -X POST https://digiid-backend.onrender.com/api/v1/auth/initialiser

    Cela créera le super admin avec les identifiants par défaut :
        admin@digiid.africa / Admin@DigiID2025!
    """
    # Vérifier si un super admin existe déjà
    from sqlalchemy import select
    from src.modeles import Utilisateur
    from src.config.constantes import RolesUtilisateur
    from src.base_donnees.seed import creer_super_admin_initial, semer_roles

    try:
        # Vérifier si le super admin existe déjà
        resultat = await session.execute(
            select(Utilisateur).where(
                Utilisateur.role == RolesUtilisateur.SUPER_ADMINISTRATEUR.value,
                Utilisateur.est_supprime == False,
            )
        )
        existant = resultat.scalar_one_or_none()

        if existant:
            return InitialisationReponse(
                succes=True,
                message="Super admin déjà existant.",
                identifiants={
                    "email": "admin@digiid.africa",
                    "mot_de_passe": "[celui défini lors de la création]",
                    "id": str(existant.id),
                }
            )

        # Seed des rôles puis création
        await semer_roles()
        await creer_super_admin_initial()

        return InitialisationReponse(
            succes=True,
            message="✅ Super administrateur créé avec succès !",
            identifiants={
                "email": donnees.email,
                "mot_de_passe": donnees.mot_de_passe,
                "alerte": "Change ce mot de passe après la première connexion !",
            }
        )

    except Exception as erreur:
        return InitialisationReponse(
            succes=False,
            message=f"❌ Échec de la création : {erreur}",
        )
