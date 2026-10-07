# -*- coding: utf-8 -*-
"""Modèle de données pour la Carte Grise (certificat d'immatriculation).

Chaque document conserve SON schéma et SA table (aucun JSON fourre-tout).
Les codes officiels du certificat d'immatriculation sont mappés aux colonnes :
  - D.1 -> marque, D.3 -> modele
  - P.6 -> puissance_fiscale_cv, S.1 -> nombre_places, F.2 -> poids_total_kg
  - B   -> date_premiere_mise_circulation, E -> numero_formule
"""
from sqlalchemy import Column, String, Date, Integer
from src.base_donnees.base import Base
from src.modeles.base_document import BaseDocumentInspection


class CarteGrise(BaseDocumentInspection, Base):
    __tablename__ = "cartes_grises"

    # --- Identification du véhicule ---
    numero_immatriculation = Column(String(50), nullable=False, index=True)
    numero_chassis = Column(String(50), nullable=True, index=True)  # VIN (17 car., sans I/O/Q)
    numero_moteur = Column(String(50), nullable=True)
    marque = Column(String(100), nullable=True)      # case D.1
    modele = Column(String(100), nullable=True)      # case D.3
    genre = Column(String(20), nullable=True)        # VP, CT, CAM, TRR…
    carrosserie = Column(String(20), nullable=True)  # CI, BE…
    energie = Column(String(30), nullable=True)      # ESSENCE, DIESEL, ELECTRIQUE, HYBRIDE, GPL
    puissance_fiscale_cv = Column(Integer, nullable=True)   # case P.6
    nombre_places = Column(Integer, nullable=True)          # case S.1
    poids_total_kg = Column(Integer, nullable=True)         # case F.2 (PTAC)

    # --- Dates & formule ---
    date_premiere_mise_circulation = Column(Date, nullable=True)  # case B
    annee_vehicule = Column(Integer, nullable=True)               # dérivé de la case B
    numero_formule = Column(String(50), nullable=True)            # case E

    # --- Titulaire (case C.1 / C.3) ---
    titulaire_nom = Column(String(255), nullable=True)
    titulaire_prenoms = Column(String(255), nullable=True)
    titulaire_adresse = Column(String(500), nullable=True)

    # --- Document ---
    pays_emetteur = Column(String(100), nullable=True)
    date_delivrance = Column(Date, nullable=True)
    date_expiration = Column(Date, nullable=True)  # souvent absente sur une carte grise

    def __repr__(self):
        return (
            f"<CarteGrise(immat='{self.numero_immatriculation}', "
            f"chassis='{self.numero_chassis}')>"
        )
