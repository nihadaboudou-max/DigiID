# -*- coding: utf-8 -*-
"""
Modèle Domaine — Entité géographique/organisationnelle de plus haut niveau.

Un domaine représente une région, une filiale, ou une division organisationnelle.
Exemples : "Domaine Nord", "Domaine Santé Publique", "Domaine ONG International".

Chaque domaine est administré par un Admin de Domaine qui a autorité complète
sur tous les départements et utilisateurs de son domaine.
"""
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, String, Text, Index, func
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from src.noyau.base import Base


class Domaine(Base):
    """
    Domaine organisationnel — plus haut niveau de cloisonnement.
    
    Attributs:
        id: Identifiant unique UUID
        nom: Nom du domaine (ex: "Domaine Nord")
        code: Code unique (ex: "DOM-NORD") pour références techniques
        description: Description optionnelle
        region: Région géographique (ex: "Nord", "Sud", "Centre")
        admin_id: UUID de l'Admin de Domaine (référence utilisateur)
        est_actif: Domaine actif ou suspendu
        date_creation: Date de création automatique
        date_modification: Date de dernière modification
        date_suspension: Date de suspension (si applicable)
        motif_suspension: Raison de la suspension
        
    Relations:
        admin: L'Admin de Domaine qui gère ce domaine
        departements: Liste des départements du domaine
        utilisateurs: Liste de tous les utilisateurs du domaine
    """
    __tablename__ = "domaines"
    __table_args__ = (
        Index("ix_domaines_code_unique", "code", unique=True),
        Index("ix_domaines_admin", "admin_id"),
        Index("ix_domaines_actif", "est_actif"),
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
        comment="Nom du domaine (ex: Domaine Nord)",
    )
    
    code = Column(
        String(20),
        nullable=False,
        unique=True,
        comment="Code unique (ex: DOM-NORD)",
    )
    
    description = Column(
        Text,
        nullable=True,
        comment="Description optionnelle du domaine",
    )
    
    region = Column(
        String(100),
        nullable=True,
        comment="Région géographique",
    )

    # ─── Administration ──────────────────────────────────────────────
    admin_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Admin de Domaine responsable",
    )

    # ─── Statut ──────────────────────────────────────────────────────
    est_actif = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
        comment="Domaine actif ou suspendu",
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
    
    date_suspension = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Date de suspension du domaine",
    )
    
    motif_suspension = Column(
        Text,
        nullable=True,
        comment="Raison de la suspension",
    )

    # ─── Relations ───────────────────────────────────────────────────
    admin = relationship(
        "Utilisateur",
        foreign_keys=[admin_id],
        backref="domaines_administres",
        lazy="selectin",
    )
    
    departements = relationship(
        "Departement",
        backref="domaine",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    
    utilisateurs = relationship(
        "Utilisateur",
        backref="domaine",
        foreign_keys="Utilisateur.domaine_id",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Domaine {self.code}: {self.nom}>"

    @property
    def est_suspendu(self) -> bool:
        """Vérifie si le domaine est suspendu."""
        return not self.est_actif

    def suspendre(self, motif: str) -> None:
        """Suspend le domaine avec un motif."""
        self.est_actif = False
        self.date_suspension = datetime.utcnow()
        self.motif_suspension = motif

    def reactiver(self) -> None:
        """Réactive le domaine."""
        self.est_actif = True
        self.date_suspension = None
        self.motif_suspension = None