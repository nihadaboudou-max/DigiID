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
GET    /me/ui-config         Configuration UI selon le rôle
"""
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.base_donnees.session import obtenir_session
from src.config import parametres
from src.modeles import (
    InspectionDocument,
    Notification,
    Utilisateur,
    VerificationVisuelle,
)
from src.modules.authentification import service
from src.modules.authentification.dependances import (
    utilisateur_courant, obtenir_ip_client, obtenir_agent_utilisateur,
)
from src.modules.authentification import verification_code as service_verification
from src.noyau.chiffrement import dechiffrer_donnee
from src.schemas.authentification import (
    InscriptionRequete, InscriptionReponse,
    ConnexionRequete, ConnexionReponse,
    ConnexionCodeEnvoyerRequete, ConnexionCodeEnvoyerReponse,
    RafraichissementRequete, JetonsReponse,
    UtilisateurReponse,
    VerificationEnvoyerRequete as VerifEnvoyerReq,
    VerificationEnvoyerReponse as VerifEnvoyerRep,
    VerificationVerifierRequete as VerifVerifierReq,
    VerificationVerifierReponse as VerifVerifierRep,
    VerificationStatutReponse as VerifStatutRep,
    StatutModeCommercantReponse,
    AssistanceModeCommercantRequete,
    MotDePasseOublieRequete, MotDePasseOublieReponse,
    MotDePasseReinitialisationRequete, MotDePasseReinitialisationReponse,
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
        mode_commercant_actif=utilisateur.mode_commercant_actif,
        deux_fa_active=utilisateur.deux_fa_active,
        est_email_verifie=utilisateur.est_email_verifie,
        est_telephone_verifie=bool(
            getattr(utilisateur, "est_telephone_verifie", False)
        ),
        score_actuel=utilisateur.score_actuel,
        date_creation=utilisateur.cree_le,
        # ✅ CORRECTION : Transmettre les IDs de cloisonnement
        domaine_id=utilisateur.domaine_id,
        departement_id=utilisateur.departement_id,
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
        code_email=donnees.code_email,
        canal_2fa=donnees.canal_2fa or "totp",
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
    "/connexion/code",
    response_model=ConnexionCodeEnvoyerReponse,
    summary="Envoyer un code 2FA de connexion par email",
)
async def envoyer_code_connexion(
    requete: Request,
    donnees: ConnexionCodeEnvoyerRequete,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """
    Vérifie les identifiants (email + mot de passe) puis envoie un code
    2FA par email pour finaliser la connexion.

    Réutilise le même service d'envoi de code que les messages de
    confirmation (verification_code.generer_et_envoyer_code).
    """
    resultat = await service.envoyer_code_connexion_email(
        session=session,
        email=donnees.email,
        mot_de_passe=donnees.mot_de_passe,
        adresse_ip=obtenir_ip_client(requete),
    )
    return ConnexionCodeEnvoyerReponse(
        succes=True,
        message="Code de connexion envoyé par email.",
        destination_masquee=resultat["destination_masquee"],
        duree_validite_minutes=resultat["duree_validite_minutes"],
        code_dev=resultat.get("code"),
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


async def _preuves_mode_commercant(
    session: AsyncSession, utilisateur_id
) -> tuple[bool, bool]:
    document_valide = await session.scalar(
        select(InspectionDocument.id)
        .where(
            InspectionDocument.utilisateur_id == utilisateur_id,
            InspectionDocument.est_supprime.is_(False),
            InspectionDocument.est_valide.is_(True),
            InspectionDocument.statut == "approuve",
            InspectionDocument.document_chemin.is_not(None),
        )
        .limit(1)
    )
    photo_validee = await session.scalar(
        select(VerificationVisuelle.id)
        .where(
            VerificationVisuelle.utilisateur_id == utilisateur_id,
            VerificationVisuelle.est_supprime.is_(False),
            VerificationVisuelle.statut == "approuve",
            VerificationVisuelle.photo_chemin.is_not(None),
        )
        .limit(1)
    )
    return document_valide is not None, photo_validee is not None


@routeur_authentification.get(
    "/mode-commercant",
    response_model=StatutModeCommercantReponse,
    summary="Consulter l'éligibilité au mode commerçant",
)
async def statut_mode_commercant(
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    document_valide, photo_validee = await _preuves_mode_commercant(
        session, utilisateur.id
    )
    return StatutModeCommercantReponse(
        mode_actif=utilisateur.mode_commercant_actif,
        document_valide=document_valide,
        photo_validee=photo_validee,
        peut_activer=document_valide and photo_validee,
    )


@routeur_authentification.post(
    "/mode-commercant/activer",
    response_model=UtilisateurReponse,
    summary="Activer le mode commerçant sur un compte citoyen vérifié",
)
async def activer_mode_commercant(
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    if utilisateur.role not in {"citoyen", "commercant"}:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Activez le mode commerçant depuis un compte citoyen.",
        )
    document_valide, photo_validee = await _preuves_mode_commercant(
        session, utilisateur.id
    )
    if not document_valide or not photo_validee:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Un document d'identité approuvé et une photo vérifiée sont requis.",
        )
    utilisateur.role = "citoyen"
    utilisateur.mode_commercant_actif = True
    await session.commit()
    await session.refresh(utilisateur)
    return _construire_utilisateur_reponse(utilisateur)


@routeur_authentification.post(
    "/mode-commercant/assistance",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Demander l'aide du super-administrateur pour activer le mode commerçant",
)
async def demander_assistance_mode_commercant(
    donnees: AssistanceModeCommercantRequete,
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    if utilisateur.role not in {"citoyen", "commercant"}:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="L'assistance à l'activation est réservée aux comptes citoyens.",
        )
    administrateurs = (
        await session.scalars(
            select(Utilisateur.id).where(
                Utilisateur.role.in_(("super_admin", "super_administrateur")),
                Utilisateur.est_actif.is_(True),
            )
        )
    ).all()
    if not administrateurs:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Aucun super-administrateur n'est disponible pour recevoir la demande.",
        )
    for administrateur_id in administrateurs:
        session.add(
            Notification(
                utilisateur_id=administrateur_id,
                type_notification="info",
                categorie="systeme",
                titre="Aide à l'activation du mode commerçant",
                message=(
                    f"Demande de {utilisateur.digiid_public or utilisateur.id} : "
                    f"{donnees.message.strip()}"
                ),
                lien_action="/super-admin/utilisateurs",
            )
        )
    await session.commit()
    return {"message": "Votre demande a été transmise au super-administrateur."}


# =============================================================================
# NOUVEAU : Configuration UI selon le rôle
# =============================================================================

@routeur_authentification.get(
    "/me/ui-config",
    summary="Configuration UI selon le rôle de l'utilisateur",
)
async def obtenir_ui_config(
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """
    Retourne la configuration UI pour l'utilisateur connecté.
    Inclut les permissions selon le rôle pour afficher/masquer les fonctionnalités.
    """
    # Définir les permissions selon le rôle
    permissions = {
        "verifyIdentity": False,
        "searchPerson": False,
        "viewPoliceAudit": False,
        "manageAgents": False,
        "manageMissions": False,
        "manageRapports": False,
    }
    
    role = utilisateur.role
    
    # Permissions Agent Police
    if role in ("agent_police", "police"):
        permissions.update({
            "verifyIdentity": True,
            "searchPerson": True,
            "viewPoliceAudit": True,
        })
    
    # Permissions Chef Police
    elif role == "chef_police":
        permissions.update({
            "verifyIdentity": True,
            "searchPerson": True,
            "viewPoliceAudit": True,
            "manageAgents": True,
            "manageMissions": True,
            "manageRapports": True,
        })
    
    # Permissions Agent ONG
    elif role in ("agent_ong", "ong"):
        permissions.update({
            "manageMissions": True,
        })
    
    # Permissions Chef ONG
    elif role == "chef_ong":
        permissions.update({
            "manageAgents": True,
            "manageMissions": True,
            "manageRapports": True,
        })
    
    # Permissions Agent Médical
    elif role in ("agent_medical", "medecin"):
        permissions.update({
            "verifyIdentity": True,
        })
    
    # Permissions Chef Médical
    elif role == "chef_medical":
        permissions.update({
            "verifyIdentity": True,
            "manageAgents": True,
            "manageRapports": True,
        })
    
    # Permissions Agent Enrôlement
    elif role in ("agent_terrain", "agent"):
        permissions.update({
            "verifyIdentity": True,
        })
    
    # Permissions Chef Enrôlement
    elif role == "chef_agent":
        permissions.update({
            "verifyIdentity": True,
            "manageAgents": True,
            "manageRapports": True,
        })
    
    # Super admin et administrateur voient tout
    if role in ("super_administrateur", "administrateur"):
        permissions = {k: True for k in permissions}
    
    # Déchiffrer le nom complet
    prenom = dechiffrer_donnee(utilisateur.prenom_chiffre) if utilisateur.prenom_chiffre else ""
    nom = dechiffrer_donnee(utilisateur.nom_chiffre) if utilisateur.nom_chiffre else ""
    
    return {
        "role": role,
        "nom": f"{prenom} {nom}".strip(),
        "permissions": permissions,
    }


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
        code_dev=resultat.get("code"),
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
    elif resultat["est_actif"]:
        message = "Téléphone vérifié avec succès ! Ton compte est maintenant actif."
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
# Mot de passe oublié / réinitialisation
# =============================================================================

@routeur_authentification.post(
    "/mot-de-passe/oublie",
    response_model=MotDePasseOublieReponse,
    summary="Demander un lien de réinitialisation de mot de passe",
)
async def mot_de_passe_oublie(
    requete: Request,
    donnees: MotDePasseOublieRequete,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """
    Envoie un email avec un lien de réinitialisation si le compte existe.
    La réponse est délibérément identique que l'email existe ou non
    pour éviter l'énumération des comptes existants.
    """
    resultat = await service.demander_reinitialisation_mot_de_passe(
        session=session,
        email=donnees.email,
        frontend_url=donnees.frontend_url,
        adresse_ip=obtenir_ip_client(requete),
    )
    return MotDePasseOublieReponse(
        succes=resultat["succes"],
        message=resultat["message"],
        destination_masquee=resultat.get("destination_masquee"),
        duree_validite_minutes=resultat["duree_validite_minutes"],
        token_dev=resultat.get("token_dev"),
    )


@routeur_authentification.post(
    "/mot-de-passe/reinitialiser",
    response_model=MotDePasseReinitialisationReponse,
    summary="Réinitialiser le mot de passe avec un token",
)
async def mot_de_passe_reinitialiser(
    requete: Request,
    donnees: MotDePasseReinitialisationRequete,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """
    Réinitialise le mot de passe à l'aide d'un token de réinitialisation valide.
    Invalide toutes les sessions actives pour forcer la reconnexion.
    """
    resultat = await service.reinitialiser_mot_de_passe(
        session=session,
        token=donnees.token,
        nouveau_mot_de_passe=donnees.nouveau_mot_de_passe,
        adresse_ip=obtenir_ip_client(requete),
    )
    return MotDePasseReinitialisationReponse(
        succes=resultat["succes"],
        message=resultat["message"],
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
            message=f" Échec de la création : {erreur}",
        )