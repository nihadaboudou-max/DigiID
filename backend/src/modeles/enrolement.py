# -*- coding: utf-8 -*-
"""
Modèle Enrôlement citoyen — Géré par les agents terrain.
"""
import uuid
from datetime import datetime

from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.base_donnees.base import Base


class Enrolement(Base):
    __tablename__ = "enrolements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("utilisateurs.id"), nullable=False, index=True)
    citoyen_nom = Column(String(255), nullable=False)
    citoyen_prenom = Column(String(255), nullable=False)
    citoyen_digiid = Column(String(50), nullable=True, index=True)
    citoyen_telephone = Column(String(50), nullable=True)
    citoyen_email = Column(String(255), nullable=True)
    statut = Column(String(20), default="en_attente")  # en_attente, valide, rejete
    notes = Column(Text, nullable=True)
    scan_cni = Column(Boolean, default=False)
    capture_biometrique = Column(Boolean, default=False)
    date_enrolement = Column(DateTime, default=datetime.utcnow, nullable=False)
    date_validation = Column(DateTime, nullable=True)

    agent = relationship("Utilisateur", backref="enrolements")
