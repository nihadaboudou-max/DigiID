# -*- coding: utf-8 -*-
"""
Modèle TransactionPaiement — ordonnancement d'un paiement (colis, abonnement…).

Une transaction est **idempotente** (`reference` unique + `idempotency_key`
unique) : un même paiement rejoué (réseau instable) ne crée jamais de doublon
ni de double commission.

Cycle : ``en_attente`` → ``reussi`` (ou ``echoue`` / ``rembourse``).
Le crédit de la cagnotte du receveur n'a lieu qu'au passage en ``reussi``.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base, MelangeTracabilite

# Types de paiement supportés (S6 : COLIS ; le reste arrive en S7)
TYPES_TRANSACTION = ("COLIS", "BAGAGE", "ABONNEMENT", "API", "REVERSEMENT")

# Statuts d'une transaction
STATUTS_TRANSACTION = ("en_attente", "reussi", "echoue", "rembourse")

# Moyens de paiement : espèces au guichet + 1 opérateur mobile money (mock).
MOYENS_PAIEMENT = ("especes", "wave")


class TransactionPaiement(Base, MelangeTracabilite):
    """Paiement d'un service logistique (colis aujourd'hui)."""

    __tablename__ = "transactions_paiement"
    __table_args__ = (
        Index("ix_transactions_paiement_reference_unique", "reference", unique=True),
        Index(
            "ix_transactions_paiement_idempotency_unique",
            "idempotency_key",
            unique=True,
        ),
        Index("ix_transactions_paiement_payeur", "payeur_id"),
        Index("ix_transactions_paiement_beneficiaire", "beneficiaire_id"),
        Index("ix_transactions_paiement_colis", "colis_id"),
        Index("ix_transactions_paiement_statut", "statut"),
        Index("ix_transactions_paiement_type", "type"),
        Index("ix_transactions_paiement_moyen", "moyen"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    reference: Mapped[str] = mapped_column(String(40), nullable=False)
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    # Qui paie (guichet / expéditeur) et qui encaisse (bénéficiaire = receveur).
    payeur_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("utilisateur.id", ondelete="SET NULL"),
        nullable=True,
    )
    beneficiaire_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("utilisateur.id", ondelete="SET NULL"),
        nullable=True,
    )
    type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="COLIS", server_default="COLIS"
    )
    # Objet payé (colis aujourd'hui ; bagage/abonnement demain).
    colis_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("colis.id", ondelete="SET NULL"), nullable=True
    )
    montant_fcfa: Mapped[int] = mapped_column(Integer, nullable=False)
    # Part plateforme = micro-commission reversée au receveur.
    frais_plateforme: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    montant_net: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    statut: Mapped[str] = mapped_column(
        String(20), nullable=False, default="en_attente", server_default="en_attente"
    )
    moyen: Mapped[str] = mapped_column(
        String(20), nullable=False, default="especes", server_default="especes"
    )
    # Numéro mobile money utilisé (si paiement par opérateur).
    telephone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    confirme_le: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def __repr__(self) -> str:
        return f"<Transaction {self.reference} {self.statut} {self.montant_fcfa}>"
