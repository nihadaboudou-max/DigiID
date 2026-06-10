# -*- coding: utf-8 -*-
"""
Modèle ConfigurationSysteme — feature flags dynamiques stockés en base.

Contrairement aux paramètres de `src/config/parametres.py` qui sont
statiques (lus depuis .env au démarrage), cette table permet de
modifier des flags en ligne sans redémarrage de l'application.

Usage :
  - Lecture : GET /api/v1/super-admin/configuration/feature-flags
  - Écriture : PATCH /api/v1/super-admin/configuration/feature-flags (réservé super admin)

Sécurité :
  - Toute modification est tracée dans le journal d'audit
  - Seul le super administrateur peut modifier ces flags
  - Les flags critiques (2FA, chiffrement) ont un niveau de sensibilité associé
"""
import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, String, Text, JSON, Index, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base, MelangeTracabilite


class ConfigurationSysteme(Base, MelangeTracabilite):
    """
    Feature flags et paramètres modifiables en ligne.

    Chaque ligne = une clé de configuration avec sa valeur JSON,
    sa description et son niveau de sensibilité.
    """

    __tablename__ = "configuration_systeme"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # --- Clé unique (ex : "2fa_obligatoire_admin") ---
    cle: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
        doc="Identifiant unique du flag (snake_case)",
    )

    # --- Valeur stockée en JSON (bool, str, int, float, list, dict) ---
    valeur: Mapped[Any] = mapped_column(
        JSON,
        nullable=False,
        default=False,
        doc="Valeur du flag (booléenne, chaîne, nombre, ou structure JSON)",
    )

    # --- Métadonnées ---
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        doc="Description lisible du flag (affichée dans l'UI)",
    )

    categorie: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        index=True,
        doc="Catégorie d'affichage (ex: securite, metier, chatbot, facial)",
    )

    phase_introduction: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        doc="Phase DigiID où ce flag a été introduit (ex: Phase 2, Phase 3, Phase 4)",
    )

    # --- Sensibilité ---
    niveau_sensibilite: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        doc="0=standard, 1=sensible, 2=critique (audit renforcé pour les modifications)",
    )

    # --- État ---
    est_actif: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        doc="False = flag désactivé/désuet (non affiché dans l'UI)",
    )

    # --- Index composites ---
    __table_args__ = (
        Index("ix_config_categorie_actif", "categorie", "est_actif"),
    )

    def __repr__(self) -> str:
        return f"<ConfigurationSysteme {self.cle}={self.valeur}>"
