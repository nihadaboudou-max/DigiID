"""Ajoute les prévisions de demande et alertes de scans."""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20261120_0900"
down_revision: Union[str, None] = "20261119_0900"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "previsions_demande_ligne_analytique",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("date_prevue", sa.Date(), nullable=False),
        sa.Column("depart", sa.String(length=100), nullable=False),
        sa.Column("arrivee", sa.String(length=100), nullable=False),
        sa.Column("demande_prevue", sa.Float(), nullable=False),
        sa.Column("moyenne_simple", sa.Float(), nullable=False),
        sa.Column("demande_reelle", sa.Integer(), nullable=True),
        sa.Column("erreur_absolue", sa.Float(), nullable=True),
        sa.Column("erreur_moyenne_simple", sa.Float(), nullable=True),
        sa.Column(
            "calcule_le",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "date_prevue",
            "depart",
            "arrivee",
            name="uq_prevision_demande_ligne_date_route",
        ),
    )
    op.create_table(
        "alertes_anomalies_scans_analytiques",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("gare_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("periode_debut", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "type_anomalie",
            sa.String(length=50),
            server_default="volume_scans_atypique",
            nullable=False,
        ),
        sa.Column("nombre_scans", sa.Integer(), nullable=False),
        sa.Column("nombre_colis", sa.Integer(), nullable=False),
        sa.Column("nombre_chauffeurs", sa.Integer(), nullable=False),
        sa.Column("score_anomalie", sa.Float(), nullable=False),
        sa.Column(
            "cree_le",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["gare_id"],
            ["dimension_gare_analytique.gare_id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "gare_id",
            "periode_debut",
            "type_anomalie",
            name="uq_alerte_scan_gare_periode_type",
        ),
    )
    op.create_index(
        "ix_alerte_scan_periode",
        "alertes_anomalies_scans_analytiques",
        ["periode_debut"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_alerte_scan_periode",
        table_name="alertes_anomalies_scans_analytiques",
    )
    op.drop_table("alertes_anomalies_scans_analytiques")
    op.drop_table("previsions_demande_ligne_analytique")
