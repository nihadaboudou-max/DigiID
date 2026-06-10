# -*- coding: utf-8 -*-
"""
Modèle Consentement — chaque consentement de l'utilisateur est tracé.

Conformité légale : la loi 2008-12 sénégalaise et le Code numérique
béninois imposent que chaque consentement soit :
  - Spécifique (par finalité)
  - Éclairé (explication fournie)
  - Libre (refus possible sans pénalité)
  - Révocable à tout moment
  - Tracé avec date et version du texte accepté
"""
import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.base_donnees.base import Base, MelangeTracabilite

if TYPE_CHECKING:
    from src.modeles.utilisateur import Utilisateur


class Consentement(Base, MelangeTracabilite):
    """Table des consentements donnés par les utilisateurs."""

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    utilisateur_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # --- De quoi parle ce consentement ---
    categorie: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
        doc="Catégorie : collecte_mobile_money, geolocalisation, marketing, "
            "verification_personnes_recherchees, etc."
    )
    version_texte: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        doc="Version du texte légal accepté (ex : 'CGU v1.2')"
    )
    texte_accepte: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="Texte exact que l'utilisateur a accepté — preuve juridique"
    )

    # --- Statut ---
    est_accorde: Mapped[bool] = mapped_column(Boolean, nullable=False)
    date_accord: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    date_retrait: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # --- Contexte ---
    adresse_ip_accord: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)

    # --- Relations ---
    utilisateur: Mapped["Utilisateur"] = relationship(back_populates="consentements")

    def __repr__(self) -> str:
        statut = "accordé" if self.est_accorde and not self.date_retrait else "retiré"
        return f"<Consentement {self.categorie} {statut}>"
