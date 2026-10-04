# -*- coding: utf-8 -*-
"""Routes API du domaine paiement (portefeuille, transactions, commissions)."""
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.paiement import schemas, service
from src.modules.paiement.mobile_money import lister_moyens
from src.noyau.permissions import require_permission


routeur_paiement = APIRouter(prefix="/api/v1/paiement", tags=["Paiement"])


# ─── Catalogue des moyens de paiement (UI) ───────────────────────────

@routeur_paiement.get(
    "/moyens",
    response_model=list[schemas.MoyenPaiementInfo],
    summary="Lister les moyens de paiement disponibles",
)
@require_permission("paiement.lire")
async def lister_moyens_paiement(
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
):
    return lister_moyens()


# ─── Portefeuille : le mien ──────────────────────────────────────────

@routeur_paiement.get(
    "/portefeuille/moi",
    response_model=schemas.PortefeuilleResponse,
    summary="Obtenir ma cagnotte (portefeuille)",
)
@require_permission("paiement.lire")
async def mon_portefeuille(
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    return await service.obtenir_ou_creer_portefeuille(session, utilisateur_courant.id)


@routeur_paiement.get(
    "/portefeuille/moi/mouvements",
    response_model=schemas.ReponseListe[schemas.MouvementResponse],
    summary="Historique des mouvements de ma cagnotte",
)
@require_permission("paiement.lire")
async def mes_mouvements(
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    page: int = Query(1, ge=1),
    par_page: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(obtenir_session),
):
    mouvements, total = await service.lister_mouvements(
        session, utilisateur_courant.id, page, par_page
    )
    return schemas.ReponseListe(
        elements=mouvements, total=total, page=page, par_page=par_page
    )


# ─── Portefeuille d'un tiers (support gérant/admin) ──────────────────

@routeur_paiement.get(
    "/portefeuille/{proprietaire_id}",
    response_model=schemas.PortefeuilleResponse,
    summary="Obtenir la cagnotte d'un acteur",
)
@require_permission("paiement.lire")
async def portefeuille_acteur(
    proprietaire_id: UUID,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    return await service.obtenir_portefeuille(session, proprietaire_id)


@routeur_paiement.get(
    "/portefeuille/{proprietaire_id}/mouvements",
    response_model=schemas.ReponseListe[schemas.MouvementResponse],
    summary="Historique des mouvements d'une cagnotte",
)
@require_permission("paiement.lire")
async def mouvements_acteur(
    proprietaire_id: UUID,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    page: int = Query(1, ge=1),
    par_page: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(obtenir_session),
):
    mouvements, total = await service.lister_mouvements(
        session, proprietaire_id, page, par_page, creer_si_absent=False
    )
    return schemas.ReponseListe(
        elements=mouvements, total=total, page=page, par_page=par_page
    )


# ─── Transactions ────────────────────────────────────────────────────

@routeur_paiement.post(
    "/transactions",
    response_model=schemas.PaiementResultat,
    status_code=status.HTTP_201_CREATED,
    summary="Payer un colis (espèces ou mobile money — crédite la cagnotte du receveur)",
)
@require_permission("paiement.payer")
async def creer_transaction(
    donnees: schemas.TransactionCreate,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    return await service.creer_transaction(session, donnees, utilisateur_courant)


@routeur_paiement.post(
    "/transactions/{reference}/confirmer",
    response_model=schemas.PaiementResultat,
    summary="Confirmer un paiement en attente (retour opérateur / démo)",
)
@require_permission("paiement.payer")
async def confirmer_transaction(
    reference: str,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    return await service.confirmer_transaction(session, reference)


@routeur_paiement.get(
    "/transactions",
    response_model=schemas.ReponseListe[schemas.TransactionResponse],
    summary="Lister les transactions",
)
@require_permission("paiement.lire")
async def lister_transactions(
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    page: int = Query(1, ge=1),
    par_page: int = Query(20, ge=1, le=100),
    colis_id: UUID | None = Query(None),
    payeur_id: UUID | None = Query(None),
    statut: str | None = Query(None),
    session: AsyncSession = Depends(obtenir_session),
):
    transactions, total = await service.lister_transactions(
        session, page, par_page, colis_id=colis_id, payeur_id=payeur_id, statut=statut
    )
    return schemas.ReponseListe(
        elements=transactions, total=total, page=page, par_page=par_page
    )


# ─── Commissions (cagnotte du receveur) ──────────────────────────────

@routeur_paiement.get(
    "/commissions/moi",
    response_model=schemas.ReponseListe[schemas.CommissionResponse],
    summary="Mes commissions (reversements sur colis)",
)
@require_permission("paiement.lire")
async def mes_commissions(
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    page: int = Query(1, ge=1),
    par_page: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(obtenir_session),
):
    commissions, total = await service.lister_commissions(
        session, utilisateur_courant.id, page, par_page
    )
    return schemas.ReponseListe(
        elements=commissions, total=total, page=page, par_page=par_page
    )


@routeur_paiement.get(
    "/commissions",
    response_model=schemas.ReponseListe[schemas.CommissionResponse],
    summary="Lister les commissions d'un receveur (support gérant/admin)",
)
@require_permission("paiement.lire")
async def lister_commissions(
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    receveur_id: UUID | None = Query(None),
    page: int = Query(1, ge=1),
    par_page: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(obtenir_session),
):
    cible = receveur_id or utilisateur_courant.id
    commissions, total = await service.lister_commissions(
        session, cible, page, par_page
    )
    return schemas.ReponseListe(
        elements=commissions, total=total, page=page, par_page=par_page
    )
