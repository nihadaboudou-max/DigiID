# -*- coding: utf-8 -*-
"""
Modèle Invitation — Système d'invitation sécurisé pour admins/chefs.

Permet d'inviter des utilisateurs à rejoindre un domaine ou département
via un lien sécurisé avec token à usage unique.
"""
import secrets
from datetime import datetime, timedelta
from uuid import uuid4

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, String, Text, Index, func
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from src.noyau.base import Base


class Invitation(Base):
    """
    Invitation à rejoindre un domaine/département.
    
    Attributs:
        id: UUID unique
        token: Token sécurisé (URL-safe, 32 bytes)
        email_destinataire: Email de la personne invitée
        role_propose: Rôle proposé (admin_domaine, chef_police, etc.)
        domaine_id: Domaine cible
        departement_id: Département cible (optionnel)
        invite_par_id: UUID de l'utilisateur qui invite
        est_acceptee: Invitation acceptée ou non
        est_expiree: Invitation expirée
        date_expiration: Date d'expiration (par défaut 7 jours)
        date_acceptation: Date d'acceptation
        utilisateur_cree_id: UUID de l'utilisateur créé après acceptation
    """
    __tablename__ = "invitations"
    __table_args__ = (
        Index("ix_invitations_token", "token", unique=True),
        Index("ix_invitations_email", "email_destinataire"),
        Index("ix_invitations_domaine", "domaine_id"),
        Index("ix_invitations_expiree", "date_expiration"),
    )

    # ─── Identifiants ────────────────────────────────────────────────
    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )
    
    token = Column(
        String(64),
        nullable=False,
        unique=True,
        default=lambda: secrets.token_urlsafe(32),
        comment="Token sécurisé unique",
    )
    
    email_destinataire = Column(
        String(255),
        nullable=False,
        index=True,
        comment="Email de la personne invitée",
    )

    # ─── Rôle et ciblage ─────────────────────────────────────────────
    role_propose = Column(
        String(50),
        nullable=False,
        comment="Rôle proposé: admin_domaine, chef_police, chef_medical, etc.",
    )
    
    domaine_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("domaines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    departement_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("departements.id", ondelete="CASCADE"),
        nullable=True,
        comment="Requis si role = chef_*",
    )

    # ─── Métadonnées ─────────────────────────────────────────────────
    invite_par_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="SET NULL"),
        nullable=False,
        comment="Utilisateur qui a envoyé l'invitation",
    )
    
    message_personnalise = Column(
        Text,
        nullable=True,
        comment="Message personnalisé avec l'invitation",
    )

    # ─── Statut ──────────────────────────────────────────────────────
    est_acceptee = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    
    date_expiration = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.utcnow() + timedelta(days=7),
        comment="Expiration par défaut: 7 jours",
    )
    
    date_acceptation = Column(
        DateTime(timezone=True),
        nullable=True,
    )
    
    utilisateur_cree_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="SET NULL"),
        nullable=True,
        comment="Utilisateur créé après acceptation",
    )
    
    date_creation = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # ─── Relations ───────────────────────────────────────────────────
    domaine = relationship("Domaine", backref="invitations")
    departement = relationship("Departement", backref="invitations")
    inviteur = relationship(
        "Utilisateur",
        foreign_keys=[invite_par_id],
        backref="invitations_envoyees",
    )
    utilisateur_cree = relationship(
        "Utilisateur",
        foreign_keys=[utilisateur_cree_id],
        backref="invitation_recue",
    )

    def __repr__(self) -> str:
        return f"<Invitation {self.email_destinataire} → {self.role_propose}>"

    @property
    def est_expiree(self) -> bool:
        """Vérifie si l'invitation est expirée."""
        return datetime.utcnow() > self.date_expiration

    @property
    def est_valide(self) -> bool:
        """Vérifie si l'invitation peut encore être acceptée."""
        return (
            not self.est_acceptee
            and not self.est_expiree
            and self.utilisateur_cree_id is None
        )

    def accepter(self, utilisateur_id) -> None:
        """Marque l'invitation comme acceptée."""
        self.est_acceptee = True
        self.date_acceptation = datetime.utcnow()
        self.utilisateur_cree_id = utilisateur_id

    def generer_lien_invitation(self, base_url: str) -> str:
        """Génère le lien d'invitation complet."""
        return f"{base_url}/invitations/{self.token}"
     