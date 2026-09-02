# -*- coding: utf-8 -*-
"""
Modèle de base de données pour l'inspection universelle de documents.
Remplace avantageusement l'ancien modèle VerificationCNI en supportant
tous les types de documents (CNI, Passeport, Permis, Assurance, etc.).
"""
from datetime import datetime, timezone
from uuid import UUID, uuid4
from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

# Assurez-vous d'importer la Base de votre projet (ajustez le chemin selon votre structure)
from src.base_donnees.base import Base 

class InspectionDocument(Base):
    """Représente une vérification de document d'identité scanné."""
    __tablename__ = "inspection_documents"

    # --- Clé primaire et relations ---
    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4, index=True)
    utilisateur_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("utilisateurs.id", ondelete="CASCADE"), index=True, nullable=False)
    
    # --- Métadonnées du fichier ---
    type_document: Mapped[str] = mapped_column(String(50), nullable=False, default="inconnu", index=True)
    face: Mapped[str] = mapped_column(String(20), nullable=False, default="unique") # recto, verso, unique
    nom_fichier: Mapped[str] = mapped_column(String(255), nullable=False)
    type_mime: Mapped[str] = mapped_column(String(50), nullable=False, default="image/jpeg")
    taille_octets: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    document_chemin: Mapped[str] = mapped_column(String(500), nullable=True) # Chemin de l'image stockée

    # --- Données d'identité extraites (Champs communs) ---
    nom_famille: Mapped[str] = mapped_column(String(255), nullable=True, index=True)
    prenoms: Mapped[str] = mapped_column(String(255), nullable=True)
    date_naissance: Mapped[str] = mapped_column(String(50), nullable=True)
    sexe: Mapped[str] = mapped_column(String(10), nullable=True, default="non_detecte")
    numero_document: Mapped[str] = mapped_column(String(100), nullable=True, index=True)
    date_expiration: Mapped[str] = mapped_column(String(50), nullable=True)
    lieu_naissance: Mapped[str] = mapped_column(String(255), nullable=True)
    date_delivrance: Mapped[str] = mapped_column(String(50), nullable=True)
    autorite_delivrance: Mapped[str] = mapped_column(String(255), nullable=True)
    nationalite: Mapped[str] = mapped_column(String(100), nullable=True)
    taille: Mapped[str] = mapped_column(String(50), nullable=True)

    # --- Données MRZ ---
    mrz_ligne_1: Mapped[str] = mapped_column(Text, nullable=True)
    mrz_ligne_2: Mapped[str] = mapped_column(Text, nullable=True)
    mrz_ligne_3: Mapped[str] = mapped_column(Text, nullable=True)
    mrz_valide: Mapped[bool] = mapped_column(Boolean, default=False)

    # --- Données flexibles (JSON) ---
    # Stocke les données spécifiques (ex: catégories de permis, n° police assurance)
    donnees_specifiques: Mapped[dict] = mapped_column(JSON, nullable=True, default=dict) 
    texte_brut: Mapped[str] = mapped_column(Text, nullable=True) # Texte OCR brut (pour debug/audit)

    # --- Validation et Statut ---
    statut: Mapped[str] = mapped_column(String(20), nullable=False, default="en_attente", index=True) # en_attente, approuve, rejete
    est_valide: Mapped[bool] = mapped_column(Boolean, default=False)
    scores_validation: Mapped[dict] = mapped_column(JSON, nullable=True, default=dict) # Détails des scores
    taux_confiance_ocr: Mapped[float] = mapped_column(Float, default=0.0)

    # --- Audit et Soft-Delete ---
    cree_le: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    modifie_le: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    est_supprime: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    date_suppression: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self):
        return f"<InspectionDocument(id={self.id}, type={self.type_document}, user={self.utilisateur_id})>"