# -*- coding: utf-8 -*-
"""Modèle de recherche faciale pour les agents médicaux."""
import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from src.modeles.utilisateur import Utilisateur

from sqlalchemy import JSON, DateTime, ForeignKey, Float, Integer, String, Boolean, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from src.base_donnees.base import Base, MelangeTracabilite


class RechercheFaciale(Base, MelangeTracabilite):
    """
    Historique des recherches faciales effectuées par les agents médicaux.
    Calqué sur le modèle VerificationVisuelle.
    """
    __tablename__ = "recherches_faciales"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    agent_medical_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    personne_trouvee_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    nom_fichier_photo: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    type_mime: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        comment="Type MIME de la photo uploadée (ex: image/jpeg)",
    )

    taille_octets: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        comment="Taille de la photo en octets",
    )

    score_confiance: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
        comment="Score de confiance de la reconnaissance faciale (0-100)",
    )

    temps_analyse_ms: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Temps d'analyse en millisecondes",
    )

    resultat_recherche: Mapped[Optional[dict]] = mapped_column(
        JSON,
        nullable=True,
        comment="Détails du résultat de la recherche (méthode, métadonnées)",
    )

    # --- Soft delete (comme verification_visuelle) ---
    est_supprime: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    date_suppression: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # --- Relations ---
    agent_medical: Mapped["Utilisateur"] = relationship(
        "Utilisateur",
        foreign_keys=[agent_medical_id],
        back_populates="recherches_faciales_agent",
        lazy="selectin",
    )
    personne_trouvee: Mapped[Optional["Utilisateur"]] = relationship(
        "Utilisateur",
        foreign_keys=[personne_trouvee_id],
        back_populates="recherches_faciales_trouve",
        lazy="selectin",
    )

    # --- Index composites ---
    __table_args__ = (
        Index(
            "ix_recherches_faciales_agent_date",
            "agent_medical_id",
            "cree_le",
        ),
        Index(
            "ix_recherches_faciales_non_supprime",
            "agent_medical_id",
            "est_supprime",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<RechercheFaciale id={self.id} agent={self.agent_medical_id} "
            f"score={self.score_confiance} trouve={self.personne_trouvee_id is not None}>"
        )