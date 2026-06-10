# -*- coding: utf-8 -*-
"""Modèle de vérification visuelle des utilisateurs."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, DateTime, ForeignKey, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base, MelangeTracabilite


class VerificationVisuelle(Base, MelangeTracabilite):
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
    nom_fichier: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    type_mime: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    taille_octets: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    statut: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )
    raison: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    score_liveness: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
    )
    score_similarite: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
    )
    embedding: Mapped[Optional[list[float]]] = mapped_column(
        JSON,
        nullable=True,
    )
    doublons: Mapped[Optional[list[dict]]] = mapped_column(
        JSON,
        nullable=True,
    )
    details: Mapped[Optional[dict]] = mapped_column(
        JSON,
        nullable=True,
    )
    date_verification: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    # --- Corbeille (soft-delete) ---
    est_supprime: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )
    date_suppression: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
