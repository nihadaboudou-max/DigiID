# -*- coding: utf-8 -*-
"""
Modèle Voyage — un trajet daté (ligne + véhicule + chauffeur).
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base, MelangeTracabilite

# Statuts possibles d'un voyage
STATUTS_VOYAGE = ("planifie", "en_cours", "termine", "annule")


class Voyage(Base, MelangeTracabilite):
    """Trajet daté affecté à une ligne, un véhicule et un chauffeur."""

    __tablename__ = "voyages"
    __table_args__ = (
        Index("ix_voyages_ligne", "ligne_id"),
        Index("ix_voyages_vehicule", "vehicule_id"),
        Index("ix_voyages_chauffeur", "chauffeur_id"),
        Index("ix_voyages_depart", "date_depart"),
        Index("ix_voyages_statut", "statut"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    ligne_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lignes.id", ondelete="CASCADE"), nullable=False
    )
    vehicule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vehicules.id", ondelete="RESTRICT"), nullable=False
    )
    chauffeur_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="SET NULL"),
        nullable=True,
    )
    date_depart: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    date_arrivee: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    statut: Mapped[str] = mapped_column(
        String(30), nullable=False, default="planifie", server_default="planifie"
    )

    def __repr__(self) -> str:
        return f"<Voyage {self.id} statut={self.statut}>"
