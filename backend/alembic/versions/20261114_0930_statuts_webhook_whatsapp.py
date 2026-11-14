"""Ajoute les statuts de livraison WhatsApp aux notifications logistiques."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261114_0930"
down_revision: Union[str, None] = "a262fe66f917"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "notifications_logistique",
        sa.Column("whatsapp_message_id", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "notifications_logistique",
        sa.Column("whatsapp_statut", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "notifications_logistique",
        sa.Column("whatsapp_statut_le", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "notifications_logistique",
        sa.Column("whatsapp_erreur_code", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "notifications_logistique",
        sa.Column("whatsapp_erreur_message", sa.Text(), nullable=True),
    )
    op.create_index(
        "uq_notifs_logistique_whatsapp_message_id",
        "notifications_logistique",
        ["whatsapp_message_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        "uq_notifs_logistique_whatsapp_message_id",
        table_name="notifications_logistique",
    )
    op.drop_column("notifications_logistique", "whatsapp_erreur_message")
    op.drop_column("notifications_logistique", "whatsapp_erreur_code")
    op.drop_column("notifications_logistique", "whatsapp_statut_le")
    op.drop_column("notifications_logistique", "whatsapp_statut")
    op.drop_column("notifications_logistique", "whatsapp_message_id")
