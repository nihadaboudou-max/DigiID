"""ajout de la gare d'affectation aux profils logistiques

ID de révision : 20261027_1603
Révisions précédentes : 340bc538127c
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20261027_1603"
down_revision: Union[str, None] = "340bc538127c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "profils_logistiques",
        sa.Column("gare_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_profils_logistiques_gare_id_gares",
        "profils_logistiques",
        "gares",
        ["gare_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_profils_logistiques_gare_id",
        "profils_logistiques",
        ["gare_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_profils_logistiques_gare_id", table_name="profils_logistiques")
    op.drop_constraint(
        "fk_profils_logistiques_gare_id_gares",
        "profils_logistiques",
        type_="foreignkey",
    )
    op.drop_column("profils_logistiques", "gare_id")
