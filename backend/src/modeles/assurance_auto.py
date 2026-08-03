# -*- coding: utf-8 -*-
"""Modèle de données pour l'Assurance Automobile (Carte Verte)."""
import uuid
from datetime import date, datetime
from sqlalchemy import Column, String, Date, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from src.base_donnees.base import Base

class AssuranceAuto(Base):
    __tablename__ = "assurances_auto"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    utilisateur_id = Column(UUID(as_uuid=True), ForeignKey("utilisateur.id", ondelete="CASCADE"), nullable=False, index=True)

    # Identité de l'assuré (extrait par OCR)
    nom_famille = Column(String(255), nullable=True)
    prenoms = Column(String(255), nullable=True)
    
    # Assureur
    compagnie_assurance = Column(String, nullable=False)
    numero_contrat = Column(String, nullable=False, index=True)
    
    # Véhicule
    immatriculation = Column(String, nullable=False, index=True)
    marque_vehicule = Column(String, nullable=True)
    modele_vehicule = Column(String, nullable=True)
    
    # Couverture
    date_effet = Column(Date, nullable=False)
    date_expiration = Column(Date, nullable=False)
    
    # Statut
    est_active = Column(Boolean, default=True)
    cree_le = Column(DateTime(timezone=True), default=datetime.utcnow)
    mis_a_jour_le = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<AssuranceAuto(contrat='{self.numero_contrat}', immat='{self.immatriculation}')>"