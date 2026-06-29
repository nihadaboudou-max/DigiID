# -*- coding: utf-8 -*-
"""Table d'association Équipe ↔ Utilisateur."""
from sqlalchemy import Column, DateTime, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from src.base_donnees.base import metadata

equipe_membres = Table(
    "equipe_membres",
    metadata,
    Column(
        "equipe_id",
        PG_UUID(as_uuid=True),
        ForeignKey("equipes.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "utilisateur_id",
        PG_UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "date_ajout",
        DateTime(timezone=True),
        nullable=False,
        server_default="NOW()",
    ),
)