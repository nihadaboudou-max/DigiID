"""add verification_cni table for OCR CNI module

Revision ID: c5d6e7f8a9b0
Revises: f4a8d2b1e7c9
Create Date: 2026-06-06 10:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "c5d6e7f8a9b0"
down_revision: Union[str, None] = "f4a8d2b1e7c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Crée la table verification_cni pour le module OCR CNI."""
    op.create_table(
        "verification_cni",
        # --- Identifiants ---
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("utilisateur_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("utilisateur.id", ondelete="CASCADE"),
                  nullable=False, index=True),

        # --- Métadonnées fichier ---
        sa.Column("face", sa.String(10), nullable=False, default="recto"),
        sa.Column("nom_fichier", sa.String(255), nullable=False),
        sa.Column("type_mime", sa.String(100), nullable=False),
        sa.Column("taille_octets", sa.Integer(), nullable=False),

        # --- Statut ---
        sa.Column("statut", sa.String(30), nullable=False, default="en_attente"),

        # --- Identité extraite ---
        sa.Column("nom_famille", sa.String(255), nullable=True),
        sa.Column("prenoms", sa.String(255), nullable=True),
        sa.Column("sexe", sa.String(10), nullable=True),
        sa.Column("date_naissance", sa.String(15), nullable=True),
        sa.Column("lieu_naissance", sa.String(255), nullable=True),

        # --- Carte extraite ---
        sa.Column("numero_cni", sa.String(30), nullable=True),
        sa.Column("date_delivrance", sa.String(15), nullable=True),
        sa.Column("date_expiration", sa.String(15), nullable=True),
        sa.Column("autorite_delivrance", sa.String(255), nullable=True),
        sa.Column("taille", sa.String(10), nullable=True),

        # --- MRZ ---
        sa.Column("mrz_ligne_1", sa.String(30), nullable=True),
        sa.Column("mrz_ligne_2", sa.String(30), nullable=True),
        sa.Column("mrz_ligne_3", sa.String(30), nullable=True),

        # --- Métadonnées OCR ---
        sa.Column("format_carte", sa.String(30), nullable=True),
        sa.Column("texte_brut", sa.Text(), nullable=True),
        sa.Column("taux_confiance_ocr", sa.Float(), nullable=True),
        sa.Column("erreurs_ocr", postgresql.JSON(), nullable=True),

        # --- Résultats validation ---
        sa.Column("validation_mrz", sa.Boolean(), nullable=True),
        sa.Column("est_valide", sa.Boolean(), nullable=True),
        sa.Column("scores_validation", postgresql.JSON(), nullable=True),
        sa.Column("date_traitement", sa.DateTime(timezone=True), nullable=True),

        # --- Corbeille ---
        sa.Column("est_supprime", sa.Boolean(), nullable=False, default=False),
        sa.Column("date_suppression", sa.DateTime(timezone=True), nullable=True),

        # --- Notes ---
        sa.Column("notes", sa.Text(), nullable=True),

        # --- Tracabilité (MelangeTracabilite) ---
        sa.Column("cree_le", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False, index=True),
        sa.Column("modifie_le", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )

    # Index pour les recherches par face + utilisateur
    op.create_index(
        "ix_verification_cni_utilisateur_face",
        "verification_cni",
        ["utilisateur_id", "face"],
    )
    # Index pour filtrer les non-supprimés
    op.create_index(
        "ix_verification_cni_utilisateur_non_supprime",
        "verification_cni",
        ["utilisateur_id", "est_supprime"],
    )


def downgrade() -> None:
    """Supprime la table verification_cni."""
    op.drop_index("ix_verification_cni_utilisateur_non_supprime",
                  table_name="verification_cni")
    op.drop_index("ix_verification_cni_utilisateur_face",
                  table_name="verification_cni")
    op.drop_table("verification_cni")
