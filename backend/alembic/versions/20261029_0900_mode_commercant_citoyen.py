"""Ajoute le mode commerçant aux comptes citoyens.

Revision ID: 20261029_0900
Revises: 20261028_1400
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261029_0900"
down_revision: Union[str, None] = "20261028_1400"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "utilisateur",
        sa.Column(
            "mode_commercant_actif",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("utilisateur", "mode_commercant_actif")
