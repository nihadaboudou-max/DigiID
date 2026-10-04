# -*- coding: utf-8 -*-
"""
Modèle Commission — micro-commission versée au receveur sur un colis.

Règle métier (Plan B) : sur les 100 FCFA d'un enregistrement de colis,
**25 FCFA sont reversés au receveur** (cagnotte). La commission est la trace
comptable de ce reversement ; une contrainte d'unicité
(transaction_id, receveur_id) interdit tout doublon.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base, MelangeTracabilite

# Statuts d'une commission
STATUTS_COMMISSION = ("a_verser", "verse", "annule")


class Commission(Base, MelangeTracabilite):
    """Commission reversée au receveur (crédit automatique de sa cagnotte)."""

    __tablename__ = "commissions"
    __table_args__ = (
        Index("ix_commissions_transaction", "transaction_id"),
        Index("ix_commissions_receveur", "receveur_id"),
        Index("ix_commissions_statut", "statut"),
        # Anti-double-versement : une seule commission par (transaction, receveur).
        Index(
            "ix_commissions_transaction_receveur_unique",
            "transaction_id",
            "receveur_id",
            unique=True,
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transactions_paiement.id", ondelete="CASCADE"),
        nullable=False,
    )
    receveur_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("utilisateur.id", ondelete="SET NULL"),
        nullable=True,
    )
    montant_fcfa: Mapped[int] = mapped_column(Integer, nullable=False)
    statut: Mapped[str] = mapped_column(
        String(20), nullable=False, default="a_verser", server_default="a_verser"
    )
    portefeuille_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("portefeuilles.id", ondelete="SET NULL"),
        nullable=True,
    )
    verse_le: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def __repr__(self) -> str:
        return f"<Commission {self.montant_fcfa} receveur={self.receveur_id}>"
