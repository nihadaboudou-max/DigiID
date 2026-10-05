"""Migration: enrichissement complet module medical.

Ajoute les colonnes pour :
- DossierMedical : hopital, patient_prenom
- Consultation : hopital, type_consultation, poids, taille, temperature, pression_arterielle, conclusion
- Ordonnance : numero_ordonnance (unique auto-genere), hopital, medecin_nom, statut

Revision ID: 20260620_1200_enrichissement_medical
Revises: 20260617_1900_facteur_attestations_score
Create Date: 2026-06-20 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260620_1200_enrichissement_medical"
down_revision: Union[str, None] = "20260617_1900_facteur_attestations_score"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Créer la séquence pour les numéros d'ordonnance
    op.execute("CREATE SEQUENCE IF NOT EXISTS seq_numero_ordonnance START 1")

    # === DossierMedical ===
    op.add_column(
        "dossiers_medicaux",
        sa.Column("patient_prenom", sa.String(255), nullable=True),
    )
    op.add_column(
        "dossiers_medicaux",
        sa.Column("hopital", sa.String(255), nullable=True),
    )

    # === Consultation ===
    op.add_column(
        "consultations",
        sa.Column("hopital", sa.String(255), nullable=True),
    )
    op.add_column(
        "consultations",
        sa.Column("type_consultation", sa.String(50), nullable=True),
    )
    op.add_column(
        "consultations",
        sa.Column("poids", sa.Integer(), nullable=True),
    )
    op.add_column(
        "consultations",
        sa.Column("taille", sa.Integer(), nullable=True),
    )
    op.add_column(
        "consultations",
        sa.Column("temperature", sa.Integer(), nullable=True),
    )
    op.add_column(
        "consultations",
        sa.Column("pression_arterielle", sa.String(20), nullable=True),
    )
    op.add_column(
        "consultations",
        sa.Column("conclusion", sa.Text(), nullable=True),
    )

    # === Ordonnance ===
    op.add_column(
        "ordonnances",
        sa.Column("numero_ordonnance", sa.String(30), nullable=True),
    )
    # Remplir les ordonnances existantes
    op.execute("""
        UPDATE ordonnances
        SET numero_ordonnance = 'ORD-'
            || TO_CHAR(NOW(), 'YYYY')
            || '-'
            || LPAD(nextval('seq_numero_ordonnance')::text, 6, '0')
        WHERE numero_ordonnance IS NULL
    """)
    op.alter_column("ordonnances", "numero_ordonnance", nullable=False)
    op.create_unique_constraint("uq_ordonnances_numero", "ordonnances", ["numero_ordonnance"])

    op.add_column(
        "ordonnances",
        sa.Column("hopital", sa.String(255), nullable=True),
    )
    op.add_column(
        "ordonnances",
        sa.Column("medecin_nom", sa.String(255), nullable=True),
    )
    op.add_column(
        "ordonnances",
        sa.Column(
            "statut",
            sa.String(20),
            nullable=False,
            server_default=sa.text("'active'"),
        ),
    )


def downgrade() -> None:
    # === Ordonnance ===
    op.drop_constraint("uq_ordonnances_numero", "ordonnances", type_="unique")
    op.drop_column("ordonnances", "statut")
    op.drop_column("ordonnances", "medecin_nom")
    op.drop_column("ordonnances", "hopital")
    op.drop_column("ordonnances", "numero_ordonnance")

    # === Consultation ===
    op.drop_column("consultations", "conclusion")
    op.drop_column("consultations", "pression_arterielle")
    op.drop_column("consultations", "temperature")
    op.drop_column("consultations", "taille")
    op.drop_column("consultations", "poids")
    op.drop_column("consultations", "type_consultation")
    op.drop_column("consultations", "hopital")

    # === DossierMedical ===
    op.drop_column("dossiers_medicaux", "hopital")
    op.drop_column("dossiers_medicaux", "patient_prenom")

    # Supprimer la séquence
    op.execute("DROP SEQUENCE IF EXISTS seq_numero_ordonnance")
