# -*- coding: utf-8 -*-
"""Modèle de données pour le Permis de Conduire."""
from sqlalchemy import Column, String, Date, JSON
from src.base_donnees.base import Base
from src.modeles.base_document import BaseDocumentInspection


class PermisConduire(BaseDocumentInspection, Base):
    __tablename__ = "permis_conduire"

    # Données du document
    numero_permis = Column(String, unique=True, nullable=False, index=True)
    categories = Column(JSON, default=list)  # Ex: ["A", "B", "C"]

    # Identité du titulaire (spécifique : dates en type DATE natif)
    date_naissance = Column(Date, nullable=True)
    
    # Dates clés
    date_premiere_delivrance = Column(Date, nullable=True)
    date_delivrance = Column(Date, nullable=False)
    date_expiration = Column(Date, nullable=False)
    
    # Lieu de délivrance
    lieu_delivrance = Column(String, nullable=True)

    def __repr__(self):
        return f"<PermisConduire(numero='{self.numero_permis}', user='{self.utilisateur_id}')>"