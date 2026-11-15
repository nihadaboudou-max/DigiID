"""Stocke les OTP de confirmation sous forme hachée et trace l'IP d'envoi."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261115_1455"
down_revision: Union[str, None] = "20261114_0930"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "code_verification",
        sa.Column("code_hash", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "code_verification",
        sa.Column("adresse_ip", sa.String(length=45), nullable=True),
    )
    # Les anciens codes de confirmation étaient stockés en clair.
    op.execute(
        "DELETE FROM code_verification "
        "WHERE type_verification IN ('inscription', 'connexion')"
    )


def downgrade() -> None:
    op.drop_column("code_verification", "adresse_ip")
    op.drop_column("code_verification", "code_hash")
