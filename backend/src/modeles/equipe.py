# -*- coding: utf-8 -*-
"""Modèle Équipe — Groupe d'utilisateurs au sein d'un département."""
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, String, Text, Index, func
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from src.base_donnees.base import Base


class Equipe(Base):
    """
    Équipe — Groupe d'utilisateurs au sein d'un département.
    
    Attributs:
        id: Identifiant unique UUID
        nom: Nom de l'équipe (ex: "Brigade Nord")
        description: Description optionnelle
        departement_id: Département parent
        chef_id: Chef de l'équipe
        est_actif: Équipe active ou désactivée
    """
    __tablename__ = "equipes"
    __table_args__ = (
        Index("ix_equipes_departement", "departement_id"),
        Index("ix_equipes_chef", "chef_id"),
        Index("ix_equipes_actif", "est_actif"),
    )

    # ─── Identifiants ────────────────────────────────────────────────
    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    nom = Column(
        String(150),
        nullable=False,
        comment="Nom de l'équipe",
    )

    description = Column(
        Text,
        nullable=True,
        comment="Description optionnelle",
    )

    # ─── Hiérarchie ──────────────────────────────────────────────────
    departement_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("departements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Département parent",
    )

    chef_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Chef de l'équipe",
    )

    # ─── Statut ──────────────────────────────────────────────────────
    est_actif = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    date_creation = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    date_modification = Column(
        DateTime(timezone=True),
        nullable=True,
        onupdate=func.now(),
    )

    # ─── Relations (back_populates cohérents) ────────────────────────
    departement = relationship(
        "Departement",
        foreign_keys=[departement_id],
        back_populates="equipes",
        lazy="selectin",
    )

    chef = relationship(
        "Utilisateur",
        foreign_keys=[chef_id],
        back_populates="equipes_dirigees",
        lazy="selectin",
    )

    membres = relationship(
        "Utilisateur",
        secondary="equipe_membres",
        back_populates="equipes",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Equipe {self.nom} departement={self.departement_id}>"