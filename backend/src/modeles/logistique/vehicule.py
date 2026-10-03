# -*- coding: utf-8 -*-
"""
Modèle Vehicule — bus/engin affecté à une gare.
"""
import uuid
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base, MelangeTracabilite


class Vehicule(Base, MelangeTracabilite):
    """Véhicule de transport (immatriculation unique)."""

    __tablename__ = "vehicules"
    __table_args__ = (
        Index("ix_vehicules_immatriculation_unique", "immatriculation", unique=True),
        Index("ix_vehicules_gare", "gare_id"),
        Index("ix_vehicules_actif", "actif"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    immatriculation: Mapped[str] = mapped_column(String(30), nullable=False)
    marque: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    capacite: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    gare_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gares.id", ondelete="SET NULL"),
        nullable=True,
    )
    actif: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    def __repr__(self) -> str:
        return f"<Vehicule {self.immatriculation}>"
