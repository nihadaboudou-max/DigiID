"""Ajoute les événements logistiques analytiques pseudonymisés."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20261117_0900"
down_revision: Union[str, None] = "20261116_1000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "dimension_gare_analytique",
        sa.Column("gare_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(length=20), nullable=False),
        sa.Column("nom", sa.String(length=150), nullable=False),
        sa.Column("ville", sa.String(length=100), nullable=False),
        sa.Column(
            "actif", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
    )
    op.create_table(
        "dimension_ligne_analytique",
        sa.Column("ligne_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("gare_depart_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("gare_arrivee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("distance_km", sa.Float(), nullable=True),
        sa.Column("duree_min", sa.Integer(), nullable=True),
        sa.Column(
            "actif", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
    )
    op.create_table(
        "dimension_chauffeur_analytique",
        sa.Column("chauffeur_id_anonyme", sa.String(length=64), primary_key=True),
    )
    op.create_table(
        "dimension_date_analytique",
        sa.Column("date_id", sa.Date(), primary_key=True),
        sa.Column("annee", sa.Integer(), nullable=False),
        sa.Column("mois", sa.Integer(), nullable=False),
        sa.Column("jour", sa.Integer(), nullable=False),
        sa.Column("jour_semaine", sa.Integer(), nullable=False),
        sa.Column("semaine_iso", sa.Integer(), nullable=False),
        sa.Column("trimestre", sa.Integer(), nullable=False),
    )
    op.create_table(
        "evenements_analytiques",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("type_evenement", sa.String(length=50), nullable=False),
        sa.Column("colis_id_anonyme", sa.String(length=64), nullable=True),
        sa.Column("voyage_id_anonyme", sa.String(length=64), nullable=True),
        sa.Column("chauffeur_id_anonyme", sa.String(length=64), nullable=True),
        sa.Column("gare_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("ligne_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("date_id", sa.Date(), nullable=False),
        sa.Column("horodatage", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "est_simule", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["chauffeur_id_anonyme"],
            ["dimension_chauffeur_analytique.chauffeur_id_anonyme"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["gare_id"],
            ["dimension_gare_analytique.gare_id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["ligne_id"],
            ["dimension_ligne_analytique.ligne_id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["date_id"],
            ["dimension_date_analytique.date_id"],
            ondelete="RESTRICT",
        ),
    )
    op.create_index(
        "ix_evenements_analytiques_type_date",
        "evenements_analytiques",
        ["type_evenement", "date_id"],
    )
    op.create_index(
        "ix_evenements_analytiques_gare_date",
        "evenements_analytiques",
        ["gare_id", "date_id"],
    )
    op.create_index(
        "ix_evenements_analytiques_ligne_date",
        "evenements_analytiques",
        ["ligne_id", "date_id"],
    )
    op.create_index(
        "ix_evenements_analytiques_chauffeur_date",
        "evenements_analytiques",
        ["chauffeur_id_anonyme", "date_id"],
    )

    op.execute(
        """
        CREATE FUNCTION interdire_modification_evenements_analytiques()
        RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'Les événements analytiques sont en ajout seul.';
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER evenements_analytiques_append_only
        BEFORE UPDATE OR DELETE ON evenements_analytiques
        FOR EACH ROW
        EXECUTE FUNCTION interdire_modification_evenements_analytiques();
        """
    )


def downgrade() -> None:
    op.execute(
        "DROP TRIGGER IF EXISTS evenements_analytiques_append_only "
        "ON evenements_analytiques"
    )
    op.execute(
        "DROP FUNCTION IF EXISTS interdire_modification_evenements_analytiques()"
    )
    op.drop_index(
        "ix_evenements_analytiques_chauffeur_date",
        table_name="evenements_analytiques",
    )
    op.drop_index(
        "ix_evenements_analytiques_ligne_date",
        table_name="evenements_analytiques",
    )
    op.drop_index(
        "ix_evenements_analytiques_gare_date",
        table_name="evenements_analytiques",
    )
    op.drop_index(
        "ix_evenements_analytiques_type_date",
        table_name="evenements_analytiques",
    )
    op.drop_table("evenements_analytiques")
    op.drop_table("dimension_date_analytique")
    op.drop_table("dimension_chauffeur_analytique")
    op.drop_table("dimension_ligne_analytique")
    op.drop_table("dimension_gare_analytique")
