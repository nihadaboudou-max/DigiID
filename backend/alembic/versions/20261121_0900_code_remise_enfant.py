"""Ajoute la validation de remise des enfants suivis."""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20261121_0900"
down_revision: Union[str, None] = "c8632ef042fe"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "suivi_familial",
        sa.Column("telephone_recuperation", sa.String(length=30), nullable=True),
    )
    op.add_column(
        "suivi_familial",
        sa.Column("code_remise_hash", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "suivi_familial",
        sa.Column("code_remise_chiffre", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "suivi_familial",
        sa.Column("code_remise_expire_le", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "suivi_familial",
        sa.Column(
            "code_remise_tentatives",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
    )
    op.add_column(
        "suivi_familial",
        sa.Column("code_remise_confirme_le", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("suivi_familial", "code_remise_confirme_le")
    op.drop_column("suivi_familial", "code_remise_tentatives")
    op.drop_column("suivi_familial", "code_remise_expire_le")
    op.drop_column("suivi_familial", "code_remise_chiffre")
    op.drop_column("suivi_familial", "code_remise_hash")
    op.drop_column("suivi_familial", "telephone_recuperation")
