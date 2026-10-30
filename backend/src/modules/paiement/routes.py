# -*- coding: utf-8 -*-
"""Routes API du domaine paiement (portefeuille, transactions, commissions)."""
import hashlib
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modeles.paiement import TransactionPaiement
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.paiement import schemas, service
from src.modules.paiement import tarification
from src.modules.paiement.mobile_money import lister_moyens
from src.noyau.permissions import require_permission
from src.noyau.telephone import hasher_telephone


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


# ─── Tarifs (barème dégressif) ─────────────────────────────────────

@routeur_paiement.get(
    "/tarifs",
    response_model=schemas.TarifsColisResponse,
    summary="Tarif de service applicable (selon le nombre d'articles) + barème complet",
)
@require_permission("paiement.lire")
async def tarifs_courants(
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    nombre_articles: int = Query(1, ge=1, le=9999),
):
    return await service.tarifs_pour(nombre_articles)


@routeur_paiement.get(
    "/statistiques/plateforme",
    response_model=schemas.StatistiquesPlateformeResponse,
    summary="Statistiques financières globales (super-administrateur)",
)
@require_permission("paiement.statistiques")
async def statistiques_plateforme(
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    return await service.statistiques_plateforme(session)


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
    if (
        utilisateur_courant.role == "citoyen"
        and utilisateur_courant.mode_commercant_actif
    ):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Utilisez le paiement des frais de suivi pour un dépôt commerçant.",
        )
    return await service.creer_transaction(session, donnees, utilisateur_courant)


@routeur_paiement.post(
    "/frais-suivi",
    response_model=schemas.PaiementResultat,
    status_code=status.HTTP_201_CREATED,
    summary="Payer les frais de suivi avant le dépôt commerçant",
)
@require_permission("paiement.payer")
async def payer_frais_suivi(
    donnees: schemas.FraisSuiviCreate,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    if (
        utilisateur_courant.role == "citoyen"
        and not utilisateur_courant.mode_commercant_actif
    ):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Le mode commerçant doit être activé pour payer ces frais.",
        )
    payeurs_autorises = {utilisateur_courant.id}
    if donnees.destinataire_id is not None:
        payeurs_autorises.add(donnees.destinataire_id)
    if donnees.payeur_id not in payeurs_autorises:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Le payeur doit être le commerçant ou le destinataire identifié.",
        )
    if donnees.destinataire_id is not None:
        destinataire = await session.get(Utilisateur, donnees.destinataire_id)
        if (
            destinataire is None
            or donnees.telephone_destinataire is None
            or destinataire.telephone_hash
            != hasher_telephone(donnees.telephone_destinataire)
        ):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Le compte DigiID et le téléphone du destinataire ne correspondent pas.",
            )
    if donnees.payeur_id != utilisateur_courant.id and (
        donnees.payeur_id != donnees.destinataire_id
    ):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Le destinataire ne peut payer qu'avec son compte identifié.",
        )

    frais = tarification.frais_service(donnees.nombre_articles)
    empreinte_paiement = hashlib.sha256(
        ":".join(
            (
                donnees.idempotency_key,
                str(donnees.nombre_articles),
                str(frais.frais_fcfa),
                donnees.moyen,
                donnees.telephone or "",
                str(donnees.payeur_id),
                str(donnees.destinataire_id or ""),
                donnees.telephone_destinataire or "",
            )
        ).encode("utf-8")
    ).hexdigest()
    resultat = await service.creer_transaction(
        session,
        schemas.TransactionCreate(
            type="API",
            montant_fcfa=frais.frais_fcfa,
            moyen=donnees.moyen,
            telephone=donnees.telephone,
            payeur_id=donnees.payeur_id,
            idempotency_key=(
                f"mode-commercant:{utilisateur_courant.id}:{empreinte_paiement}"
            ),
        ),
        utilisateur_courant,
        commit=False,
    )
    transaction = await session.scalar(
        select(TransactionPaiement).where(
            TransactionPaiement.reference == resultat["transaction"].reference
        )
    )
    if transaction is None:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="La transaction de suivi n'a pas été créée.",
        )
    if (
        transaction.montant_fcfa != frais.frais_fcfa
        or transaction.payeur_id != donnees.payeur_id
        or transaction.moyen != donnees.moyen
        or transaction.telephone != donnees.telephone
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                "Cette clé de paiement a déjà servi avec un payeur ou un montant "
                "différent. Recommencez le paiement."
            ),
        )
    transaction.frais_plateforme = frais.frais_fcfa
    transaction.montant_net = 0
    await session.commit()
    resultat["transaction"].frais_plateforme = frais.frais_fcfa
    resultat["transaction"].montant_net = 0
    return resultat


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
    transaction = await session.scalar(
        select(TransactionPaiement).where(
            TransactionPaiement.reference == reference
        )
    )
    if utilisateur_courant.role in {"citoyen", "commercant"} and transaction is not None:
        prefixe = f"mode-commercant:{utilisateur_courant.id}:"
        possede_transaction = (
            transaction.payeur_id == utilisateur_courant.id
            or (
                transaction.type == "API"
                and (transaction.idempotency_key or "").startswith(prefixe)
            )
        )
        if not possede_transaction:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND,
                detail="Transaction introuvable.",
            )
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
