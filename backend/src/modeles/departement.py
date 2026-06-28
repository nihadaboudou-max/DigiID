# -*- coding: utf-8 -*-
"""
Modèle Departement — Division fonctionnelle au sein d'un domaine.

Un département représente une unité fonctionnelle (Police, Médecins, ONG, Agents).
Chaque département est dirigé par un Chef de Département qui gère son équipe.

Le cloisonnement est strict : un département ne peut voir/accéder qu'à ses propres
données et celles de ses agents.
"""
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, String, Text, Index, 
    UniqueConstraint, func
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import relationship

from src.base_donnees.base import Base


class Departement(Base):
    """
    Département fonctionnel au sein d'un domaine.
    
    Attributs:
        id: Identifiant unique UUID
        nom: Nom du département (ex: "Police Municipale")
        type_departement: Type fonctionnel (police, medical, ong, agent)
        domaine_id: UUID du domaine parent
        chef_id: UUID du Chef de Département
        description: Description optionnelle
        permissions_personnalisees: JSON des permissions spécifiques
        est_actif: Département actif ou désactivé
        capacite_max: Nombre max d'agents autorisés (0 = illimité)
        
    Relations:
        domaine: Le domaine parent
        chef: Le Chef de Département
        utilisateurs: Liste des agents du département
    """
    __tablename__ = "departements"
    __table_args__ = (
        UniqueConstraint("domaine_id", "type_departement", 
                        name="uq_departement_domaine_type"),
        Index("ix_departements_domaine", "domaine_id"),
        Index("ix_departements_chef", "chef_id"),
        Index("ix_departements_type", "type_departement"),
        Index("ix_departements_actif", "est_actif"),
    )

    # ─── Types de départements autorisés ────────────────────────────
    TYPES_VALIDES = ("police", "medical", "ong", "agent", "admin")

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
        comment="Nom du département",
    )
    
    type_departement = Column(
        String(30),
        nullable=False,
        comment="Type: police, medical, ong, agent, admin",
    )
    
    description = Column(
        Text,
        nullable=True,
        comment="Description du département",
    )

    # ─── Hiérarchie ──────────────────────────────────────────────────
    domaine_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("domaines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Domaine parent",
    )
    
    chef_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Chef de Département responsable",
    )

    # ─── Configuration ───────────────────────────────────────────────
    permissions_personnalisees = Column(
        JSONB,
        nullable=True,
        default=dict,
        comment="Permissions spécifiques au département",
    )
    
    capacite_max = Column(
        nullable=False,
        default=0,
        server_default="0",
        comment="Nombre max d'agents (0 = illimité)",
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
    
    date_desactivation = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    # ─── Relations ───────────────────────────────────────────────────
    chef = relationship(
        "Utilisateur",
        foreign_keys=[chef_id],
        backref="departements_diriges",
        lazy="selectin",
    )
    
    utilisateurs = relationship(
        "Utilisateur",
        back_populates="departement",
        foreign_keys="Utilisateur.departement_id",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Departement {self.type_departement}: {self.nom}>"

    @property
    def est_complet(self) -> bool:
        """Vérifie si le département a atteint sa capacité max."""
        if self.capacite_max == 0:
            return False  # 0 = illimité
        return len(self.utilisateurs) >= self.capacite_max

    @property
    def nombre_agents(self) -> int:
        """Retourne le nombre d'agents dans le département."""
        return len(self.utilisateurs)

    def desactiver(self) -> None:
        """Désactive le département."""
        self.est_actif = False
        self.date_desactivation = datetime.utcnow()

    def reactiver(self) -> None:
        """Réactive le département."""
        self.est_actif = True
        self.date_desactivation = None