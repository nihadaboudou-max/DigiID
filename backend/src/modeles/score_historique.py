# -*- coding: utf-8 -*-
"""
Modèle ScoreHistorique — historique des calculs de score DigiID.

Chaque calcul de score génère un enregistrement immuable :
  - Le score final
  - Les valeurs individuelles des 4 facteurs (transparence)
  - La méthode utilisée
  - La date

Permet :
  - Affichage d'un graphique d'évolution
  - Audit d'un score contesté
  - Re-calcul a posteriori si l'algorithme change (on garde l'ancien)
"""
import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base

if TYPE_CHECKING:
    from src.modeles.utilisateur import Utilisateur


class ScoreHistorique(Base):
    """Table append-only des calculs de score successifs."""

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

    # --- Score et composantes ---
    score_total: Mapped[int] = mapped_column(Integer, nullable=False)

    facteur_anciennete_sim: Mapped[float] = mapped_column(Float, nullable=False)
    facteur_mobile_money: Mapped[float] = mapped_column(Float, nullable=False)
    facteur_geographie: Mapped[float] = mapped_column(Float, nullable=False)
    facteur_reseau_contacts: Mapped[float] = mapped_column(Float, nullable=False)

    # --- Métadonnées ---
    date_calcul: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    methode: Mapped[str] = mapped_column(
        String(50),
        default="ponderee_v1",
        nullable=False,
        doc="Identifiant de la méthode/version utilisée pour ce calcul"
    )

    # --- Détails additionnels (JSON libre) ---
    donnees_brutes: Mapped[Optional[dict]] = mapped_column(
        JSON(),
        nullable=True,
        doc="Valeurs brutes des features avant pondération (pour audit)"
    )

    def __repr__(self) -> str:
        return f"<ScoreHistorique {self.score_total}/100 @ {self.date_calcul} pour {self.utilisateur_id}>"
