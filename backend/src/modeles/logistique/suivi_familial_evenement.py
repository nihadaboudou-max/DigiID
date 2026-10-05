# -*- coding: utf-8 -*-
"""
Modèle SuiviFamilialEvenement — timeline du voyage d'un enfant (S7).

Même logique que ``colis_evenements`` : chaque événement est horodaté et peut
porter une ``idempotency_key`` (scan hors-ligne / doublon réseau) pour éviter
les enregistrements multiples.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from src.base_donnees.base import Base, MelangeTracabilite

# Types d'événement du voyage d'un enfant
TYPES_EVENEMENT_SUIVI = (
    "enregistrement",
    "depart",
    "arrivee",
    "livraison",
    "incident",
)


class SuiviFamilialEvenement(Base, MelangeTracabilite):
    """Événement horodaté du voyage d'un enfant suivi (timeline publique)."""

    __tablename__ = "suivi_familial_evenements"
    __table_args__ = (
        Index("ix_suivi_fam_evenements_suivi", "suivi_familial_id"),
        Index("ix_suivi_fam_evenements_type", "type_evenement"),
        Index("ix_suivi_fam_evenements_horodatage", "horodatage"),
        Index(
            "ix_suivi_fam_evenements_idempotency_unique",
            "idempotency_key",
            unique=True,
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    suivi_familial_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("suivi_familial.id", ondelete="CASCADE"),
        nullable=False,
    )
    type_evenement: Mapped[str] = mapped_column(String(40), nullable=False)
    acteur_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="SET NULL"),
        nullable=True,
    )
    gare_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gares.id", ondelete="SET NULL"),
        nullable=True,
    )
    localisation: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    horodatage: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    synchro_le: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def __repr__(self) -> str:
        return f"<SuiviFamilialEvenement {self.type_evenement} suivi={self.suivi_familial_id}>"
