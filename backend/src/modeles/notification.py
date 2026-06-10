# -*- coding: utf-8 -*-
"""
Modele Notification — centre de notifications in-app pour l'utilisateur.

Notifications generees par le systeme :
  - Badge debloque
  - Score recalcule
  - Conseil personnalise pour ameliorer le score
  - Alerte de securite (nouvelle connexion)
  - Bienvenue
  - Streak en cours
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base, MelangeTracabilite


class Notification(Base, MelangeTracabilite):
    """Une notification a destination d'un utilisateur."""

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

    # Type de notification : "succes", "info", "alerte", "avertissement"
    type_notification: Mapped[str] = mapped_column(String(20), nullable=False, default="info")
    # Categorie : "badge", "score", "securite", "conseil", "systeme"
    categorie: Mapped[str] = mapped_column(String(30), nullable=False, default="systeme", index=True)

    # Contenu
    titre: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    # Lien d'action optionnel (ex : /score pour rediriger vers la page score)
    lien_action: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # Lue ou non
    est_lue: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    date_lecture: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<Notification {self.titre} pour {self.utilisateur_id} (lue={self.est_lue})>"
