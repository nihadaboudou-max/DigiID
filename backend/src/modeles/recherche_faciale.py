# -*- coding: utf-8 -*-
"""Modèle de recherche faciale pour les agents médicaux."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, DateTime, ForeignKey, Float, Integer, String, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.base_donnees.base import Base, MelangeTracabilite


class RechercheFaciale(Base, MelangeTracabilite):
    """
    Historique des recherches faciales effectuées par les agents médicaux.
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
    
    score_confiance: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
    )
    
    temps_analyse_ms: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    
    resultat_recherche: Mapped[Optional[dict]] = mapped_column(
        JSON,
        nullable=True,
    )
    
    date_recherche: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default="NOW()",
    )
    
    # --- Soft delete (comme verification_visuelle) ---
    est_supprime: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    
    # --- Relations ---
    # agent_medical: relationship("Utilisateur", back_populates="recherches_faciales")
    # personne_trouvee: relationship("Utilisateur", foreign_keys=[personne_trouvee_id])