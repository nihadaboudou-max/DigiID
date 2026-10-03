# -*- coding: utf-8 -*-
"""
Modèle ActeurLogistique — receveur/chauffeur/gérant rattaché à une gare.

Fait le lien entre un utilisateur DigiID et une gare, avec son rôle métier.
"""
import uuid
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base, MelangeTracabilite

# Rôles métier logistiques autorisés pour un acteur
ROLES_ACTEUR = ("receveur", "chauffeur", "gerant_gare", "commercant")


class ActeurLogistique(Base, MelangeTracabilite):
    """Acteur logistique rattaché à une gare."""

    __tablename__ = "acteurs_logistiques"
    __table_args__ = (
        Index("ix_acteurs_utilisateur", "utilisateur_id"),
        Index("ix_acteurs_gare", "gare_id"),
        Index("ix_acteurs_role", "role"),
        Index("ix_acteurs_licence_unique", "numero_licence", unique=True),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    utilisateur_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    gare_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("gares.id", ondelete="CASCADE"), nullable=False
    )
    numero_licence: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    actif: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    def __repr__(self) -> str:
        return f"<ActeurLogistique {self.role} gare={self.gare_id}>"
