"""add verification status columns to utilisateur table

Revision ID: e1f2g3h4i5j6
Revises: c5d6e7f8a9b0
Create Date: 2026-06-06 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "e1f2g3h4i5j6"
down_revision: Union[str, None] = "c5d6e7f8a9b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Ajoute les colonnes de vérification à la table utilisateur."""

    # --- Vérification faciale ---
    op.add_column(
        "utilisateur",
        sa.Column(
            "est_visage_verifie",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="Indique si l'utilisateur a réussi la vérification faciale",
        ),
    )
    op.add_column(
        "utilisateur",
        sa.Column(
            "date_verification_visage",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Date de la dernière vérification faciale réussie",
        ),
    )

    # --- Vérification CNI ---
    op.add_column(
        "utilisateur",
        sa.Column(
            "est_cni_verifiee",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="Indique si l'utilisateur a soumis une CNI valide",
        ),
    )
    op.add_column(
        "utilisateur",
        sa.Column(
            "date_verification_cni",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Date de la dernière vérification CNI réussie",
        ),
    )

    # --- Date globale des vérifications ---
    op.add_column(
        "utilisateur",
        sa.Column(
            "date_derniere_mise_a_jour_verifications",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Date de la dernière mise à jour d'une vérification",
        ),
    )


def downgrade() -> None:
    """Supprime les colonnes ajoutées."""
    op.drop_column("utilisateur", "date_derniere_mise_a_jour_verifications")
    op.drop_column("utilisateur", "date_verification_cni")
    op.drop_column("utilisateur", "est_cni_verifiee")
    op.drop_column("utilisateur", "date_verification_visage")
    op.drop_column("utilisateur", "est_visage_verifie")
