"""Ajoute les scores agrégés quotidiens de confiance chauffeur."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20261118_0900"
down_revision: Union[str, None] = "20261117_0900"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "evenements_analytiques",
        sa.Column("depart_prevu_le", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "scores_confiance_chauffeurs",
        sa.Column(
            "id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False
        ),
        sa.Column("chauffeur_id_anonyme", sa.String(length=64), nullable=False),
        sa.Column("date_calcul", sa.Date(), nullable=False),
        sa.Column("score_total", sa.Integer(), nullable=False),
        sa.Column("niveau", sa.String(length=10), nullable=False),
        sa.Column("score_litiges", sa.Integer(), nullable=False),
        sa.Column("score_regularite", sa.Integer(), nullable=False),
        sa.Column("score_volume", sa.Integer(), nullable=False),
        sa.Column("score_avis", sa.Integer(), nullable=False),
        sa.Column(
            "litiges_mesures",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "regularite_mesuree",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "volume_mesure",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "avis_mesures",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "est_provisoire",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "nombre_depart_analyse",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "nombre_depart_a_lheure",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "nombre_colis_livres",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "calcule_le",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["chauffeur_id_anonyme"],
            ["dimension_chauffeur_analytique.chauffeur_id_anonyme"],
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint(
            "chauffeur_id_anonyme",
            "date_calcul",
            name="uq_score_confiance_chauffeur_date",
        ),
    )
    op.create_index(
        "ix_score_confiance_chauffeur_date",
        "scores_confiance_chauffeurs",
        ["chauffeur_id_anonyme", "date_calcul"],
    )
    op.create_index(
        "ix_score_confiance_date",
        "scores_confiance_chauffeurs",
        ["date_calcul"],
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION interdire_modification_evenements_analytiques()
        RETURNS trigger AS $$
        BEGIN
            IF TG_OP = 'DELETE'
               AND current_setting('digiid.analytics_retention_purge', true) = 'on'
            THEN
                RETURN OLD;
            END IF;
            RAISE EXCEPTION 'Les événements analytiques sont en ajout seul.';
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION interdire_modification_evenements_analytiques()
        RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'Les événements analytiques sont en ajout seul.';
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.drop_index(
        "ix_score_confiance_date",
        table_name="scores_confiance_chauffeurs",
    )
    op.drop_index(
        "ix_score_confiance_chauffeur_date",
        table_name="scores_confiance_chauffeurs",
    )
    op.drop_table("scores_confiance_chauffeurs")
    op.drop_column("evenements_analytiques", "depart_prevu_le")
