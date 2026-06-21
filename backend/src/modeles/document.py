# -*- coding: utf-8 -*-
"""
Modèle Document — fichiers uploadés par l'utilisateur pour le chatbot RAG.

Chaque utilisateur peut uploader des documents (PDF, TXT, DOCX).
Le contenu textuel est extrait et stocké en base. Le chatbot
peut alors les utiliser pour répondre aux questions de l'utilisateur.

Sécurité : seul l'utilisateur propriétaire peut accéder à ses documents.
"""
import uuid
from typing import Optional

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base, MelangeTracabilite


class Document(Base, MelangeTracabilite):
    """Document uploadé par un utilisateur pour enrichir son chatbot."""

    # Identifiant unique du document
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    # Propriétaire — le document n'est visible que par lui
    utilisateur_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # --- Métadonnées du fichier ---
    nom_fichier: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        doc="Nom original du fichier tel que l'utilisateur l'a uploadé"
    )
    type_mime: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        doc="Type MIME (ex : application/pdf, text/plain, application/msword)"
    )
    taille_octets: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        doc="Taille du fichier en octets"
    )

    # --- Contenu extrait ---
    contenu_texte: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="Texte extrait du document — utilisé par le chatbot pour répondre"
    )
    # Petit résumé pour l'affichage frontend
    resume: Mapped[Optional[str]] = mapped_column(
        String(2000),
        nullable=True,
        doc="Premiers 2000 caractères pour aperçu rapide"
    )

    def __repr__(self) -> str:
        return f"<Document {self.nom_fichier} ({self.taille_octets} octets) pour {self.utilisateur_id}>"
