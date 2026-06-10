# -*- coding: utf-8 -*-
"""
Modèle SessionAuthentification — sessions actives des utilisateurs.

Chaque connexion crée une session avec :
  - Un token de rafraîchissement (refresh token)
  - L'appareil utilisé (user agent)
  - L'adresse IP
  - La date d'expiration

Permet de :
  - Lister les sessions actives d'un utilisateur (« Mes appareils connectés »)
  - Révoquer une session à distance
  - Détecter les connexions suspectes (nouvelles géolocalisations)
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


class SessionAuthentification(Base, MelangeTracabilite):
    """Table des sessions actives — un enregistrement par appareil connecté."""

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

    # --- Token de rafraîchissement ---
    refresh_token_hash: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
        doc="Hash SHA-256 du refresh token — on ne stocke jamais le token en clair"
    )

    # --- Informations de connexion ---
    adresse_ip: Mapped[str] = mapped_column(String(45), nullable=False)
    agent_utilisateur: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ville_estimee: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    pays_estime: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # --- Cycle de vie ---
    date_expiration: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    date_derniere_utilisation: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    est_revoquee: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    raison_revocation: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # --- Relations ---
    utilisateur: Mapped["Utilisateur"] = relationship(back_populates="sessions_authentification")

    def __repr__(self) -> str:
        return f"<SessionAuth utilisateur={self.utilisateur_id} expire={self.date_expiration}>"
