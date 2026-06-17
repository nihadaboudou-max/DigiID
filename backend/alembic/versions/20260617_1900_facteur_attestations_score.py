"""Migration: ajout colonne facteur_attestations dans score_historique.

Ajoute la colonne pour le 5e facteur (Attestations communautaires, max 15 pts).
La colonne accepte NULL temporairement pour compatibilite avec les lignes existantes,
puis est forcee a NOT NULL via la valeur par defaut 0.0.

Revision ID: 20260617_1900_facteur_attestations_score
Revises: 20260612_1000_professionnels_services
Create Date: 2026-06-17 19:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260617_1900_facteur_attestations_score"
down_revision: Union[str, None] = "20260612_1000_professionnels_services"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ajout de la colonne facteur_attestations (nullable temporairement)
    op.add_column(
        "score_historique",
        sa.Column(
            "facteur_attestations",
            sa.Float(),
            nullable=True,
            server_default=sa.text("0.0"),
            comment="Sous-score attestations communautaires (correcteur d'exclusion, max 15)",
        ),
    )
    # Mettre a jour les lignes existantes avec la valeur par defaut
    op.execute("UPDATE score_historique SET facteur_attestations = 0.0 WHERE facteur_attestations IS NULL")
    # Forcer NOT NULL apres mise a jour
    op.alter_column("score_historique", "facteur_attestations", nullable=False, server_default=sa.text("0.0"))


def downgrade() -> None:
    op.drop_column("score_historique", "facteur_attestations")
