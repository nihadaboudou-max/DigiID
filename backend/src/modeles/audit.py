# -*- coding: utf-8 -*-
"""
Modèle JournalAudit — événements sensibles tracés de façon immuable.

Cette table est en append-only : on n'efface jamais une ligne, on n'en
modifie jamais. Si une fraude est constatée, on peut reconstituer
exactement ce qui s'est passé.

Conformité CDP / APDP / RGPD :
  - Trace toutes les actions sur les données personnelles
  - Conservation 1 an minimum
  - Consultable par les régulateurs sur demande
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, JSON, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base


class JournalAudit(Base):
    """Table d'audit immuable — chaque action sensible y est enregistrée."""

    # On gère manuellement les dates ici — pas de MelangeTracabilite,
    # parce que la date de l'événement est la seule date pertinente.

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # --- Quand ---
    date_evenement: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    # --- Qui ---
    utilisateur_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        doc="Utilisateur concerné — null pour les actions anonymes (tentative de connexion échouée)"
    )
    role_acteur: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # --- Quoi ---
    type_evenement: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
        doc="Type d'événement issu de TypesEvenementAudit"
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)

    # --- Contexte ---
    adresse_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True, index=True)
    agent_utilisateur: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    request_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        nullable=True,
        index=True,
        doc="Identifiant de requête pour corrélation avec les logs applicatifs"
    )

    # --- Détails additionnels (structure libre) ---
    donnees_supplementaires: Mapped[Optional[dict]] = mapped_column(
        JSON,
        nullable=True,
        doc="Détails contextuels en JSON — ex : ancienne valeur / nouvelle valeur"
    )

    # --- Sécurité ---
    score_risque: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        doc="Score de risque associé à cet événement (0-100), si évaluation faite"
    )
    signature_cryptographique: Mapped[Optional[str]] = mapped_column(
        String(128),
        nullable=True,
        doc="HMAC SHA-256 de l'enregistrement, pour détection d'altération"
    )

    # --- Index composites pour requêtes d'audit fréquentes ---
    __table_args__ = (
        Index("ix_audit_utilisateur_date", "utilisateur_id", "date_evenement"),
        Index("ix_audit_type_date", "type_evenement", "date_evenement"),
    )

    def __repr__(self) -> str:
        return f"<JournalAudit {self.type_evenement} @ {self.date_evenement}>"
