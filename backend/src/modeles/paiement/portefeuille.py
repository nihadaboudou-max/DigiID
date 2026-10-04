# -*- coding: utf-8 -*-
"""
Modèle Portefeuille — cagnotte d'un acteur du réseau (receveur, chauffeur…).

Le portefeuille stocke le **solde disponible** en FCFA. Chaque variation du
solde est tracée dans ``mouvements_portefeuille`` (jamais de modification
silencieuse : le solde ET le mouvement sont écrits dans la même transaction).
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base, MelangeTracabilite

# Devises supportées (le franc CFA est la devise de référence du prototype)
DEVISES = ("XOF",)


class Portefeuille(Base, MelangeTracabilite):
    """Portefeuille électronique d'un propriétaire (utilisateur DigiID)."""

    __tablename__ = "portefeuilles"
    __table_args__ = (
        # Un seul portefeuille par propriétaire.
        Index("ix_portefeuilles_proprietaire_unique", "proprietaire_id", unique=True),
        Index("ix_portefeuilles_actif", "actif"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    proprietaire_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="CASCADE"),
        nullable=False,
    )
    solde_fcfa: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    devise: Mapped[str] = mapped_column(
        String(3), nullable=False, default="XOF", server_default="XOF"
    )
    actif: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    # Date du dernier mouvement (distincte de `modifie_le` : sert à l'affichage).
    maj_le: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def __repr__(self) -> str:
        return f"<Portefeuille {self.proprietaire_id} solde={self.solde_fcfa}>"
