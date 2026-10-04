# -*- coding: utf-8 -*-
"""
Service paiement — wallet, transactions et commissions (S6).

Flux d'un paiement de colis (100 FCFA, dont 25 FCFA au receveur) :

1. ``creer_transaction`` : on ordonne le paiement auprès du fournisseur
   (espèces → réussi immédiatement ; mobile money → en attente).
2. Au passage à « réussi », ``_verser_commission`` **crédite la cagnotte du
   receveur** de 25 FCFA et inscrit un mouvement dans son portefeuille.
3. ``confirmer_transaction`` : pour le mobile money, la validation (webhook ou
   simulation) déclenche l'étape 2 — de façon **idempotente**.

Toute opération suit la règle : *pas de variation de solde sans mouvement*.
"""
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import parametres
from src.modeles import (
    Colis,
    Commission,
    MouvementPortefeuille,
    Portefeuille,
    TransactionPaiement,
    Utilisateur,
)
from src.modules.paiement import schemas
from src.modules.paiement.mobile_money import (
    MoyenPaiementInconnu,
    obtenir_fournisseur,
)


# ─── Utilitaires ─────────────────────────────────────────────────────

async def _paginer(session: AsyncSession, requete, page: int, par_page: int):
    """Retourne (éléments, total) pour une requête paginée."""
    total = (await session.execute(
        select(func.count()).select_from(requete.subquery())
    )).scalar() or 0
    resultat = await session.execute(
        requete.offset((page - 1) * par_page).limit(par_page)
    )
    return list(resultat.scalars().all()), total


async def _generer_reference(session: AsyncSession) -> str:
    """Génère une référence de paiement unique : ``PAY-<ANNEE>-NNNNNN``."""
    annee = datetime.now(timezone.utc).year
    prefixe = f"PAY-{annee}-"
    total = await session.scalar(
        select(func.count()).select_from(TransactionPaiement).where(
            TransactionPaiement.reference.like(f"{prefixe}%")
        )
    ) or 0
    n = total + 1
    reference = f"{prefixe}{n:06d}"
    while await session.scalar(
        select(TransactionPaiement.id).where(
            TransactionPaiement.reference == reference
        )
    ):
        n += 1
        reference = f"{prefixe}{n:06d}"
    return reference


# ─── Portefeuille ────────────────────────────────────────────────────

async def obtenir_ou_creer_portefeuille(
    session: AsyncSession, proprietaire_id: UUID, *, commit: bool = True
) -> Portefeuille:
    """Récupère le portefeuille d'un propriétaire, ou le crée à solde nul."""
    portefeuille = await session.scalar(
        select(Portefeuille).where(Portefeuille.proprietaire_id == proprietaire_id)
    )
    if portefeuille is None:
        portefeuille = Portefeuille(
            proprietaire_id=proprietaire_id, solde_fcfa=0, devise="XOF", actif=True
        )
        session.add(portefeuille)
        if commit:
            await session.commit()
        else:
            await session.flush()
        await session.refresh(portefeuille)
    return portefeuille


async def obtenir_portefeuille(
    session: AsyncSession, proprietaire_id: UUID
) -> Portefeuille:
    """Récupère un portefeuille existant (404 s'il n'existe pas encore)."""
    portefeuille = await session.scalar(
        select(Portefeuille).where(Portefeuille.proprietaire_id == proprietaire_id)
    )
    if portefeuille is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="Portefeuille introuvable"
        )
    return portefeuille


async def _appliquer_mouvement(
    session: AsyncSession,
    portefeuille: Portefeuille,
    sens: str,
    montant: int,
    motif: str,
    reference_id: UUID | None = None,
) -> MouvementPortefeuille:
    """Crée un mouvement et met à jour le solde (jamais l'un sans l'autre)."""
    solde = portefeuille.solde_fcfa or 0
    if sens == "CREDIT":
        solde += montant
    elif sens == "DEBIT":
        if montant > solde:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, detail="Solde insuffisant"
            )
        solde -= montant
    else:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail=f"Sens de mouvement invalide : {sens}"
        )

    portefeuille.solde_fcfa = solde
    portefeuille.maj_le = datetime.now(timezone.utc)

    mouvement = MouvementPortefeuille(
        portefeuille_id=portefeuille.id,
        sens=sens,
        montant_fcfa=montant,
        motif=motif,
        reference_id=reference_id,
        solde_apres=solde,
    )
    session.add(mouvement)
    await session.flush()
    return mouvement


async def lister_mouvements(
    session: AsyncSession,
    proprietaire_id: UUID,
    page: int,
    par_page: int,
    *,
    creer_si_absent: bool = True,
):
    """
    Historique des mouvements du portefeuille d'un propriétaire.

    ``creer_si_absent`` : on crée la cagnotte à solde nul pour l'utilisateur
    courant (1re visite) ; pour la consultation de la cagnotte d'un tiers on
    préfère un 404 explicite.
    """
    portefeuille = (
        await obtenir_ou_creer_portefeuille(session, proprietaire_id, commit=True)
        if creer_si_absent
        else await obtenir_portefeuille(session, proprietaire_id)
    )
    requete = (
        select(MouvementPortefeuille)
        .where(MouvementPortefeuille.portefeuille_id == portefeuille.id)
        .order_by(MouvementPortefeuille.cree_le.desc())
    )
    return await _paginer(session, requete, page, par_page)


# ─── Commissions ─────────────────────────────────────────────────────

async def _verser_commission(
    session: AsyncSession, transaction: TransactionPaiement
) -> tuple[Commission | None, Portefeuille | None]:
    """Crédite la cagnotte du receveur (idempotent) et renvoie la commission."""
    if (
        transaction.type != "COLIS"
        or transaction.beneficiaire_id is None
        or (transaction.frais_plateforme or 0) <= 0
    ):
        return None, None

    # Anti-double-versement : une commission existe déjà pour cette transaction.
    existante = await session.scalar(
        select(Commission).where(Commission.transaction_id == transaction.id)
    )
    if existante is not None:
        portefeuille = (
            await session.get(Portefeuille, existante.portefeuille_id)
            if existante.portefeuille_id
            else None
        )
        return existante, portefeuille

    portefeuille = await obtenir_ou_creer_portefeuille(
        session, transaction.beneficiaire_id, commit=False
    )
    await _appliquer_mouvement(
        session,
        portefeuille,
        "CREDIT",
        transaction.frais_plateforme,
        "commission_colis",
        transaction.id,
    )
    commission = Commission(
        transaction_id=transaction.id,
        receveur_id=transaction.beneficiaire_id,
        montant_fcfa=transaction.frais_plateforme,
        statut="verse",
        portefeuille_id=portefeuille.id,
        verse_le=datetime.now(timezone.utc),
    )
    session.add(commission)
    await session.flush()
    return commission, portefeuille


async def obtenir_commission_de_transaction(
    session: AsyncSession, transaction_id: UUID
) -> Commission | None:
    return await session.scalar(
        select(Commission).where(Commission.transaction_id == transaction_id)
    )


async def lister_commissions(
    session: AsyncSession, receveur_id: UUID, page: int, par_page: int
):
    """Historique des commissions d'un receveur (sa cagnotte)."""
    requete = (
        select(Commission)
        .where(Commission.receveur_id == receveur_id)
        .order_by(Commission.cree_le.desc())
    )
    return await _paginer(session, requete, page, par_page)


async def _resultat(
    session: AsyncSession, transaction: TransactionPaiement, message: str
) -> dict:
    """Assemble la réponse d'un paiement (transaction + commission + wallet)."""
    commission = await obtenir_commission_de_transaction(session, transaction.id)
    portefeuille = None
    if commission is not None and commission.portefeuille_id is not None:
        portefeuille = await session.get(Portefeuille, commission.portefeuille_id)
    return {
        "transaction": schemas.TransactionResponse.model_validate(transaction),
        "commission": (
            schemas.CommissionResponse.model_validate(commission)
            if commission is not None else None
        ),
        "portefeuille_beneficiaire": (
            schemas.PortefeuilleResponse.model_validate(portefeuille)
            if portefeuille is not None else None
        ),
        "message": message,
    }


# ─── Transactions ────────────────────────────────────────────────────

async def _obtenir_transaction_par_reference(
    session: AsyncSession, reference: str
) -> TransactionPaiement:
    transaction = await session.scalar(
        select(TransactionPaiement).where(TransactionPaiement.reference == reference)
    )
    if transaction is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="Transaction introuvable"
        )
    return transaction


async def creer_transaction(
    session: AsyncSession,
    donnees: schemas.TransactionCreate,
    utilisateur: Utilisateur,
) -> dict:
    """
    Ordonne un paiement. Pour les espèces, le paiement réussit immédiatement et
    la commission est créditée tout de suite ; pour le mobile money, la
    transaction reste « en attente » jusqu'à confirmation.
    """
    # 1. Idempotence : même clé -> on renvoie la transaction déjà créée.
    if donnees.idempotency_key:
        existante = await session.scalar(
            select(TransactionPaiement).where(
                TransactionPaiement.idempotency_key == donnees.idempotency_key
            )
        )
        if existante is not None:
            return await _resultat(
                session, existante, "Paiement déjà enregistré (idempotent)."
            )

    # 2. Résolution de l'objet payé (colis).
    colis = None
    if donnees.colis_id is not None:
        colis = await session.get(Colis, donnees.colis_id)
        if colis is None:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND, detail="Colis introuvable"
            )

    montant = donnees.montant_fcfa
    if montant is None:
        montant = colis.frais_fcfa if colis is not None else 0
    montant = int(montant)
    if montant <= 0:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Le montant doit être supérieur à 0"
        )

    # 3. Commission reversée au receveur (uniquement pour un colis).
    frais_plateforme = 0
    beneficiaire_id = None
    if donnees.type == "COLIS" and colis is not None:
        frais_plateforme = min(int(parametres.commission_receveur_fcfa), montant)
        beneficiaire_id = colis.receveur_id
    montant_net = montant - frais_plateforme

    payeur_id = donnees.payeur_id or utilisateur.id

    # 4. Ordonnancement auprès du fournisseur.
    try:
        fournisseur = obtenir_fournisseur(donnees.moyen)
    except MoyenPaiementInconnu as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc))

    reference = await _generer_reference(session)
    resultat = fournisseur.initier(montant, donnees.telephone, reference)

    transaction = TransactionPaiement(
        reference=reference,
        idempotency_key=donnees.idempotency_key,
        payeur_id=payeur_id,
        beneficiaire_id=beneficiaire_id,
        type=donnees.type,
        colis_id=colis.id if colis is not None else None,
        montant_fcfa=montant,
        frais_plateforme=frais_plateforme,
        montant_net=montant_net,
        statut=resultat.statut,
        moyen=donnees.moyen,
        telephone=donnees.telephone,
        confirme_le=datetime.now(timezone.utc) if resultat.statut == "reussi" else None,
    )
    session.add(transaction)
    try:
        await session.flush()
    except IntegrityError:
        # Concurrence sur la clé d'idempotence : on renvoie l'existante.
        await session.rollback()
        if donnees.idempotency_key:
            existante = await session.scalar(
                select(TransactionPaiement).where(
                    TransactionPaiement.idempotency_key == donnees.idempotency_key
                )
            )
            if existante is not None:
                return await _resultat(
                    session, existante, "Paiement déjà enregistré (idempotent)."
                )
        raise

    # 5. Crédit immédiat de la cagnotte si le paiement a réussi (espèces).
    if resultat.statut == "reussi":
        await _verser_commission(session, transaction)

    await session.commit()
    await session.refresh(transaction)
    message = resultat.instruction or (
        "Paiement encaissé, cagnotte du receveur créditée."
        if resultat.statut == "reussi"
        else "Paiement enregistré, en attente de validation."
    )
    return await _resultat(session, transaction, message)


async def confirmer_transaction(
    session: AsyncSession, reference: str
) -> dict:
    """
    Confirme une transaction en attente (retour opérateur / webhook simulé).

    Idempotent : confirmer une transaction déjà réussie ne re-crédite pas la
    cagnotte (la commission existe déjà).
    """
    transaction = await _obtenir_transaction_par_reference(session, reference)

    if transaction.statut == "reussi":
        return await _resultat(
            session, transaction, "Paiement déjà confirmé (idempotent)."
        )
    if transaction.statut != "en_attente":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"Cette transaction ne peut pas être confirmée (statut : {transaction.statut})",
        )

    transaction.statut = "reussi"
    transaction.confirme_le = datetime.now(timezone.utc)
    await _verser_commission(session, transaction)
    await session.commit()
    await session.refresh(transaction)
    return await _resultat(session, transaction, "Paiement confirmé, cagnotte créditée.")


async def lister_transactions(
    session: AsyncSession,
    page: int,
    par_page: int,
    *,
    colis_id: UUID | None = None,
    payeur_id: UUID | None = None,
    statut: str | None = None,
):
    requete = select(TransactionPaiement)
    if colis_id is not None:
        requete = requete.where(TransactionPaiement.colis_id == colis_id)
    if payeur_id is not None:
        requete = requete.where(TransactionPaiement.payeur_id == payeur_id)
    if statut is not None:
        requete = requete.where(TransactionPaiement.statut == statut)
    requete = requete.order_by(TransactionPaiement.cree_le.desc())
    return await _paginer(session, requete, page, par_page)
