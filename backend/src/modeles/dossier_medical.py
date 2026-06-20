# -*- coding: utf-8 -*-
"""
ModÃ¨le Dossier MÃ©dical â€” Consultations, diagnostics, prescriptions.
RÃ©servÃ© aux mÃ©decins.
"""
import uuid
from datetime import date, datetime

from sqlalchemy import Column, String, Text, Date, DateTime, ForeignKey, Enum as SAEnum, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.base_donnees.base import Base


class DossierMedical(Base):
    __tablename__ = "dossiers_medicaux"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    medecin_id = Column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False, index=True)
    patient_nom = Column(String(255), nullable=False)
    patient_prenom = Column(String(255), nullable=True)
    patient_digiid = Column(String(50), nullable=False, index=True)
    patient_date_naissance = Column(Date, nullable=True)
    hopital = Column(String(255), nullable=True)
    motif = Column(String(500), nullable=False)
    diagnostic = Column(Text, nullable=True)
    statut = Column(String(20), default="ouvert")  # ouvert, archive
    date_creation = Column(DateTime, default=datetime.utcnow, nullable=False)
    date_modification = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    medecin = relationship("Utilisateur", backref="dossiers_medicaux")
    consultations = relationship("Consultation", backref="dossier", cascade="all, delete-orphan")
    ordonnances = relationship("Ordonnance", backref="dossier", cascade="all, delete-orphan")


class Consultation(Base):
    __tablename__ = "consultations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dossier_id = Column(UUID(as_uuid=True), ForeignKey("dossiers_medicaux.id"), nullable=False, index=True)
    medecin_id = Column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False)
    hopital = Column(String(255), nullable=True)
    motif = Column(String(500), nullable=False)
    type_consultation = Column(String(50), nullable=True)  # consultation, suivi, urgence, controle
    poids = Column(Integer, nullable=True)  # en kg
    taille = Column(Integer, nullable=True)  # en cm
    temperature = Column(Integer, nullable=True)  # en dixiemes de degre (375 = 37.5°C)
    pression_arterielle = Column(String(20), nullable=True)  # ex: "120/80"
    observations = Column(Text, nullable=True)
    diagnostic = Column(Text, nullable=True)
    conclusion = Column(Text, nullable=True)
    date_consultation = Column(DateTime, default=datetime.utcnow, nullable=False)
    date_controle = Column(Date, nullable=True)  # Date recommandée pour le contrôle de suivi


class Ordonnance(Base):
    __tablename__ = "ordonnances"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dossier_id = Column(UUID(as_uuid=True), ForeignKey("dossiers_medicaux.id"), nullable=False, index=True)
    medecin_id = Column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False)
    numero_ordonnance = Column(String(30), unique=True, nullable=False)
    hopital = Column(String(255), nullable=True)
    medecin_nom = Column(String(255), nullable=True)  # cache pour affichage rapide
    medicaments = Column(Text, nullable=False)
    instructions = Column(Text, nullable=True)
    statut = Column(String(20), default="active")  # active, expiree, annulee
    date_prescription = Column(DateTime, default=datetime.utcnow, nullable=False)
    date_expiration = Column(Date, nullable=True)
