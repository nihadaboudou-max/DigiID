# -*- coding: utf-8 -*-
"""
Modèle de vérification CNI — enregistrement des résultats d'OCR
et d'authentification de la Carte Nationale d'Identité.

Stocke pour chaque scan :
  - Les données brutes extraites par OCR (tous les champs de la CNI)
  - Les résultats de validation (format, checksum MRZ, cohérence)
  - Les métadonnées du fichier uploadé
  - Le statut de la vérification

Sécurité : seul l'utilisateur propriétaire peut accéder à ses données.
Les données personnelles extraites (nom, prénom, date de naissance, etc.)
sont stockées en clair dans cette table car elles sont nécessaires
à la vérification d'identité. La connexion à la base doit être chiffrée (TLS).
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base, MelangeTracabilite


class VerificationCNI(Base, MelangeTracabilite):
    """
    Résultat d'une analyse OCR de Carte Nationale d'Identité.

    Chaque enregistrement correspond à une face (recto ou verso)
    d'une CNI uploadée et analysée.
    """

    __tablename__ = "verification_cni"

    # --- Identifiants ---
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    utilisateur_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # --- Métadonnées fichier ---
    face: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="recto",
        doc="Face scannée : 'recto' ou 'verso'",
    )
    nom_fichier: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        doc="Nom original du fichier uploadé",
    )
    type_mime: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        doc="Type MIME de l'image",
    )
    taille_octets: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        doc="Taille du fichier en octets",
    )

    # --- Statut ---
    statut: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="en_attente",
        doc="Statut : en_attente, approuve, rejete",
    )

    # =========================================================================
    # Données extraites par OCR
    # =========================================================================

    # --- Identité ---
    nom_famille: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, doc="Nom de famille extrait"
    )
    prenoms: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, doc="Prénom(s) extraits"
    )
    sexe: Mapped[Optional[str]] = mapped_column(
        String(10), nullable=True, doc="Sexe extrait (M/F/non_detecte)"
    )
    date_naissance: Mapped[Optional[str]] = mapped_column(
        String(15), nullable=True, doc="Date de naissance extraite (JJ/MM/AAAA)"
    )
    lieu_naissance: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, doc="Lieu de naissance extrait"
    )

    # --- Carte ---
    numero_cni: Mapped[Optional[str]] = mapped_column(
        String(30), nullable=True, doc="Numéro de la carte extrait"
    )
    date_delivrance: Mapped[Optional[str]] = mapped_column(
        String(15), nullable=True, doc="Date de délivrance extraite (JJ/MM/AAAA)"
    )
    date_expiration: Mapped[Optional[str]] = mapped_column(
        String(15), nullable=True, doc="Date d'expiration extraite (JJ/MM/AAAA)"
    )
    autorite_delivrance: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, doc="Autorité de délivrance extraite"
    )
    taille: Mapped[Optional[str]] = mapped_column(
        String(10), nullable=True, doc="Taille extraite en cm"
    )

    # --- MRZ ---
    mrz_ligne_1: Mapped[Optional[str]] = mapped_column(
        String(30), nullable=True, doc="Ligne 1 de la MRZ (30 car.)"
    )
    mrz_ligne_2: Mapped[Optional[str]] = mapped_column(
        String(30), nullable=True, doc="Ligne 2 de la MRZ (30 car.)"
    )
    mrz_ligne_3: Mapped[Optional[str]] = mapped_column(
        String(30), nullable=True, doc="Ligne 3 de la MRZ (30 car.)"
    )

    # --- Métadonnées OCR ---
    format_carte: Mapped[Optional[str]] = mapped_column(
        String(30), nullable=True,
        doc="Format détecté : nouveau_2021, ancien, non_reconnu",
    )
    texte_brut: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, doc="Texte OCR brut complet (jusqu'à 5000 car.)"
    )
    taux_confiance_ocr: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True, doc="Taux de confiance moyen de l'OCR (0-100)"
    )
    erreurs_ocr: Mapped[Optional[list[str]]] = mapped_column(
        JSON, nullable=True, doc="Liste des erreurs OCR rencontrées"
    )

    # =========================================================================
    # Résultats de validation
    # =========================================================================

    validation_mrz: Mapped[Optional[bool]] = mapped_column(
        Boolean, nullable=True, doc="La MRZ est-elle valide (checksums OK) ?"
    )
    est_valide: Mapped[Optional[bool]] = mapped_column(
        Boolean, nullable=True, doc="La CNI est-elle valide (tous critères) ?"
    )
    scores_validation: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True, doc="Détail des scores de validation par champ"
    )
    date_traitement: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
        doc="Date à laquelle le traitement a été effectué",
    )

    # =========================================================================
    # Gestion de la corbeille (soft-delete)
    # =========================================================================

    est_supprime: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
        doc="Indique si l'enregistrement est dans la corbeille",
    )
    date_suppression: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
        doc="Date de mise à la corbeille",
    )

    # =========================================================================
    # Métadonnées supplémentaires
    # =========================================================================

    notes: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, doc="Notes internes sur la vérification"
    )

    def __repr__(self) -> str:
        return (
            f"<VerificationCNI {self.id} "
            f"face={self.face} "
            f"statut={self.statut} "
            f"numero={self.numero_cni or '?'} "
            f"user={self.utilisateur_id}>"
        )
