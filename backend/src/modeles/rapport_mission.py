# -*- coding: utf-8 -*-
"""Modèle pour les rapports de mission."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from src.base_donnees.base import Base


class RapportMission(Base):
    __tablename__ = "rapports_mission"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Relations
    mission_id = Column(UUID(as_uuid=True), ForeignKey("missions_terrain.id", ondelete="CASCADE"), nullable=False)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("utilisateur.id", ondelete="CASCADE"), nullable=False)
    
    # Contenu du rapport
    rapport = Column(Text, nullable=True)
    resultats = Column(Text, nullable=True)
    difficultes = Column(Text, nullable=True)
    
    # Date
    date_rapport = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    
    # Relations ORM
    mission = relationship("MissionTerrain", backref="rapports")
    agent = relationship("Utilisateur", foreign_keys=[agent_id], lazy="select")