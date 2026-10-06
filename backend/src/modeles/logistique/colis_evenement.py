# -*- coding: utf-8 -*-
"""
Modèle ColisEvenement — timeline d'un colis + journal de scan idempotent.

Chaque événement est horodaté et, s'il provient d'un scan terrain, porte une
``idempotency_key`` unique (réseau instable / doublons hors-ligne). C'est ce
verrou qui garantit qu'un même scan n'est jamais enregistré deux fois.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from src.base_donnees.base import Base, MelangeTracabilite

# Types d'événement du cycle de vie d'un colis
TYPES_EVENEMENT_COLIS = (
    "enregistrement",
    "affectation",
    "depart",
    "mise_en_transit",
    "arrivee",
    "livraison",
    "incident",
)


class ColisEvenement(Base, MelangeTracabilite):
    """Événement horodaté du cycle de vie d'un colis (timeline)."""

    __tablename__ = "colis_evenements"
    __table_args__ = (
        Index("ix_colis_evenements_colis", "colis_id"),
        Index("ix_colis_evenements_type", "type_evenement"),
        Index("ix_colis_evenements_horodatage", "horodatage"),
        Index("ix_colis_evenements_acteur", "acteur_id"),
        Index(
            "ix_colis_evenements_idempotency_unique",
            "idempotency_key",
            unique=True,
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    colis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("colis.id", ondelete="CASCADE"),
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
    # Clé d'idempotence fournie par le client (scan hors-ligne / doublon réseau).
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    synchro_le: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def __repr__(self) -> str:
        return f"<ColisEvenement {self.type_evenement} colis={self.colis_id}>"
