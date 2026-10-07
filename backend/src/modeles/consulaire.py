# -*- coding: utf-8 -*-
"""Modèle de données pour la Carte d'Immatriculation Consulaire.

Table dédiée (aucun JSON fourre-tout). Le poste consulaire est stocké dans
sa propre colonne pour éviter toute confusion avec l'adresse du titulaire.
"""
from sqlalchemy import Column, String, Date, Integer
from src.base_donnees.base import Base
from src.modeles.base_document import BaseDocumentInspection


class CarteConsulaire(BaseDocumentInspection, Base):
    __tablename__ = "cartes_consulaires"

    # --- Identification ---
    numero_immatriculation_consulaire = Column(String(50), nullable=False, index=True)
    numero_passeport = Column(String(50), nullable=True)

    # --- Identité du titulaire (spécifique : date en DATE) ---
    date_naissance = Column(Date, nullable=True)
    profession = Column(String(150), nullable=True)
    situation_matrimoniale = Column(String(30), nullable=True)  # CELIBATAIRE / MARIE / DIVORCE / VEUF

    # --- Adresse & poste ---
    adresse = Column(String(500), nullable=True)
    poste_consulaire = Column(String(255), nullable=True)  # consulat / ambassade (attention : ≠ adresse)
    pays_emetteur = Column(String(100), nullable=True)

    # --- Charges & dates ---
    personnes_a_charge = Column(Integer, nullable=True)
    date_delivrance = Column(Date, nullable=True)
    date_expiration = Column(Date, nullable=True)

    def __repr__(self):
        return (
            f"<CarteConsulaire(immat='{self.numero_immatriculation_consulaire}', "
            f"poste='{self.poste_consulaire}')>"
        )
