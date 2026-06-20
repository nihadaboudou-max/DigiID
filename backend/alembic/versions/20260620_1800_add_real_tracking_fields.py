"""Ajoute les champs de tracking en temps réel pour le scoring

Changements :
  - operateur_telephone : opérateur mobile déclaré (Orange, Wave, Free, etc.)
  - date_derniere_modification_telephone : date du dernier changement de téléphone
  - quartier : quartier de résidence déclaré
  - date_dernier_changement_ville : date du dernier changement de ville

Ces champs permettent au scoring d'utiliser des données 100% RÉELLES :
  - Ancienneté du compte (cree_le existant)
  - Stabilité téléphone (date_derniere_modification_telephone)
  - Stabilité géographique (date_dernier_changement_ville)
  - Opérateur déclaré (operateur_telephone)

Revision ID: add_real_tracking_fields
Revises: 20260620_1200_enrichissement_medical
Create Date: 2026-06-20 18:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260620_1800_add_real_tracking_fields"
down_revision: Union[str, None] = "20260620_1200_enrichissement_medical"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "utilisateur",
        sa.Column(
            "operateur_telephone",
            sa.String(50),
            nullable=True,
            comment="Opérateur mobile déclaré (Orange, Wave, Free, etc.)",
        ),
    )
    op.add_column(
        "utilisateur",
        sa.Column(
            "date_derniere_modification_telephone",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Date du dernier changement de numéro de téléphone",
        ),
    )
    op.add_column(
        "utilisateur",
        sa.Column(
            "quartier",
            sa.String(100),
            nullable=True,
            comment="Quartier de résidence déclaré",
        ),
    )
    op.add_column(
        "utilisateur",
        sa.Column(
            "date_dernier_changement_ville",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Date du dernier changement de ville déclaré",
        ),
    )


def downgrade() -> None:
    op.drop_column("utilisateur", "date_dernier_changement_ville")
    op.drop_column("utilisateur", "quartier")
    op.drop_column("utilisateur", "date_derniere_modification_telephone")
    op.drop_column("utilisateur", "operateur_telephone")
