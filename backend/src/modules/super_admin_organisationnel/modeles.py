# -*- coding: utf-8 -*-
"""Modèles SQLAlchemy pour la gestion organisationnelle Super Admin."""
import uuid
from datetime import datetime, timedelta
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from src.base_donnees.base import Base


class Domaine(Base):
    """Domaine organisationnel (ex: Ministère, ONG, Entreprise)."""
    __tablename__ = "domaines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom = Column(String(255), nullable=False, unique=True, index=True)
    code = Column(String(50), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    region = Column(String(100), nullable=True)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=True)
    est_actif = Column(Boolean, default=True, nullable=False)
    date_creation = Column(DateTime, default=datetime.utcnow, nullable=False)
    date_modification = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    date_suspension = Column(DateTime, nullable=True)
    motif_suspension = Column(Text, nullable=True)

    # Relations
    admin = relationship("Utilisateur", foreign_keys=[admin_id])
    departements = relationship("Departement", back_populates="domaine", cascade="all, delete-orphan")


class Departement(Base):
    """Département au sein d'un domaine (ex: Police Dakar, Hôpital Principal)."""
    __tablename__ = "departements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom = Column(String(255), nullable=False, index=True)
    type_departement = Column(String(50), nullable=False)  # police, medical, ong, agent
    description = Column(Text, nullable=True)
    capacite_max = Column(Integer, default=50)
    domaine_id = Column(UUID(as_uuid=True), ForeignKey("domaines.id", ondelete="CASCADE"), nullable=False, index=True)
    chef_id = Column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=True)
    est_actif = Column(Boolean, default=True, nullable=False)
    date_creation = Column(DateTime, default=datetime.utcnow, nullable=False)
    date_modification = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    domaine = relationship("Domaine", back_populates="departements")
    chef = relationship("Utilisateur", foreign_keys=[chef_id])
    equipes = relationship("Equipe", back_populates="departement", cascade="all, delete-orphan")


class Invitation(Base):
    """Invitation à rejoindre la plateforme."""
    __tablename__ = "invitations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), nullable=False, index=True)
    role = Column(String(50), nullable=False)
    domaine_id = Column(UUID(as_uuid=True), ForeignKey("domaines.id", ondelete="SET NULL"), nullable=True)
    departement_id = Column(UUID(as_uuid=True), ForeignKey("departements.id", ondelete="SET NULL"), nullable=True)
    statut = Column(String(20), default="en_attente", nullable=False)  # en_attente, acceptee, expiree, annulee
    message = Column(Text, nullable=True)
    token = Column(String(255), unique=True, index=True)
    cree_par = Column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False)
    date_creation = Column(DateTime, default=datetime.utcnow, nullable=False)
    date_expiration = Column(DateTime, nullable=False)
    date_acceptation = Column(DateTime, nullable=True)

    # Relations
    domaine = relationship("Domaine")
    departement = relationship("Departement")
    createur = relationship("Utilisateur", foreign_keys=[cree_par])


class Equipe(Base):
    """Équipe au sein d'un département."""
    __tablename__ = "equipes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    departement_id = Column(UUID(as_uuid=True), ForeignKey("departements.id", ondelete="CASCADE"), nullable=False, index=True)
    chef_id = Column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=True)
    est_actif = Column(Boolean, default=True, nullable=False)
    date_creation = Column(DateTime, default=datetime.utcnow, nullable=False)
    date_modification = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    departement = relationship("Departement", back_populates="equipes")
    chef = relationship("Utilisateur", foreign_keys=[chef_id])