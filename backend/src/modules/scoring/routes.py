# -*- coding: utf-8 -*-
"""
Routes API du module scoring.

Prefixe : /api/v1/utilisateur/score

Nouveau endpoint v2 :
  POST /api/v1/utilisateur/score/evaluer  -> Evaluation contextuelle asy

Cette API transforme le projet de "systeme d'identite"
en "infrastructure de decision" (Etape 5).
"""
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import (
    utilisateur_courant, obtenir_ip_client,
)
from src.modules.scoring import service
from src.modules.scoring.service import evaluation_contextuelle
from src.modules.scoring.schemas import (
    ScoreDetail, ListeHistoriqueScore,
    DemandeEvaluationContextuelle, ResultatEvaluationContextuelle,
)


routeur_scoring = APIRouter(
    prefix="/api/v1/utilisateur/score",
    tags=["Score DigiID"],
)


@routeur_scoring.get(
    "",
    response_model=ScoreDetail,
    summary="Recuperer mon score actuel avec ses facteurs explicatifs",
)
async def consulter_mon_score(
    requete: Request,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """
    Retourne le score actuel. S'il n'a jamais ete calcule, il est calcule
    automatiquement et stocke.
    """
    return await service.obtenir_score_actuel(
        session=session,
        utilisateur=utilisateur,
        adresse_ip=obtenir_ip_client(requete),
    )


@routeur_scoring.post(
    "/recalculer",
    response_model=ScoreDetail,
    summary="Forcer un recalcul immediat du score",
)
async def recalculer_mon_score(
    requete: Request,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """
    Force un nouveau calcul meme si le precedent date de moins de 30 jours.
    Utile apres une modification de profil ou d'autorisation.
    """
    return await service.calculer_et_enregistrer_score(
        session=session,
        utilisateur=utilisateur,
        adresse_ip=obtenir_ip_client(requete),
        forcer_recalcul=True,
    )


@routeur_scoring.get(
    "/historique",
    response_model=ListeHistoriqueScore,
    summary="Historique des calculs de score",
)
async def historique_mon_score(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    limite: int = Query(24, ge=1, le=100),
):
    """Retourne les `limite` derniers calculs de score (par defaut 24)."""
    return await service.lister_historique(
        session=session,
        utilisateur=utilisateur,
        limite=limite,
    )


# ============================================================================
# API d'evaluation contextuelle (score asymetrique par cas d'usage)
# ============================================================================

@routeur_scoring.post(
    "/evaluer",
    response_model=ResultatEvaluationContextuelle,
    summary="Evaluer un score pour un contexte specifique",
    description=(
        "Permet de verifier l'eligibilite d'un utilisateur pour un cas d'usage "
        "specifique (credit, aide humanitaire, verification, etc.) sans exposer "
        "le score brut au citoyen. Le seuil requis varie selon le contexte : "
        "un score de 45/100 suffit pour une aide ONG mais pas pour un credit bancaire."
    ),
)
async def evaluer_pour_contexte(
    requete: Request,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    demande: DemandeEvaluationContextuelle,
):
    """
    Evalue un score de confiance pour un contexte specifique.

    Cette API est le coeur de la transformation du projet en
    "infrastructure de decision" (Etape 5).

    Usage institutionnel : les partenaires (banques, ONG, etc.) peuvent
    verifier l'eligibilite sans que le citoyen ait a partager son score brut.
    """
    # Rechercher l'utilisateur par son DigiID public
    resultat = await session.execute(
        select(Utilisateur).where(Utilisateur.digiid_public == demande.digiid)
    )
    utilisateur_cible = resultat.scalar_one_or_none()

    if utilisateur_cible is None:
        raise HTTPException(
            status_code=404,
            detail=f"Aucun utilisateur trouve avec le DigiID : {demande.digiid}",
        )

    # Recuperer ou calculer le score
    score_detail = await service.obtenir_score_actuel(
        session=session,
        utilisateur=utilisateur_cible,
        adresse_ip=obtenir_ip_client(requete),
    )

    return evaluation_contextuelle(
        digiid=demande.digiid,
        score=score_detail.score_total,
        contexte=demande.contexte,
        montant_estime=demande.montant_estime,
    )
