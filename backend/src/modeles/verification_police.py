# -*- coding: utf-8 -*-
"""
Modèle Vérification Police — Tracé des vérifications d'identité.
"""
import uuid
from datetime import datetime

from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.base_donnees.base import Base


class VerificationPolice(Base):
    __tablename__ = "verifications_police"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    officier_id = Column(UUID(as_uuid=True), ForeignKey("utilisateurs.id"), nullable=False, index=True)
    personne_digiid = Column(String(50), nullable=False, index=True)
    personne_nom = Column(String(255), nullable=True)
    type_verification = Column(String(50), default="identite")  # identite, score, fraude
    resultat = Column(String(20), nullable=True)  # confirme, infirme, en_cours
    notes = Column(Text, nullable=True)
    date_verification = Column(DateTime, default=datetime.utcnow, nullable=False)
    est_signalement_fraude = Column(Boolean, default=False)

    officier = relationship("Utilisateur", backref="verifications_police")


class SignalementFraude(Base):
    __tablename__ = "signalements_fraude"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    officier_id = Column(UUID(as_uuid=True), ForeignKey("utilisateurs.id"), nullable=False, index=True)
    personne_digiid = Column(String(50), nullable=False, index=True)
    motif = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    statut = Column(String(20), default="en_cours")  # en_cours, traite, rejete
    date_signalement = Column(DateTime, default=datetime.utcnow, nullable=False)
    date_traitement = Column(DateTime, nullable=True)

    officier = relationship("Utilisateur", backref="signalements_fraude")
