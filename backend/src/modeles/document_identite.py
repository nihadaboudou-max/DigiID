# -*- coding: utf-8 -*-
"""
Modèle DocumentIdentité — informations d'identité fournies par l'utilisateur.

PRINCIPE
========
L'utilisateur upload ses documents (CNI, Permis, Assurance). L'OCR extrait
les données automatiquement. L'utilisateur peut corriger chaque champ
si mal extrait. Les corrections sont tracées (modifie_le).

Pour chaque type de document, seuls les champs pertinents sont affichés.
"""
import uuid
from datetime import date
from typing import Optional

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base, MelangeTracabilite


def normaliser_numero_document(valeur: Optional[str]) -> Optional[str]:
    """
    Normalise un numéro de pièce avant écriture (S3).

    ``ab 123-45`` et ``AB12345`` désignent le **même** titre : sans cette
    normalisation, la contrainte d'unicité serait contournable par une simple
    faute de frappe (espaces, tirets, minuscules).
    """
    if valeur is None:
        return None
    nettoye = "".join(
        caractere for caractere in str(valeur).upper()
        if caractere.isalnum()
    )
    return nettoye or None


class DocumentIdentite(Base, MelangeTracabilite):
    """
    Document d'identité — données finales (OCR + corrections utilisateur).

    Un utilisateur peut avoir plusieurs documents (CNI + Permis + Assurance).
    Chaque document a un type et des champs spécifiques.
    """

    __tablename__ = "document_identite"

    # 🔒 CONTRAINTE D'UNICITÉ STRICTE (S3) — un numéro de pièce d'identité
    # (CNI, passeport, permis…) ne peut exister qu'UNE seule fois dans toute la
    # base : impossible d'enregistrer le même titre sur plusieurs comptes.
    # Le numéro est normalisé (majuscules, sans espaces) avant écriture par
    # `normaliser_numero_document()` ; les valeurs vides restent NULL et ne
    # sont pas concernées par la contrainte (Postgres ignore les NULL).
    __table_args__ = (
        UniqueConstraint("numero_document", name="uq_document_numero_document"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    utilisateur_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    type_document: Mapped[str] = mapped_column(
        String(20), nullable=False, index=True,
        doc="cni | permis | assurance"
    )
    est_actif: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False,
    )
    source: Mapped[Optional[str]] = mapped_column(
        String(10), default="manuel", nullable=True,
    )
    a_ete_corrige: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False,
        doc="True si l'utilisateur a modifié au moins un champ extrait"
    )
    verification_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True,
        doc="ID de la VerificationCNI/VerificationPermis d'origine"
    )

    # --- Champs communs ---
    numero_document: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        doc="Numéro de la pièce — STRICTEMENT unique dans toute la base (S3)",
    )
    nom_complet: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    date_naissance: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    lieu_naissance: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    nationalite: Mapped[Optional[str]] = mapped_column(String(100), default=None, nullable=True)
    sexe: Mapped[Optional[str]] = mapped_column(String(1), nullable=True)
    adresse: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    date_delivrance: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    date_expiration: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    pays_emetteur: Mapped[Optional[str]] = mapped_column(String(100), default=None, nullable=True)

    # --- CNI ---
    autorite_delivrance: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    profession: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    taille_cm: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # --- Permis ---
    categories_permis: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    centre_examen: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    numero_permis: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # --- Assurance ---
    compagnie_assurance: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    type_couverture: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    numero_contrat: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    immatriculation_vehicule: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    marque_vehicule: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    modele_vehicule: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    annee_vehicule: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    def __repr__(self) -> str:
        return f"<DocumentIdentite {self.type_document} n°{self.numero_document or '?'}>"
