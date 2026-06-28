"""Ajout des tables domaines et departements pour le cloisonnement multi-niveaux

Revision ID: 20260628_1000
Revises: 003_ajouter_image_data_et_index
Create Date: 2026-06-28 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers
revision = '20260628_1000'
down_revision = '003_ajouter_image_data_et_index'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Crée les tables domaines et departements, ajoute colonnes à utilisateur."""
    
    # ─── Table domaines ──────────────────────────────────────────────
    op.create_table(
        "domaines",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("nom", sa.String(150), nullable=False),
        sa.Column("code", sa.String(20), nullable=False, unique=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("region", sa.String(100), nullable=True),
        sa.Column("admin_id", UUID(as_uuid=True), 
                  sa.ForeignKey("utilisateur.id", ondelete="SET NULL"), 
                  nullable=True),
        sa.Column("est_actif", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("date_creation", sa.DateTime(timezone=True), 
                  nullable=False, server_default=sa.func.now()),
        sa.Column("date_modification", sa.DateTime(timezone=True), nullable=True),
        sa.Column("date_suspension", sa.DateTime(timezone=True), nullable=True),
        sa.Column("motif_suspension", sa.Text, nullable=True),
    )
    
    op.create_index("ix_domaines_code_unique", "domaines", ["code"], unique=True)
    op.create_index("ix_domaines_admin", "domaines", ["admin_id"])
    op.create_index("ix_domaines_actif", "domaines", ["est_actif"])
    
    # ─── Table departements ──────────────────────────────────────────
    op.create_table(
        "departements",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("nom", sa.String(150), nullable=False),
        sa.Column("type_departement", sa.String(30), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("domaine_id", UUID(as_uuid=True),
                  sa.ForeignKey("domaines.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("chef_id", UUID(as_uuid=True),
                  sa.ForeignKey("utilisateur.id", ondelete="SET NULL"),
                  nullable=True),
        sa.Column("permissions_personnalisees", JSONB, nullable=True),
        sa.Column("capacite_max", sa.Integer, nullable=False, server_default="0"),
        sa.Column("est_actif", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("date_creation", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.func.now()),
        sa.Column("date_modification", sa.DateTime(timezone=True), nullable=True),
        sa.Column("date_desactivation", sa.DateTime(timezone=True), nullable=True),
    )
    
    op.create_unique_constraint(
        "uq_departement_domaine_type",
        "departements",
        ["domaine_id", "type_departement"]
    )
    op.create_index("ix_departements_domaine", "departements", ["domaine_id"])
    op.create_index("ix_departements_chef", "departements", ["chef_id"])
    op.create_index("ix_departements_type", "departements", ["type_departement"])
    op.create_index("ix_departements_actif", "departements", ["est_actif"])
    
    # ─── Table invitations ───────────────────────────────────────────
    op.create_table(
        "invitations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("token", sa.String(64), nullable=False, unique=True),
        sa.Column("email_destinataire", sa.String(255), nullable=False),
        sa.Column("role_propose", sa.String(50), nullable=False),
        sa.Column("domaine_id", UUID(as_uuid=True),
                  sa.ForeignKey("domaines.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("departement_id", UUID(as_uuid=True),
                  sa.ForeignKey("departements.id", ondelete="CASCADE"),
                  nullable=True),
        sa.Column("invite_par_id", UUID(as_uuid=True),
                  sa.ForeignKey("utilisateur.id", ondelete="SET NULL"),
                  nullable=False),
        sa.Column("message_personnalise", sa.Text, nullable=True),
        sa.Column("est_acceptee", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("date_expiration", sa.DateTime(timezone=True), nullable=False),
        sa.Column("date_acceptation", sa.DateTime(timezone=True), nullable=True),
        sa.Column("utilisateur_cree_id", UUID(as_uuid=True),
                  sa.ForeignKey("utilisateur.id", ondelete="SET NULL"),
                  nullable=True),
        sa.Column("date_creation", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.func.now()),
    )
    
    op.create_index("ix_invitations_token", "invitations", ["token"], unique=True)
    op.create_index("ix_invitations_email", "invitations", ["email_destinataire"])
    op.create_index("ix_invitations_domaine", "invitations", ["domaine_id"])
    op.create_index("ix_invitations_expiree", "invitations", ["date_expiration"])
    
    # ─── Ajout colonnes à utilisateur ────────────────────────────────
    op.add_column(
        "utilisateur",
        sa.Column("domaine_id", UUID(as_uuid=True),
                  sa.ForeignKey("domaines.id", ondelete="SET NULL"),
                  nullable=True)
    )
    op.add_column(
        "utilisateur",
        sa.Column("departement_id", UUID(as_uuid=True),
                  sa.ForeignKey("departements.id", ondelete="SET NULL"),
                  nullable=True)
    )
    op.add_column(
        "utilisateur",
        sa.Column("est_chef_departement", sa.Boolean, 
                  nullable=False, server_default="false")
    )
    op.add_column(
        "utilisateur",
        sa.Column("superieur_id", UUID(as_uuid=True),
                  sa.ForeignKey("utilisateur.id", ondelete="SET NULL"),
                  nullable=True)
    )
    
    op.create_index("ix_utilisateur_domaine", "utilisateur", ["domaine_id"])
    op.create_index("ix_utilisateur_departement", "utilisateur", ["departement_id"])
    op.create_index("ix_utilisateur_chef", "utilisateur", ["est_chef_departement"])
    op.create_index("ix_utilisateur_superieur", "utilisateur", ["superieur_id"])


def downgrade() -> None:
    """Annule les modifications."""
    # Supprimer index et colonnes utilisateur
    op.drop_index("ix_utilisateur_superieur", "utilisateur")
    op.drop_index("ix_utilisateur_chef", "utilisateur")
    op.drop_index("ix_utilisateur_departement", "utilisateur")
    op.drop_index("ix_utilisateur_domaine", "utilisateur")
    op.drop_column("utilisateur", "superieur_id")
    op.drop_column("utilisateur", "est_chef_departement")
    op.drop_column("utilisateur", "departement_id")
    op.drop_column("utilisateur", "domaine_id")
    
    # Supprimer table invitations
    op.drop_table("invitations")
    
    # Supprimer table departements
    op.drop_table("departements")
    
    # Supprimer table domaines
    op.drop_table("domaines")