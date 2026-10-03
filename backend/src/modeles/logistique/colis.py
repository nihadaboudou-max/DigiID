# -*- coding: utf-8 -*-
"""
Modèle Colis — envoi de marchandises d'une gare de départ à une gare d'arrivée.

Le colis s'appuie sur un ``Ticket`` (QR + numéro en clair) qui porte son
identification ; il renvoie au ticket via ``ticket_id``. Son cycle de vie est
tracé dans ``colis_evenements`` (timeline + anti-double-scan).
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base, MelangeTracabilite

# Statuts du cycle de vie d'un colis
STATUTS_COLIS = ("enregistre", "en_transit", "arrive", "livre", "annule")


class Colis(Base, MelangeTracabilite):
    """Colis transporté entre deux gares."""

    __tablename__ = "colis"
    __table_args__ = (
        Index("ix_colis_ticket_unique", "ticket_id", unique=True),
        Index("ix_colis_expediteur", "expediteur_id"),
        Index("ix_colis_gare_depart", "gare_depart_id"),
        Index("ix_colis_gare_arrivee", "gare_arrivee_id"),
        Index("ix_colis_voyage", "voyage_id"),
        Index("ix_colis_receveur", "receveur_id"),
        Index("ix_colis_chauffeur", "chauffeur_id"),
        Index("ix_colis_statut", "statut"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Ticket porteur (QR + code clair). Identifiant unique côté colis.
    ticket_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="SET NULL"),
        nullable=True,
    )
    # Expéditeur (utilisateur DigiID) — facultatif (colis déposé par un tiers)
    expediteur_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="SET NULL"),
        nullable=True,
    )
    destinataire_nom: Mapped[str] = mapped_column(String(150), nullable=False)
    destinataire_tel: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    poids_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    valeur_fcfa: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    gare_depart_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gares.id", ondelete="RESTRICT"),
        nullable=False,
    )
    gare_arrivee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gares.id", ondelete="RESTRICT"),
        nullable=False,
    )
    voyage_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("voyages.id", ondelete="SET NULL"),
        nullable=True,
    )
    receveur_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="SET NULL"),
        nullable=True,
    )
    chauffeur_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="SET NULL"),
        nullable=True,
    )

    statut: Mapped[str] = mapped_column(
        String(30), nullable=False, default="enregistre", server_default="enregistre"
    )
    frais_fcfa: Mapped[int] = mapped_column(
        Integer, nullable=False, default=100, server_default="100"
    )
    livre_le: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def __repr__(self) -> str:
        return f"<Colis {self.id} statut={self.statut}>"
