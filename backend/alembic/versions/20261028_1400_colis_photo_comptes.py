"""ajout photo privee et compte destinataire aux colis

Revision ID: 20261028_1400
Revises: 20261027_1603
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20261028_1400"
down_revision: Union[str, None] = "20261027_1603"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "colis",
        sa.Column("destinataire_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_colis_destinataire_id_utilisateur",
        "colis",
        "utilisateur",
        ["destinataire_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_colis_destinataire", "colis", ["destinataire_id"])
    op.add_column(
        "colis",
        sa.Column("photo_chemin", sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("colis", "photo_chemin")
    op.drop_index("ix_colis_destinataire", table_name="colis")
    op.drop_constraint(
        "fk_colis_destinataire_id_utilisateur",
        "colis",
        type_="foreignkey",
    )
    op.drop_column("colis", "destinataire_id")
