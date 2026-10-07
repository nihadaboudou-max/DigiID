# -*- coding: utf-8 -*-
"""Modèle de données pour le Passeport.

Table dédiée (aucun JSON fourre-tout). La MRZ (type P<, format TD3) est
conservée pour l'audit et la vérification de cohérence.
"""
from sqlalchemy import Column, Date, String

from src.base_donnees.base import Base
from src.modeles.base_document import BaseDocumentInspection


class Passeport(BaseDocumentInspection, Base):
    __tablename__ = "passeports"

    # --- Identification du titre ---
    numero_passeport = Column(String(50), nullable=False, index=True)
    type_passeport = Column(String(30), nullable=True)  # ORDINAIRE / DIPLOMATIQUE / SERVICE

    # --- Identité du titulaire (spécifique : date en DATE) ---
    date_naissance = Column(Date, nullable=True)

    # --- Émission ---
    pays_emetteur = Column(String(100), nullable=True)

    # --- Dates ---
    date_delivrance = Column(Date, nullable=True)
    date_expiration = Column(Date, nullable=True)

    def __repr__(self):
        return f"<Passeport(numero='{self.numero_passeport}', type='{self.type_passeport}')>"
