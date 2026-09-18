# -*- coding: utf-8 -*-
"""Modèle de données pour la Carte d'Immatriculation Consulaire.

Table dédiée (aucun JSON fourre-tout). Le poste consulaire est stocké dans
sa propre colonne pour éviter toute confusion avec l'adresse du titulaire.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Date, DateTime, ForeignKey, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID
from src.base_donnees.base import Base


class CarteConsulaire(Base):
    __tablename__ = "cartes_consulaires"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    utilisateur_id = Column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # --- Identification ---
    numero_immatriculation_consulaire = Column(String(50), nullable=False, index=True)
    numero_passeport = Column(String(50), nullable=True)

    # --- Identité du titulaire ---
    nom_famille = Column(String(255), nullable=True)
    prenoms = Column(String(255), nullable=True)
    date_naissance = Column(Date, nullable=True)
    lieu_naissance = Column(String(255), nullable=True)
    nationalite = Column(String(100), nullable=True)
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

    # --- Statut & traçabilité ---
    est_valide = Column(Boolean, default=True)
    cree_le = Column(DateTime(timezone=True), default=datetime.utcnow)
    mis_a_jour_le = Column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    def __repr__(self):
        return (
            f"<CarteConsulaire(immat='{self.numero_immatriculation_consulaire}', "
            f"poste='{self.poste_consulaire}')>"
        )
