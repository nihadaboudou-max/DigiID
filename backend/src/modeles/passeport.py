# -*- coding: utf-8 -*-
"""Modèle de données pour le Passeport.

Table dédiée (aucun JSON fourre-tout). La MRZ (type P<, format TD3) est
conservée pour l'audit et la vérification de cohérence.
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from src.base_donnees.base import Base


class Passeport(Base):
    __tablename__ = "passeports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    utilisateur_id = Column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # --- Identification du titre ---
    numero_passeport = Column(String(50), nullable=False, index=True)
    type_passeport = Column(String(30), nullable=True)  # ORDINAIRE / DIPLOMATIQUE / SERVICE

    # --- Identité du titulaire ---
    nom_famille = Column(String(255), nullable=True)
    prenoms = Column(String(255), nullable=True)
    sexe = Column(String(10), nullable=True)  # M / F
    date_naissance = Column(Date, nullable=True)
    lieu_naissance = Column(String(255), nullable=True)
    nationalite = Column(String(100), nullable=True)

    # --- Émission ---
    autorite_delivrance = Column(String(255), nullable=True)
    pays_emetteur = Column(String(100), nullable=True)

    # --- Dates ---
    date_delivrance = Column(Date, nullable=True)
    date_expiration = Column(Date, nullable=True)

    # --- MRZ (format TD3 : 2 lignes de 44 caractères) ---
    mrz_ligne_1 = Column(Text, nullable=True)
    mrz_ligne_2 = Column(Text, nullable=True)
    mrz_valide = Column(Boolean, default=False)

    # --- Statut & traçabilité ---
    est_valide = Column(Boolean, default=True)
    cree_le = Column(DateTime(timezone=True), default=datetime.utcnow)
    mis_a_jour_le = Column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    def __repr__(self):
        return f"<Passeport(numero='{self.numero_passeport}', type='{self.type_passeport}')>"
