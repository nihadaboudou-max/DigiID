"""Stocke le code de remise chiffré pour révélation explicite au destinataire."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261116_1000"
down_revision: Union[str, None] = "20261115_1455"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "colis",
        sa.Column("code_remise_chiffre", sa.String(length=128), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("colis", "code_remise_chiffre")
