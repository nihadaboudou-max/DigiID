"""add image data and index for verification tables

Revision ID: 003_ajouter_image_data_et_index
Revises: 20260620_2100_document_identite
Create Date: 2026-06-22 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "003_ajouter_image_data_et_index"
down_revision: Union[str, None] = "20260620_2100_document_identite"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Ajoute les colonnes image_data et les index de performance."""

    # --- Table verification_visuelle ---
    op.add_column(
        "verification_visuelle",
        sa.Column(
            "image_data",
            sa.LargeBinary(),
            nullable=True,
            comment="Données binaires de l'image capturée lors de la vérification",
        ),
    )
    op.add_column(
        "verification_visuelle",
        sa.Column(
            "type_mime",
            sa.String(50),
            nullable=True,
            comment="Type MIME de l'image (jpeg, png, webp)",
        ),
    )
    op.create_index(
        "ix_verification_visuelle_officier_date",
        "verification_visuelle",
        ["officier_id", "date_verification"],
    )

    # --- Table verification_cni ---
    op.add_column(
        "verification_cni",
        sa.Column(
            "image_data_recto",
            sa.LargeBinary(),
            nullable=True,
            comment="Données binaires de l'image recto de la CNI",
        ),
    )
    op.add_column(
        "verification_cni",
        sa.Column(
            "image_data_verso",
            sa.LargeBinary(),
            nullable=True,
            comment="Données binaires de l'image verso de la CNI",
        ),
    )
    op.create_index(
        "ix_verification_cni_date_traitement",
        "verification_cni",
        ["date_traitement"],
    )

    # --- Table signalements_fraude ---
    op.add_column(
        "signalements_fraude",
        sa.Column(
            "pieces_jointes",
            postgresql.JSON(),
            nullable=True,
            comment="URLs ou IDs des pièces jointes (JSON array)",
        ),
    )
    op.add_column(
        "signalements_fraude",
        sa.Column(
            "priorite",
            sa.String(20),
            nullable=False,
            server_default="normale",
            comment="Priorité du signalement: basse, normale, haute, critique",
        ),
    )
    op.create_index(
        "ix_signalements_fraude_statut_priorite",
        "signalements_fraude",
        ["statut", "priorite"],
    )

    # --- Table notes_internes (police) ---
    op.create_table(
        "notes_internes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("officier_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("utilisateur.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("personne_digiid", sa.String(50), nullable=False, index=True),
        sa.Column("titre", sa.String(200), nullable=False),
        sa.Column("contenu", sa.Text(), nullable=True),
        sa.Column("categorie", sa.String(50), nullable=False, server_default="general"),
        sa.Column("est_important", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("est_partagee", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("date_creation", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("date_modification", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_notes_internes_officier_categorie",
        "notes_internes",
        ["officier_id", "categorie"],
    )


def downgrade() -> None:
    """Supprime les colonnes et tables ajoutées."""
    op.drop_index("ix_notes_internes_officier_categorie", table_name="notes_internes")
    op.drop_table("notes_internes")

    op.drop_index("ix_signalements_fraude_statut_priorite", table_name="signalements_fraude")
    op.drop_column("signalements_fraude", "priorite")
    op.drop_column("signalements_fraude", "pieces_jointes")

    op.drop_index("ix_verification_cni_date_traitement", table_name="verification_cni")
    op.drop_column("verification_cni", "image_data_verso")
    op.drop_column("verification_cni", "image_data_recto")

    op.drop_index("ix_verification_visuelle_officier_date", table_name="verification_visuelle")
    op.drop_column("verification_visuelle", "type_mime")
    op.drop_column("verification_visuelle", "image_data")
