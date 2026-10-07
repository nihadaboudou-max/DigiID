# -*- coding: utf-8 -*-
"""
Modèle de vérification CNI — enregistrement des résultats d'OCR
et d'authentification de la Carte Nationale d'Identité.

Stocke pour chaque scan :
  - Les données brutes extraites par OCR (tous les champs de la CNI)
  - Les résultats de validation (format, checksum MRZ, cohérence)
  - Les métadonnées du fichier uploadé
  - Le statut de la vérification
  - ✅ L'embedding facial de la photo extraite (pour comparaison biométrique)

Sécurité : seul l'utilisateur propriétaire peut accéder à ses données.
Les données personnelles extraites (nom, prénom, date de naissance, etc.)
sont stockées en clair dans cette table car elles sont nécessaires
à la vérification d'identité. La connexion à la base doit être chiffrée (TLS).
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from src.base_donnees.base import Base
from src.modeles.base_document import BaseDocumentInspection


class VerificationCNI(BaseDocumentInspection, Base):
    """
    Résultat d'une analyse OCR de Carte Nationale d'Identité.
    Chaque enregistrement correspond à une face (recto ou verso)
    d'une CNI uploadée et analysée.
    """

    __tablename__ = "verification_cni"

    # =========================================================================
    # Données spécifiques à la CNI (le reste est fourni par le mixin commun)
    # =========================================================================

    # --- Carte (dates stockées en texte « JJ/MM/AAAA ») ---
    numero_cni: Mapped[Optional[str]] = mapped_column(
        String(30), nullable=True, doc="Numéro de la carte extrait"
    )
    date_naissance: Mapped[Optional[str]] = mapped_column(
        String(15), nullable=True, doc="Date de naissance extraite (JJ/MM/AAAA)"
    )
    date_delivrance: Mapped[Optional[str]] = mapped_column(
        String(15), nullable=True, doc="Date de délivrance extraite (JJ/MM/AAAA)"
    )
    date_expiration: Mapped[Optional[str]] = mapped_column(
        String(15), nullable=True, doc="Date d'expiration extraite (JJ/MM/AAAA)"
    )
    format_carte: Mapped[Optional[str]] = mapped_column(
        String(30), nullable=True,
        doc="Format détecté : nouveau_2021, ancien, non_reconnu",
    )
    erreurs_ocr: Mapped[Optional[list[str]]] = mapped_column(
        JSON, nullable=True, doc="Liste des erreurs OCR rencontrées"
    )

    # =========================================================================
    # Résultats de validation (spécifiques)
    # =========================================================================

    validation_mrz: Mapped[Optional[bool]] = mapped_column(
        Boolean, nullable=True, doc="La MRZ est-elle valide (checksums OK) ?"
    )
    date_traitement: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
        doc="Date à laquelle le traitement a été effectué",
    )

    # =========================================================================
    # ✅ Biométrie (Embedding facial de la photo CNI)
    # =========================================================================

    embedding_photo_cni: Mapped[Optional[list[float]]] = mapped_column(
        JSON, nullable=True, 
        doc="Embedding facial (512D) extrait de la photo du recto de la CNI"
    )

    # ✅ Photo brute du recto de la CNI (chemin relatif au dossier media) — servie à la police
    photo_chemin: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True,
        doc="Chemin relatif de l'image recto de la CNI stockée sur disque",
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