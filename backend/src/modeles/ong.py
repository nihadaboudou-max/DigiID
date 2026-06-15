# -*- coding: utf-8 -*-
"""
ModÃ¨les ONG â€” BÃ©nÃ©ficiaires, programmes, missions terrain.
"""
import uuid
from datetime import date, datetime

from sqlalchemy import Column, String, Text, Date, DateTime, ForeignKey, Integer, Float
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
    statut = Column(String(20), default="actif")  # actif, en_attente, inactif
    notes = Column(Text, nullable=True)

    ong = relationship("Utilisateur", backref="beneficiaires_ong")


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

    ong = relationship("Utilisateur", backref="programmes_ong")


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
    statut = Column(String(20), default="planifiee")  # planifiee, en_cours, terminee

    ong = relationship("Utilisateur", backref="missions_terrain")
    programme = relationship("ProgrammeONG", backref="missions")
