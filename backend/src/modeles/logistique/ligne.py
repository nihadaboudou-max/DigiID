# -*- coding: utf-8 -*-
"""
Modèle Ligne — liaison entre deux gares (ex. Cotonou ↔ Parakou).
"""
import uuid
from typing import Optional

from sqlalchemy import Boolean, Float, ForeignKey, Index, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base, MelangeTracabilite


class Ligne(Base, MelangeTracabilite):
    """Ligne reliant une gare de départ à une gare d'arrivée."""

    __tablename__ = "lignes"
    __table_args__ = (
        Index("ix_lignes_depart", "gare_depart_id"),
        Index("ix_lignes_arrivee", "gare_arrivee_id"),
        Index("ix_lignes_actif", "actif"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    gare_depart_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gares.id", ondelete="CASCADE"),
        nullable=False,
    )
    gare_arrivee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gares.id", ondelete="CASCADE"),
        nullable=False,
    )
    distance_km: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    duree_min: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    actif: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    def __repr__(self) -> str:
        return f"<Ligne {self.gare_depart_id} -> {self.gare_arrivee_id}>"
