# -*- coding: utf-8 -*-
"""
Modèle Vérification Police — Tracé des vérifications d'identité.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import relationship
from src.base_donnees.base import Base


class AlertePolice(Base):
    __tablename__ = "alertes_police"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    officier_id = Column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False, index=True)
    type_alerte = Column(String(50), nullable=False)
    titre = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    niveau = Column(String(20), nullable=False, default="info")
    est_lue = Column(Boolean, nullable=False, default=False)
    est_active = Column(Boolean, nullable=False, default=True)
    donnees_liees = Column(JSON, nullable=True)
    date_creation = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    date_lecture = Column(DateTime(timezone=True), nullable=True)
    
    # --- Cloisonnement ---
    domaine_id = Column(
        UUID(as_uuid=True),
        ForeignKey("domaines.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Domaine de rattachement"
    )
    departement_id = Column(
        UUID(as_uuid=True),
        ForeignKey("departements.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Département de rattachement"
    )
    
    officier = relationship("Utilisateur", backref="alertes_police")


class NoteInternePolice(Base):
    __tablename__ = "notes_internes"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    officier_id = Column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False, index=True)
    personne_digiid = Column(String(50), nullable=False, index=True)
    titre = Column(String(200), nullable=False)
    contenu = Column(Text, nullable=True)
    categorie = Column(String(50), nullable=False, default="general")
    est_important = Column(Boolean, nullable=False, default=False)
    est_partagee = Column(Boolean, nullable=False, default=False)
    date_creation = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    date_modification = Column(DateTime(timezone=True), nullable=True)
    
    # --- Cloisonnement ---
    domaine_id = Column(
        UUID(as_uuid=True),
        ForeignKey("domaines.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Domaine de rattachement"
    )
    departement_id = Column(
        UUID(as_uuid=True),
        ForeignKey("departements.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Département de rattachement"
    )
    
    officier = relationship("Utilisateur", backref="notes_internes")


class HistoriqueRecherchePolice(Base):
    __tablename__ = "historique_recherches_police"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    officier_id = Column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False, index=True)
    personne_digiid = Column(String(50), nullable=True, index=True)
    type_recherche = Column(String(50), nullable=False, default="digiid")
    terme_recherche = Column(String(255), nullable=True)
    criteres_recherche = Column(JSON, nullable=True)
    resultats_trouves = Column(Text, nullable=True)
    date_recherche = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    
    # --- Cloisonnement ---
    domaine_id = Column(
        UUID(as_uuid=True),
        ForeignKey("domaines.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Domaine de rattachement"
    )
    departement_id = Column(
        UUID(as_uuid=True),
        ForeignKey("departements.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Département de rattachement"
    )
    
    officier = relationship("Utilisateur", backref="historique_recherches")


class EnrolementPolice(Base):
    __tablename__ = "enrolements_police"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    officier_id = Column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False, index=True)
    personne_digiid = Column(String(50), nullable=True)
    nom_complet = Column(String(255), nullable=True)
    statut = Column(String(30), nullable=False, default="en_attente")
    type_enrolement = Column(String(50), nullable=False)
    donnees_saisies = Column(JSON, nullable=True)
    documents_uploads = Column(JSON, nullable=True)
    notes = Column(Text, nullable=True)
    date_enrolement = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    date_completion = Column(DateTime(timezone=True), nullable=True)
    
    # --- Cloisonnement ---
    domaine_id = Column(
        UUID(as_uuid=True),
        ForeignKey("domaines.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Domaine de rattachement"
    )
    departement_id = Column(
        UUID(as_uuid=True),
        ForeignKey("departements.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Département de rattachement"
    )
    
    officier = relationship("Utilisateur", backref="enrolements_police")


class VerificationPolice(Base):
    __tablename__ = "verifications_police"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    officier_id = Column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False, index=True)
    personne_digiid = Column(String(50), nullable=False, index=True)
    personne_nom = Column(String(255), nullable=True)
    type_verification = Column(String(50), default="identite")
    resultat = Column(String(20), nullable=True)
    notes = Column(Text, nullable=True)
    date_verification = Column(DateTime, default=datetime.utcnow, nullable=False)
    est_signalement_fraude = Column(Boolean, default=False)
    
    # --- Cloisonnement ---
    domaine_id = Column(
        UUID(as_uuid=True),
        ForeignKey("domaines.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Domaine de rattachement"
    )
    departement_id = Column(
        UUID(as_uuid=True),
        ForeignKey("departements.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Département de rattachement"
    )
    
    officier = relationship("Utilisateur", backref="verifications_police")


class SignalementFraude(Base):
    __tablename__ = "signalements_fraude"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    officier_id = Column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False, index=True)
    personne_digiid = Column(String(50), nullable=False, index=True)
    motif = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    statut = Column(String(20), default="en_cours")
    date_signalement = Column(DateTime, default=datetime.utcnow, nullable=False)
    date_traitement = Column(DateTime, nullable=True)
    
    # --- Cloisonnement ---
    domaine_id = Column(
        UUID(as_uuid=True),
        ForeignKey("domaines.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Domaine de rattachement"
    )
    departement_id = Column(
        UUID(as_uuid=True),
        ForeignKey("departements.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Département de rattachement"
    )
    
    officier = relationship("Utilisateur", backref="signalements_fraude")