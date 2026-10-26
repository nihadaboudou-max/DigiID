# -*- coding: utf-8 -*-
"""Modèle — Certificat d'Identification Personnelle (CIP) du Bénin.

Document papier délivré par l'ANIP. Le numéro de pièce est le **NPI**
(Numéro Personnel d'Identification). La carte porte une photo du titulaire
et un QR code de vérification.
"""
from sqlalchemy import Boolean, Column, Date, String

from src.base_donnees.base import Base
from src.modeles.base_document import BaseDocumentInspection


class CertificatIdentificationPersonnelle(BaseDocumentInspection, Base):
    __tablename__ = "certificats_identification_personnelle"

    # --- Identification (NPI = numéro de pièce) ---
    npi = Column(String(30), nullable=False, index=True)
    numero_serie = Column(String(30), nullable=True)

    # --- Identité ---
    date_naissance = Column(Date, nullable=True)
    telephone = Column(String(30), nullable=True)

    # --- Adresse de résidence ---
    adresse = Column(String(500), nullable=True)
    commune = Column(String(150), nullable=True)
    arrondissement = Column(String(150), nullable=True)
    quartier = Column(String(150), nullable=True)

    # --- Filiation ---
    nom_pere = Column(String(255), nullable=True)
    nom_mere = Column(String(255), nullable=True)

    # --- Émission ---
    pays_emetteur = Column(String(100), nullable=True, default="Bénin")
    date_delivrance = Column(Date, nullable=True)
    date_expiration = Column(Date, nullable=True)

    # --- Contrôles spécifiques CIP ---
    qr_code_detecte = Column(Boolean, nullable=True, default=False)
    qr_code_contenu = Column(String(1000), nullable=True)

    def __repr__(self):
        return f"<CIP(npi='{self.npi}', nom='{self.nom_famille}')>"
