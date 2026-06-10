# -*- coding: utf-8 -*-
"""Modele pour les codes de verification email/telephone."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, String, ForeignKey, Enum as SAEnum, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base, MelangeTracabilite
from src.config.constantes import NiveauxRisque


class CodeVerification(Base, MelangeTracabilite):
    """Code de verification envoye par email ou SMS pour confirmer une identite."""

    CANAL_EMAIL = "email"
    CANAL_SMS = "sms"
    CANAL_APPEL = "appel"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    utilisateur_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    canal: Mapped[str] = mapped_column(
        String(20), nullable=False, default=CANAL_EMAIL,
    )
    code: Mapped[str] = mapped_column(
        String(6), nullable=False, doc="Code a 6 chiffres",
    )
    destination: Mapped[str] = mapped_column(
        String(256), nullable=False,
        doc="Email ou numero de telephone destination",
    )
    tentative: Mapped[int] = mapped_column(
        default=0, nullable=False, doc="Nombre de tentatives echouees",
    )
    est_utilise: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False,
    )
    date_expiration: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )
    type_verification: Mapped[str] = mapped_column(
        String(30), nullable=False, default="inscription",
        doc="inscription, changement_email, changement_telephone",
    )
