# -*- coding: utf-8 -*-
"""Modèle de données pour le Permis de Conduire."""
import uuid
from datetime import date, datetime
from sqlalchemy import Column, String, Date, JSON, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from src.base_donnees.base import Base # Assurez-vous que Base est importé correctement

class PermisConduire(Base):
    __tablename__ = "permis_conduire"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    utilisateur_id = Column(UUID(as_uuid=True), ForeignKey("utilisateur.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Données du document
    numero_permis = Column(String, unique=True, nullable=False, index=True)
    categories = Column(JSON, default=list)  # Ex: ["A", "B", "C"]
    
    # Dates clés
    date_premiere_delivrance = Column(Date, nullable=True)
    date_delivrance = Column(Date, nullable=False)
    date_expiration = Column(Date, nullable=False)
    
    # Lieu et Autorité
    lieu_delivrance = Column(String, nullable=True)
    autorite_delivrance = Column(String, nullable=True)
    
    # Statut et Métadonnées
    est_valide = Column(Boolean, default=True)
    cree_le = Column(DateTime(timezone=True), default=datetime.utcnow)
    mis_a_jour_le = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<PermisConduire(numero='{self.numero_permis}', user='{self.utilisateur_id}')>"