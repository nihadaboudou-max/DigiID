# -*- coding: utf-8 -*-
"""Modèle Invitation — Invitation par email pour rejoindre la plateforme."""
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, String, Text, Index, func
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from src.base_donnees.base import Base


class Invitation(Base):
    """
    Invitation par email — permet à un admin d'inviter un nouvel utilisateur.
    
    Attributs:
        id: Identifiant unique UUID
        email: Email du destinataire (en clair, car nécessaire pour l'envoi)
        token: Token sécurisé unique (usage unique)
        role: Rôle proposé (admin_domaine, chef_police, agent, etc.)
        domaine_id: Domaine d'affectation (optionnel pour citoyen)
        departement_id: Département d'affectation (optionnel)
        statut: en_attente | acceptee | expiree | annulee
        cree_par: UUID de l'utilisateur qui a créé l'invitation
        message: Message personnalisé (optionnel)
        date_expiration: Date d'expiration (7 jours par défaut)
    """
    __tablename__ = "invitations"
    __table_args__ = (
        Index("ix_invitations_token_unique", "token", unique=True),
        Index("ix_invitations_email", "email"),
        Index("ix_invitations_statut", "statut"),
        Index("ix_invitations_domaine", "domaine_id"),
        Index("ix_invitations_cree_par", "cree_par"),
    )

    # ─── Identifiants ────────────────────────────────────────────────
    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    email = Column(
        String(255),
        nullable=False,
        comment="Email du destinataire",
    )

    token = Column(
        String(64),
        nullable=False,
        unique=True,
        default=lambda: secrets.token_urlsafe(48),
        comment="Token sécurisé unique",
    )

    role = Column(
        String(50),
        nullable=False,
        comment="Rôle proposé (admin_domaine, chef_police, agent, etc.)",
    )

    # ─── Affectation ─────────────────────────────────────────────────
    domaine_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("domaines.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        comment="Domaine d'affectation",
    )

    departement_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("departements.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        comment="Département d'affectation",
    )

    # ─── Statut ──────────────────────────────────────────────────────
    statut = Column(
        String(20),
        nullable=False,
        default="en_attente",
        server_default="en_attente",
        comment="en_attente | acceptee | expiree | annulee",
    )

    cree_par = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="SET NULL"),
        nullable=False,
        index=True,
        comment="Utilisateur qui a créé l'invitation",
    )

    message = Column(
        Text,
        nullable=True,
        comment="Message personnalisé optionnel",
    )

    # ─── Dates ───────────────────────────────────────────────────────
    date_creation = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    date_expiration = Column(
        DateTime(timezone=True),
        nullable=False,
        comment="Date d'expiration (7 jours par défaut)",
    )

    date_acceptation = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Date à laquelle l'invitation a été acceptée",
    )

    # ─── Relations (back_populates cohérents) ────────────────────────
    domaine = relationship(
        "Domaine",
        foreign_keys=[domaine_id],
        back_populates="invitations",
        lazy="selectin",
    )

    departement = relationship(
        "Departement",
        foreign_keys=[departement_id],
        back_populates="invitations",
        lazy="selectin",
    )

    createur = relationship(
        "Utilisateur",
        foreign_keys=[cree_par],
        back_populates="invitations_creees",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Invitation {self.email} role={self.role} statut={self.statut}>"

    @property
    def est_expiree(self) -> bool:
        """Vérifie si l'invitation est expirée."""
        if self.statut != "en_attente":
            return False
        return datetime.now(timezone.utc) > self.date_expiration

    def marquer_acceptee(self) -> None:
        """Marque l'invitation comme acceptée."""
        self.statut = "acceptee"
        self.date_acceptation = datetime.now(timezone.utc)

    def annuler(self) -> None:
        """Annule l'invitation."""
        self.statut = "annulee"