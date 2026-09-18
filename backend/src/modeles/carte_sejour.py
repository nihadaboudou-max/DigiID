# -*- coding: utf-8 -*-
"""Modèle de données pour la Carte / Titre de Séjour.

Table dédiée (aucun JSON fourre-tout). La MRZ (type I< / A<) est conservée
pour l'audit et la vérification de cohérence.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Date, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from src.base_donnees.base import Base


class CarteSejour(Base):
    __tablename__ = "cartes_sejour"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    utilisateur_id = Column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # --- Identification du titre ---
    type_titre = Column(String(30), nullable=True)    # CARTE_SEJOUR / TITRE_SEJOUR / RECEPISSE / CARTE_RESIDENT
    numero_titre = Column(String(50), nullable=False, index=True)
    categorie = Column(String(30), nullable=True)     # SALARIE / ETUDIANT / CONJOINT / VISITEUR / RESIDENT

    # --- Identité du titulaire ---
    nom_famille = Column(String(255), nullable=True)
    prenoms = Column(String(255), nullable=True)
    sexe = Column(String(10), nullable=True)          # M / F
    date_naissance = Column(Date, nullable=True)
    lieu_naissance = Column(String(255), nullable=True)
    nationalite = Column(String(100), nullable=True)

    # --- Adresse & autorité ---
    adresse = Column(String(500), nullable=True)
    autorite_delivrance = Column(String(255), nullable=True)  # préfecture
    pays_emetteur = Column(String(100), nullable=True)

    # --- Dates ---
    date_delivrance = Column(Date, nullable=True)
    date_expiration = Column(Date, nullable=True)

    # --- MRZ (type I< / A< si présente) ---
    mrz_ligne_1 = Column(Text, nullable=True)
    mrz_ligne_2 = Column(Text, nullable=True)
    mrz_ligne_3 = Column(Text, nullable=True)

    # --- Statut & traçabilité ---
    est_valide = Column(Boolean, default=True)
    cree_le = Column(DateTime(timezone=True), default=datetime.utcnow)
    mis_a_jour_le = Column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    def __repr__(self):
        return f"<CarteSejour(numero='{self.numero_titre}', type='{self.type_titre}')>"
