# -*- coding: utf-8 -*-
"""
Modele Badge — medailles debloquees par l'utilisateur a travers son usage.

Liste des badges disponibles :
  - PIONNIER : un des 100 premiers inscrits
  - BIENVENUE : premiere connexion reussie
  - PROFIL_COMPLET : tous les champs du profil remplis
  - SECURITE_PLUS : 2FA activee
  - VERIFIE : email verifie
  - STREAK_3_JOURS : 3 jours consecutifs d'activite
  - STREAK_7_JOURS : 7 jours consecutifs (1 semaine)
  - STREAK_30_JOURS : 30 jours consecutifs (1 mois)
  - SCORE_50 : score atteint 50
  - SCORE_80 : score atteint 80 (excellent)
  - CONFIANT : tous les consentements facultatifs accordes
  - SOCIAL : a invite au moins 1 personne qui s'est inscrite
  - CHATBOT_ACTIF : 10 conversations creees
  - DOCUMENT_PARTAGE : a uploade au moins 1 document

Chaque badge debloque donne aussi un petit bonus de score.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base


class Badge(Base):
    """Un badge debloque par un utilisateur."""

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

    # Code technique du badge (ex : "STREAK_7_JOURS")
    code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    # Date de deblocage
    date_obtention: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Bonus de score donne par ce badge (1-10 points)
    bonus_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Un badge ne peut etre debloque qu'une seule fois par utilisateur
    __table_args__ = (
        UniqueConstraint("utilisateur_id", "code", name="uq_badge_utilisateur_code"),
    )

    def __repr__(self) -> str:
        return f"<Badge {self.code} pour {self.utilisateur_id} obtenu le {self.date_obtention}>"
