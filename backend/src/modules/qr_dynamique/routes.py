# -*- coding: utf-8 -*-
"""
Routes API pour le module QR Code Dynamique.

Endpoints :
- POST /api/v1/utilisateur/qr/generer     → Génère un nouveau QR (citoyen)
- POST /api/v1/police/qr/verifier/{token} → Vérifie un QR scanné (police)
"""
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.qr_dynamique.schemas import QRCodeGenere, QRCodeVerification
from src.modules.qr_dynamique import service
from src.noyau.journal import journal

routeur_qr_dynamique = APIRouter(tags=["QR Code Dynamique"])


@routeur_qr_dynamique.post(
    "/api/v1/utilisateur/qr/generer",
    response_model=QRCodeGenere,
    summary="Générer un nouveau QR Code temporaire",
    description=(
        "Génère un QR Code unique et temporaire (valide 30 secondes). "
        "L'ancien QR Code est automatiquement invalidé. "
        "À appeler à chaque ouverture de l'écran QR."
    ),
)
async def generer_qr(
    citoyen: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """
    Endpoint citoyen : génère un nouveau QR Code.
    
    Sécurité :
    - Invalide l'ancien token avant d'en créer un nouveau
    - Token à usage unique (invalidé après 1er scan)
    - Expiration automatique après 30 secondes
    """
    # Vérifier que l'utilisateur est bien un citoyen
    if citoyen.role not in ["citoyen", "utilisateur"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les citoyens peuvent générer un QR Code.",
        )
    
    try:
        # 1. Invalider l'ancien token (si existant)
        await service.invalider_ancien_token(citoyen.id)
        
        # 2. Générer un nouveau QR Code
        resultat = await service.generer_qr_code(session, citoyen)
        
        return QRCodeGenere(**resultat)
        
    except Exception as e:
        journal.error(f"Erreur lors de la génération du QR Code : {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Impossible de générer le QR Code. Réessayez.",
        )


@routeur_qr_dynamique.post(
    "/api/v1/police/qr/verifier/{token}",
    response_model=QRCodeVerification,
    summary="Vérifier un QR Code scanné",
    description=(
        "Vérifie l'authenticité d'un QR Code scanné par un agent. "
        "Retourne les informations du citoyen si le QR est valide. "
        "Le QR est invalidé après cette vérification (usage unique)."
    ),
)
async def verifier_qr(
    token: str,
    agent: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """
    Endpoint police : vérifie un QR Code scanné.
    
    Sécurité :
    - Vérifie l'existence du token dans Redis
    - Vérifie que le token n'a pas déjà été utilisé
    - Vérifie que le token n'est pas expiré
    - Invalide le token après vérification (usage unique)
    - Retourne les infos du citoyen si valide
    """
    # Vérifier que l'utilisateur est un agent de police
    if agent.role not in ["police", "agent_police", "admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les agents de police peuvent vérifier les QR Codes.",
        )
    
    # Vérifier le token
    resultat = await service.verifier_qr_code(session, token, agent)
    
    if not resultat["succes"]:
        # Retourner 401 pour un QR invalide/expiré/utilisé
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=resultat["message"],
        )
    
    return QRCodeVerification(**resultat)