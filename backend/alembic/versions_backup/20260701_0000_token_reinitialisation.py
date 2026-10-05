"""Migration: table token_reinitialisation pour mot de passe oublié.

Ajoute la table de stockage des tokens de réinitialisation de mot de passe.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260701_0000_token_reinitialisation"
down_revision: Union[str, None] = "20260620_2100_document_identite"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "token_reinitialisation",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("utilisateur_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("utilisateur.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("est_utilise", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("date_expiration", sa.DateTime(timezone=True), nullable=False),
        sa.Column("date_utilisation", sa.DateTime(timezone=True), nullable=True),
        sa.Column("adresse_ip_demande", sa.String(45), nullable=True),
        sa.Column("tentative", sa.Integer(), nullable=False, server_default=sa.text("0")),
        # Champs de traçabilité (MelangeTracabilite)
        sa.Column("cree_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("modifie_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("token_reinitialisation")
