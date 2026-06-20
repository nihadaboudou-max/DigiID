"""create document_identite table

Revision ID: 20260620_2100_document_identite
Revises: 20260620_1200_enrichissement_medical
Create Date: 2026-06-20 21:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260620_2100_document_identite"
down_revision: Union[str, None] = "20260620_1200_enrichissement_medical"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "document_identite",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("utilisateur_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("utilisateur.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("type_document", sa.String(20), nullable=False, index=True),
        sa.Column("est_actif", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("source", sa.String(10), nullable=True, server_default="manuel"),
        sa.Column("a_ete_corrige", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("verification_id", postgresql.UUID(as_uuid=True), nullable=True),

        # Champs communs
        sa.Column("numero_document", sa.String(50), nullable=True),
        sa.Column("nom_complet", sa.String(255), nullable=True),
        sa.Column("date_naissance", sa.Date(), nullable=True),
        sa.Column("lieu_naissance", sa.String(255), nullable=True),
        sa.Column("nationalite", sa.String(100), nullable=True, server_default="Sénégalaise"),
        sa.Column("sexe", sa.String(1), nullable=True),
        sa.Column("adresse", sa.String(500), nullable=True),
        sa.Column("date_delivrance", sa.Date(), nullable=True),
        sa.Column("date_expiration", sa.Date(), nullable=True),
        sa.Column("pays_emetteur", sa.String(100), nullable=True, server_default="Sénégal"),

        # CNI
        sa.Column("autorite_delivrance", sa.String(255), nullable=True),
        sa.Column("profession", sa.String(255), nullable=True),
        sa.Column("taille_cm", sa.Integer(), nullable=True),

        # Permis
        sa.Column("categories_permis", sa.String(50), nullable=True),
        sa.Column("centre_examen", sa.String(255), nullable=True),
        sa.Column("numero_permis", sa.String(50), nullable=True),

        # Assurance
        sa.Column("compagnie_assurance", sa.String(255), nullable=True),
        sa.Column("type_couverture", sa.String(100), nullable=True),
        sa.Column("numero_contrat", sa.String(50), nullable=True),
        sa.Column("immatriculation_vehicule", sa.String(20), nullable=True),
        sa.Column("marque_vehicule", sa.String(100), nullable=True),
        sa.Column("modele_vehicule", sa.String(100), nullable=True),
        sa.Column("annee_vehicule", sa.Integer(), nullable=True),

        # Traçabilité
        sa.Column("cree_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("modifie_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("document_identite")
