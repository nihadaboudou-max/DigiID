"""Ajoute la confirmation de remise par code a quatre chiffres."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261031_0100"
down_revision: Union[str, None] = "20261029_0900"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("colis", sa.Column("code_remise_hash", sa.String(length=128), nullable=True))
    op.add_column("colis", sa.Column("code_remise_expire_le", sa.DateTime(timezone=True), nullable=True))
    op.add_column("colis", sa.Column("code_remise_tentatives", sa.Integer(), server_default="0", nullable=False))
    op.add_column("colis", sa.Column("code_remise_confirme_le", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("colis", "code_remise_confirme_le")
    op.drop_column("colis", "code_remise_tentatives")
    op.drop_column("colis", "code_remise_expire_le")
    op.drop_column("colis", "code_remise_hash")
