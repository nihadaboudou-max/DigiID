# -*- coding: utf-8 -*-
"""
Modèle Ticket — titre de transport portant un QR **et** un numéro en clair.

Un ticket est **polymorphe** (`type` + `reference_id`) : il porte aujourd'hui les
colis (type=COLIS) et accueillera les bagages/passagers (S9). Le numéro lisible
`code_clair` (ex. ``COT-2026-000123``) et le jeton `qr_token` sont la **source
unique** d'identification : le colis y renvoie via ``Colis.ticket_id``.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base, MelangeTracabilite

# Types de ticket (colis aujourd'hui ; bagages/passagers à venir en S9)
TYPES_TICKET = ("COLIS", "BAGAGE", "PASSAGER", "ENFANT")

# Statuts d'un ticket
STATUTS_TICKET = ("emis", "en_transit", "livre", "annule")


class Ticket(Base, MelangeTracabilite):
    """Ticket/étiquette portant un QR dynamique et un numéro lisible en clair."""

    __tablename__ = "tickets"
    __table_args__ = (
        Index("ix_tickets_code_clair_unique", "code_clair", unique=True),
        Index("ix_tickets_qr_token_unique", "qr_token", unique=True),
        Index("ix_tickets_type", "type"),
        Index("ix_tickets_reference", "reference_id"),
        Index("ix_tickets_voyage", "voyage_id"),
        Index("ix_tickets_statut", "statut"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code_clair: Mapped[str] = mapped_column(String(40), nullable=False)
    qr_token: Mapped[str] = mapped_column(String(96), nullable=False)
    type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="COLIS", server_default="COLIS"
    )
    # Référence logique vers l'entité porteuse (colis.id aujourd'hui, bagage.id demain).
    # Pas de FK : le ticket est polymorphe.
    reference_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    voyage_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("voyages.id", ondelete="SET NULL"),
        nullable=True,
    )
    statut: Mapped[str] = mapped_column(
        String(30), nullable=False, default="emis", server_default="emis"
    )
    nb_scans: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    premier_scan_le: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    imprime_le: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def __repr__(self) -> str:
        return f"<Ticket {self.code_clair} type={self.type} statut={self.statut}>"
