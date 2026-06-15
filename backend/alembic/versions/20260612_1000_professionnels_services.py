"""Migration: tables pour les services professionnels (medical, enrolement, police, ONG).

Generated automatically based on model definitions.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260612_1000_professionnels_services"
down_revision: Union[str, None] = "20260610_1200_d5e6f7a8b9c0_ui_role_config"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Dossiers medicaux ---
    op.create_table(
        "dossiers_medicaux",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("medecin_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("utilisateurs.id"), nullable=False, index=True),
        sa.Column("patient_nom", sa.String(255), nullable=False),
        sa.Column("patient_digiid", sa.String(50), nullable=False, index=True),
        sa.Column("patient_date_naissance", sa.Date(), nullable=True),
        sa.Column("motif", sa.String(500), nullable=False),
        sa.Column("diagnostic", sa.Text(), nullable=True),
        sa.Column("statut", sa.String(20), nullable=False, server_default="ouvert"),
        sa.Column("date_creation", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("date_modification", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "consultations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("dossier_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("dossiers_medicaux.id"), nullable=False, index=True),
        sa.Column("medecin_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("utilisateurs.id"), nullable=False),
        sa.Column("motif", sa.String(500), nullable=False),
        sa.Column("observations", sa.Text(), nullable=True),
        sa.Column("diagnostic", sa.Text(), nullable=True),
        sa.Column("date_consultation", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "ordonnances",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("dossier_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("dossiers_medicaux.id"), nullable=False, index=True),
        sa.Column("medecin_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("utilisateurs.id"), nullable=False),
        sa.Column("medicaments", sa.Text(), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("date_prescription", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("date_expiration", sa.Date(), nullable=True),
    )

    # --- Enrolement agent ---
    op.create_table(
        "enrolements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("agent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("utilisateurs.id"), nullable=False, index=True),
        sa.Column("citoyen_nom", sa.String(255), nullable=False),
        sa.Column("citoyen_prenom", sa.String(255), nullable=False),
        sa.Column("citoyen_digiid", sa.String(50), nullable=True, index=True),
        sa.Column("citoyen_telephone", sa.String(50), nullable=True),
        sa.Column("citoyen_email", sa.String(255), nullable=True),
        sa.Column("statut", sa.String(20), nullable=False, server_default="en_attente"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("scan_cni", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("capture_biometrique", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("date_enrolement", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("date_validation", sa.DateTime(), nullable=True),
    )

    # --- Police ---
    op.create_table(
        "verifications_police",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("officier_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("utilisateurs.id"), nullable=False, index=True),
        sa.Column("personne_digiid", sa.String(50), nullable=False, index=True),
        sa.Column("personne_nom", sa.String(255), nullable=True),
        sa.Column("type_verification", sa.String(50), nullable=False, server_default="identite"),
        sa.Column("resultat", sa.String(20), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("date_verification", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("est_signalement_fraude", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    op.create_table(
        "signalements_fraude",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("officier_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("utilisateurs.id"), nullable=False, index=True),
        sa.Column("personne_digiid", sa.String(50), nullable=False, index=True),
        sa.Column("motif", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("statut", sa.String(20), nullable=False, server_default="en_cours"),
        sa.Column("date_signalement", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("date_traitement", sa.DateTime(), nullable=True),
    )

    # --- ONG ---
    op.create_table(
        "beneficiaires_ong",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("ong_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("utilisateurs.id"), nullable=False, index=True),
        sa.Column("nom", sa.String(255), nullable=False),
        sa.Column("digiid", sa.String(50), nullable=True, index=True),
        sa.Column("programme", sa.String(255), nullable=False),
        sa.Column("zone", sa.String(100), nullable=True),
        sa.Column("date_inscription", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("statut", sa.String(20), nullable=False, server_default="actif"),
        sa.Column("notes", sa.Text(), nullable=True),
    )

    op.create_table(
        "programmes_ong",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("ong_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("utilisateurs.id"), nullable=False, index=True),
        sa.Column("nom", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("zone", sa.String(100), nullable=True),
        sa.Column("budget", sa.Float(), nullable=True),
        sa.Column("date_debut", sa.Date(), nullable=False),
        sa.Column("date_fin", sa.Date(), nullable=True),
        sa.Column("statut", sa.String(20), nullable=False, server_default="actif"),
    )

    op.create_table(
        "missions_terrain",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("ong_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("utilisateurs.id"), nullable=False, index=True),
        sa.Column("programme_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("programmes_ong.id"), nullable=True),
        sa.Column("titre", sa.String(255), nullable=False),
        sa.Column("zone", sa.String(100), nullable=True),
        sa.Column("date_depart", sa.Date(), nullable=False),
        sa.Column("date_retour", sa.Date(), nullable=True),
        sa.Column("objectifs", sa.Text(), nullable=True),
        sa.Column("statut", sa.String(20), nullable=False, server_default="planifiee"),
    )


def downgrade() -> None:
    op.drop_table("missions_terrain")
    op.drop_table("programmes_ong")
    op.drop_table("beneficiaires_ong")
    op.drop_table("signalements_fraude")
    op.drop_table("verifications_police")
    op.drop_table("enrolements")
    op.drop_table("ordonnances")
    op.drop_table("consultations")
    op.drop_table("dossiers_medicaux")
