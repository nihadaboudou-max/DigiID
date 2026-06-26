# -*- coding: utf-8 -*-
"""
Modele pour les tokens de reinitialisation de mot de passe.

Stocke un hash du token JWT emis lors d'une demande "mot de passe oublié".
Permet la revocation du token et le suivi des tentatives.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, String, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base, MelangeTracabilite


class TokenReinitialisation(Base, MelangeTracabilite):
    """
    Token de reinitialisation de mot de passe.

    Cree lors d'une demande "mot de passe oublie", consomme
    lors de la reinitialisation effective.
    """

    __tablename__ = "token_reinitialisation"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    utilisateur_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(
        String(64), nullable=False,
        doc="Hash SHA-256 du token JWT de reinitialisation",
    )
    est_utilise: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False,
    )
    date_expiration: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )
    date_utilisation: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    adresse_ip_demande: Mapped[Optional[str]] = mapped_column(
        String(45), nullable=True,
        doc="Adresse IP lors de la demande de reinitialisation",
    )
    tentative: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False,
        doc="Nombre de tentatives echouees",
    )
