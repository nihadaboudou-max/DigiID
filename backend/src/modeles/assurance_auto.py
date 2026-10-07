# -*- coding: utf-8 -*-
"""Modèle de données pour l'Assurance Automobile (Carte Verte)."""
from sqlalchemy import Column, String, Date, Boolean
from src.base_donnees.base import Base
from src.modeles.base_document import BaseDocumentInspection


class AssuranceAuto(BaseDocumentInspection, Base):
    __tablename__ = "assurances_auto"

    # Identité de l'assuré (spécifique : dates en type DATE natif)
    date_naissance = Column(Date, nullable=True)
    
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

    def __repr__(self):
        return f"<AssuranceAuto(contrat='{self.numero_contrat}', immat='{self.immatriculation}')>"