# -*- coding: utf-8 -*-
"""
Modèle MouvementPortefeuille — trace **immuable** de chaque variation de solde.

Règle d'or : on n'écrit jamais `portefeuilles.solde_fcfa` sans créer, dans la
même transaction, un mouvement qui explique la variation (sens, montant,
motif, solde résultant). C'est la garantie d'auditabilité du flux financier.
"""
import uuid
from typing import Optional

from sqlalchemy import ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base, MelangeTracabilite

# Sens d'un mouvement de portefeuille
SENS_MOUVEMENT = ("CREDIT", "DEBIT")

# Motifs métier (facilite les rapports et les reçus)
MOTIFS_MOUVEMENT = (
    "commission_colis",   # 25 FCFA reversés au receveur sur un colis
    "commission_api",     # reversement sur l'API de certification
    "reversement",        # virement de la cagnotte vers mobile money
    "abonnement",         # paiement d'un pack e-commerçant
    "ajustement",         # correction manuelle (administration)
    "paiement",           # paiement direct depuis le solde du wallet
)


class MouvementPortefeuille(Base, MelangeTracabilite):
    """Ligne d'historique d'un portefeuille (crédit ou débit)."""

    __tablename__ = "mouvements_portefeuille"
    __table_args__ = (
        Index("ix_mouvements_portefeuille_pf", "portefeuille_id"),
        Index("ix_mouvements_portefeuille_sens", "sens"),
        Index("ix_mouvements_portefeuille_motif", "motif"),
        Index("ix_mouvements_portefeuille_reference", "reference_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    portefeuille_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("portefeuilles.id", ondelete="CASCADE"),
        nullable=False,
    )
    sens: Mapped[str] = mapped_column(String(10), nullable=False)
    montant_fcfa: Mapped[int] = mapped_column(Integer, nullable=False)
    motif: Mapped[str] = mapped_column(String(60), nullable=False)
    # Référence logique vers l'objet déclencheur (transaction, reversement…).
    reference_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    solde_apres: Mapped[int] = mapped_column(Integer, nullable=False)

    def __repr__(self) -> str:
        return (
            f"<Mouvement {self.sens} {self.montant_fcfa} "
            f"motif={self.motif} solde={self.solde_apres}>"
        )
