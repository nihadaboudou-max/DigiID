# -*- coding: utf-8 -*-
"""
Modèle Gare — point de départ/arrivée du réseau logistique.

Une gare est rattachée à un domaine (cloisonnement) ; elle regroupe les
véhicules et les acteurs (receveurs/chauffeurs) qui y opèrent.
"""
import uuid
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base, MelangeTracabilite


class Gare(Base, MelangeTracabilite):
    """Gare routière."""

    __tablename__ = "gares"
    __table_args__ = (
        Index("ix_gares_code_unique", "code", unique=True),
        Index("ix_gares_ville", "ville"),
        Index("ix_gares_actif", "actif"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    nom: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    ville: Mapped[str] = mapped_column(String(100), nullable=False)
    domain_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("domaines.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    actif: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    def __repr__(self) -> str:
        return f"<Gare {self.code}: {self.nom}>"
