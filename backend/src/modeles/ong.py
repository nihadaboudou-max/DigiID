# -*- coding: utf-8 -*-
"""
Modèles ONG — Bénéficiaires, programmes, missions terrain.
Avec cloisonnement par domaine et département.
"""
import uuid
from datetime import date, datetime, timezone
from sqlalchemy import Column, String, Text, Date, DateTime, ForeignKey, Integer, Float, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from src.base_donnees.base import Base


class BeneficiaireONG(Base):
    __tablename__ = "beneficiaires_ong"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ong_id = Column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False, index=True)
    nom = Column(String(255), nullable=False)
    digiid = Column(String(50), nullable=True, index=True)
    programme = Column(String(255), nullable=False)
    zone = Column(String(100), nullable=True)
    date_inscription = Column(DateTime, default=datetime.utcnow, nullable=False)
    statut = Column(String(20), default="actif")
    notes = Column(Text, nullable=True)

    # ✅ AJOUT : Lien vers une mission (optionnel)
    mission_id = Column(
        UUID(as_uuid=True),
        ForeignKey("missions_terrain.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Mission associée (optionnel)"
    )

    # --- Cloisonnement ---
    domaine_id = Column(
        UUID(as_uuid=True),
        ForeignKey("domaines.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Domaine de rattachement"
    )
    departement_id = Column(
        UUID(as_uuid=True),
        ForeignKey("departements.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Département de rattachement"
    )

    ong = relationship("Utilisateur", backref="beneficiaires_ong")
    # ✅ AJOUT : Relation avec MissionTerrain
    mission = relationship("MissionTerrain", backref="beneficiaires", lazy="select")


class ProgrammeONG(Base):
    __tablename__ = "programmes_ong"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ong_id = Column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False, index=True)
    nom = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    zone = Column(String(100), nullable=True)
    budget = Column(Float, nullable=True)
    date_debut = Column(Date, nullable=False)
    date_fin = Column(Date, nullable=True)
    statut = Column(String(20), default="actif")

    # --- Cloisonnement ---
    domaine_id = Column(
        UUID(as_uuid=True),
        ForeignKey("domaines.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Domaine de rattachement"
    )
    departement_id = Column(
        UUID(as_uuid=True),
        ForeignKey("departements.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Département de rattachement"
    )

    ong = relationship("Utilisateur", backref="programmes_ong")
    # ✅ Relation avec les rapports
    rapports = relationship("Rapport", back_populates="programme", lazy="select")


class MissionTerrain(Base):
    __tablename__ = "missions_terrain"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ong_id = Column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False, index=True)
    programme_id = Column(UUID(as_uuid=True), ForeignKey("programmes_ong.id"), nullable=True)
    titre = Column(String(255), nullable=False)
    zone = Column(String(100), nullable=True)
    date_depart = Column(Date, nullable=False)
    date_retour = Column(Date, nullable=True)
    objectifs = Column(Text, nullable=True)
    statut = Column(String(20), default="planifiee")

    # --- Cloisonnement ---
    domaine_id = Column(
        UUID(as_uuid=True),
        ForeignKey("domaines.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Domaine de rattachement"
    )
    departement_id = Column(
        UUID(as_uuid=True),
        ForeignKey("departements.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Département de rattachement"
    )

    ong = relationship("Utilisateur", backref="missions_terrain")
    programme = relationship("ProgrammeONG", backref="missions")
    # ✅ Relation avec les rapports
    rapports = relationship("Rapport", back_populates="mission", lazy="select")


class MissionAgent(Base):
    """Table de liaison entre missions et agents."""
    __tablename__ = "mission_agent"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # ✅ CORRECTION : "missions_terrain.id" au lieu de "mission_terrain.id"
    mission_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("missions_terrain.id", ondelete="CASCADE"), 
        nullable=False
    )
    agent_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("utilisateur.id", ondelete="CASCADE"), 
        nullable=False
    )
    
    instructions = Column(Text, nullable=True)
    date_limite = Column(Date, nullable=True)
    statut = Column(String(50), default="assignee")  # assignee, en_cours, terminee, annulee
    date_assignation = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    date_debut = Column(DateTime(timezone=True), nullable=True)
    date_completion = Column(DateTime(timezone=True), nullable=True)
    
    # ✅ Relations explicites
    mission = relationship(
        "MissionTerrain",
        foreign_keys=[mission_id],
        primaryjoin="MissionAgent.mission_id == MissionTerrain.id",
        backref="agents_assignes",
        lazy="selectin",
    )
    agent = relationship(
        "Utilisateur",
        foreign_keys=[agent_id],
        primaryjoin="MissionAgent.agent_id == Utilisateur.id",
        backref="missions_assignees",
        lazy="selectin",
    )