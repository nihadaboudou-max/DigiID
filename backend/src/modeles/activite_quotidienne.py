# -*- coding: utf-8 -*-
"""
Modele ActiviteQuotidienne — tracking de l'usage reel quotidien de chaque utilisateur.

Pour chaque jour ou un utilisateur fait au moins UNE action sur la plateforme,
on cree un enregistrement. C'est ce qui permet de calculer :
  - Le STREAK : nombre de jours consecutifs d'activite
  - La REGULARITE : nombre de jours actifs sur les 30 derniers
  - Le SCORE EVOLUTIF : monte chaque jour ou l'utilisateur revient

Plus l'utilisateur vient regulierement, plus son score grimpe.
"""
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base


class ActiviteQuotidienne(Base):
    """Une ligne par utilisateur par jour ou il a ete actif."""

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

    # Le jour de l'activite (UTC). Une seule ligne par utilisateur par jour.
    jour: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Compteur d'actions effectuees ce jour-la (incremente a chaque appel API sensible)
    nombre_actions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Type d'actions les plus frequentes (chaine simple, pas critique)
    derniere_action: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Premiere connexion du jour (pour suivre la routine quotidienne)
    date_premiere_action: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # Derniere action du jour (pour mesurer la duree de la session)
    date_derniere_action: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Une seule ligne par (utilisateur, jour) — empeche les doublons
    __table_args__ = (
        UniqueConstraint("utilisateur_id", "jour", name="uq_activite_utilisateur_jour"),
    )

    def __repr__(self) -> str:
        return f"<ActiviteQuotidienne {self.utilisateur_id} le {self.jour}: {self.nombre_actions} actions>"
