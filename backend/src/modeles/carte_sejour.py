# -*- coding: utf-8 -*-
"""Modèle de données pour la Carte / Titre de Séjour.

Table dédiée (aucun JSON fourre-tout). La MRZ (type I< / A<) est conservée
pour l'audit et la vérification de cohérence.
"""
from sqlalchemy import Column, String, Date
from src.base_donnees.base import Base
from src.modeles.base_document import BaseDocumentInspection


class CarteSejour(BaseDocumentInspection, Base):
    __tablename__ = "cartes_sejour"

    # --- Identification du titre ---
    type_titre = Column(String(30), nullable=True)    # CARTE_SEJOUR / TITRE_SEJOUR / RECEPISSE / CARTE_RESIDENT
    numero_titre = Column(String(50), nullable=False, index=True)
    categorie = Column(String(30), nullable=True)     # SALARIE / ETUDIANT / CONJOINT / VISITEUR / RESIDENT

    # --- Identité du titulaire (spécifique : dates en DATE) ---
    date_naissance = Column(Date, nullable=True)

    # --- Adresse & autorité ---
    adresse = Column(String(500), nullable=True)
    pays_emetteur = Column(String(100), nullable=True)

    # --- Dates ---
    date_delivrance = Column(Date, nullable=True)
    date_expiration = Column(Date, nullable=True)

    def __repr__(self):
        return f"<CarteSejour(numero='{self.numero_titre}', type='{self.type_titre}')>"
