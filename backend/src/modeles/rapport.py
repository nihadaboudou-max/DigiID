# -*- coding: utf-8 -*-
"""Modèle Rapport pour les rapports d'activité."""
import enum
from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from src.base_donnees.base import Base  # ✅ CORRECTION


class TypeRapport(str, enum.Enum):
    """Types de rapports possibles."""
    ACTIVITE = "activite"
    MISSION = "mission"
    PROGRAMME = "programme"
    HEBDOMADAIRE = "hebdomadaire"
    MENSUEL = "mensuel"
    TRIMESTRIEL = "trimestriel"


class StatutRapport(str, enum.Enum):
    """Statuts possibles d'un rapport."""
    BROUILLON = "brouillon"
    VALIDE = "valide"
    ARCHIVE = "archive"


class Rapport(Base):
    """Table des rapports créés par les chefs."""
    __tablename__ = "rapports"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    titre = Column(String(255), nullable=False)
    type_rapport = Column(SQLEnum(TypeRapport), nullable=False)
    description = Column(Text, nullable=True)
    statut = Column(SQLEnum(StatutRapport), default=StatutRapport.BROUILLON, nullable=False)

    # Relations avec missions et programmes
    mission_id = Column(String(36), ForeignKey("missions_terrain.id", ondelete="SET NULL"), nullable=True)
    programme_id = Column(String(36), ForeignKey("programmes_ong.id", ondelete="SET NULL"), nullable=True)

    # Période (pour rapports temporels : hebdomadaire, mensuel, trimestriel)
    periode_debut = Column(DateTime(timezone=True), nullable=True)
    periode_fin = Column(DateTime(timezone=True), nullable=True)

    # Audit
    cree_par = Column(String(36), ForeignKey("utilisateurs.id", ondelete="CASCADE"), nullable=False)
    date_creation = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    date_modification = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relations ORM
    mission = relationship("MissionTerrain", back_populates="rapports", lazy="select")
    programme = relationship("ProgrammeONG", back_populates="rapports", lazy="select")
    createur = relationship("Utilisateur", foreign_keys=[cree_par], lazy="select")

    def __repr__(self):
        return f"<Rapport(id={self.id}, titre={self.titre}, type={self.type_rapport})>"