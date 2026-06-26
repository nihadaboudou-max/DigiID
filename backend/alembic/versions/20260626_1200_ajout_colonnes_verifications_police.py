"""ajout colonnes pour verifications police (localisation, email, tel)

Revision ID: 20260626_1200_ajout_colonnes_verifications_police
Revises: 003_ajouter_image_data_et_index
Create Date: 2026-06-26 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20260626_1200_ajout_colonnes_verifications_police"
down_revision: Union[str, None] = "003_ajouter_image_data_et_index"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Ajoute les colonnes manquantes à verifications_police pour la phase Police."""

    # --- Table verifications_police ---
    op.add_column(
        "verifications_police",
        sa.Column(
            "personne_email",
            sa.String(255),
            nullable=True,
            comment="Email de la personne verifiee (cache)",
        ),
    )
    op.add_column(
        "verifications_police",
        sa.Column(
            "personne_telephone",
            sa.String(50),
            nullable=True,
            comment="Telephone de la personne verifiee (cache)",
        ),
    )
    op.add_column(
        "verifications_police",
        sa.Column(
            "motif_verification",
            sa.String(500),
            nullable=True,
            comment="Motif de la verification (controle routier, enquete, etc.)",
        ),
    )
    op.add_column(
        "verifications_police",
        sa.Column(
            "localisation_lat",
            sa.Float(),
            nullable=True,
            comment="Latitude GPS du lieu de verification",
        ),
    )
    op.add_column(
        "verifications_police",
        sa.Column(
            "localisation_lng",
            sa.Float(),
            nullable=True,
            comment="Longitude GPS du lieu de verification",
        ),
    )
    op.add_column(
        "verifications_police",
        sa.Column(
            "localisation_adresse",
            sa.String(500),
            nullable=True,
            comment="Adresse textuelle du lieu de verification",
        ),
    )
    op.add_column(
        "verifications_police",
        sa.Column(
            "officier_nom",
            sa.String(255),
            nullable=True,
            comment="Cache du nom de l'officier pour l'audit",
        ),
    )

    # Index pour les recherches geo
    op.create_index(
        "ix_verifications_police_localisation",
        "verifications_police",
        ["localisation_lat", "localisation_lng"],
        postgresql_using="gist",
    )

    # --- Table alertes_police ---
    op.create_table(
        "alertes_police",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("officier_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("utilisateur.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("type_alerte", sa.String(50), nullable=False,
                  comment="Type: verification, signalement, note, systeme"),
        sa.Column("titre", sa.String(200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("niveau", sa.String(20), nullable=False, server_default="info",
                  comment="info, avertissement, critique"),
        sa.Column("est_lue", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("est_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("donnees_liees", postgresql.JSON(), nullable=True),
        sa.Column("date_creation", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False, index=True),
        sa.Column("date_lecture", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_alertes_police_officier_non_lues",
        "alertes_police",
        ["officier_id", "est_lue"],
    )

    # --- Ajout d'une table pour les signalements police enrichie ---
    # Ajouter les colonnes manquantes à signalements_fraude
    op.add_column(
        "signalements_fraude",
        sa.Column(
            "notes_traitement",
            sa.Text(),
            nullable=True,
            comment="Notes de l'officier lors du traitement",
        ),
    )
    op.add_column(
        "signalements_fraude",
        sa.Column(
            "traite_par_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("utilisateur.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # --- Table enrolement ---
    op.create_table(
        "enrolements_police",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("officier_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("utilisateur.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("personne_digiid", sa.String(50), nullable=True),
        sa.Column("nom_complet", sa.String(255), nullable=True),
        sa.Column("statut", sa.String(30), nullable=False, server_default="en_attente"),
        sa.Column("type_enrolement", sa.String(50), nullable=False),
        sa.Column("donnees_saisies", postgresql.JSON(), nullable=True),
        sa.Column("documents_uploads", postgresql.JSON(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("date_enrolement", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("date_completion", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    """Annule les modifications."""
    op.drop_table("enrolements_police")
    op.drop_column("signalements_fraude", "traite_par_id")
    op.drop_column("signalements_fraude", "notes_traitement")
    op.drop_index("ix_alertes_police_officier_non_lues", table_name="alertes_police")
    op.drop_table("alertes_police")
    op.drop_index("ix_verifications_police_localisation", table_name="verifications_police")
    op.drop_column("verifications_police", "officier_nom")
    op.drop_column("verifications_police", "localisation_adresse")
    op.drop_column("verifications_police", "localisation_lng")
    op.drop_column("verifications_police", "localisation_lat")
    op.drop_column("verifications_police", "motif_verification")
    op.drop_column("verifications_police", "personne_telephone")
    op.drop_column("verifications_police", "personne_email")
