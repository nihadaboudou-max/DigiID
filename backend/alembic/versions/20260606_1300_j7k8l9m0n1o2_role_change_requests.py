"""add role_change_request table for RBAC extension

Revision ID: j7k8l9m0n1o2
Revises: e1f2g3h4i5j6
Create Date: 2026-06-06 13:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "j7k8l9m0n1o2"
down_revision: Union[str, None] = "e1f2g3h4i5j6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Crée la table des demandes de changement de rôle."""
    op.create_table(
        "demande_changement_role",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("utilisateur_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("utilisateur.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("role_actuel", sa.String(50), nullable=False),
        sa.Column("role_demande", sa.String(50), nullable=False),
        sa.Column("statut", sa.String(20), nullable=False, default="en_attente",
                  doc="en_attente, approuve, rejete"),
        sa.Column("raison_rejet", sa.Text(), nullable=True),
        sa.Column("traite_par", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("utilisateur.id", ondelete="SET NULL"),
                  nullable=True),
        sa.Column("date_traitement", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cree_le", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("modifie_le", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_demande_role_utilisateur_statut",
                    "demande_changement_role", ["utilisateur_id", "statut"])


def downgrade() -> None:
    """Supprime la table des demandes de changement de rôle."""
    op.drop_index("ix_demande_role_utilisateur_statut",
                  table_name="demande_changement_role")
    op.drop_table("demande_changement_role")
