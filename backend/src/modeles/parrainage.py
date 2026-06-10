# -*- coding: utf-8 -*-
"""
Modele Parrainage — systeme d'invitation entre utilisateurs.

Chaque utilisateur a un code unique a 8 caracteres. Quand un nouvel utilisateur
s'inscrit en saisissant ce code, on cree un enregistrement de parrainage.

Avantages :
  - Le parrain gagne 5 points de score
  - Le filleul gagne 3 points de score
  - Un badge "SOCIAL" est debloque pour le parrain
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base


class Parrainage(Base):
    """Une relation parrain -> filleul."""

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Le parrain
    parrain_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Le filleul (unique : on ne peut etre parraine qu'une seule fois)
    filleul_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # Un filleul ne peut avoir qu'un seul parrain
        index=True,
    )

    # Code de parrainage utilise
    code_utilise: Mapped[str] = mapped_column(String(8), nullable=False)

    # Quand le parrainage a eu lieu (= inscription du filleul)
    date_parrainage: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Un parrain ne peut pas se parrainer lui-meme (verifie dans le service)
    def __repr__(self) -> str:
        return f"<Parrainage {self.parrain_id} -> {self.filleul_id} ({self.code_utilise})>"
