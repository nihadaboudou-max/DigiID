# -*- coding: utf-8 -*-
"""Modèle de base pour les incidents détectés par le moteur de fraude."""
import uuid
from typing import Optional

from sqlalchemy import JSON, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base, MelangeTracabilite


class FraudeIncident(Base, MelangeTracabilite):
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
    type_action: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    score_risque: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    niveau: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    adresse_ip: Mapped[Optional[str]] = mapped_column(
        String(45),
        nullable=True,
    )
    appareil: Mapped[Optional[str]] = mapped_column(
        String(200),
        nullable=True,
    )
    details: Mapped[Optional[dict]] = mapped_column(
        JSON,
        nullable=True,
    )
