"""Super Admin Organisationnel - Domaines, Départements, Invitations, Équipes

Revision ID: 20260630_0001
Revises: 20260628_merge
Create Date: 2026-06-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '20260630_0001'
down_revision = '20260628_merge'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Domaines
    op.create_table(
        'domaines',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('nom', sa.String(255), nullable=False, unique=True),
        sa.Column('code', sa.String(50), nullable=False, unique=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('region', sa.String(100), nullable=True),
        sa.Column('admin_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('utilisateur.id'), nullable=True),
        sa.Column('est_actif', sa.Boolean, default=True, nullable=False),
        sa.Column('date_creation', sa.DateTime, nullable=False),
        sa.Column('date_modification', sa.DateTime, nullable=True),
        sa.Column('date_suspension', sa.DateTime, nullable=True),
        sa.Column('motif_suspension', sa.Text, nullable=True),
    )
    op.create_index('ix_domaines_nom', 'domaines', ['nom'])
    op.create_index('ix_domaines_code', 'domaines', ['code'])

    # Départements
    op.create_table(
        'departements',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('nom', sa.String(255), nullable=False),
        sa.Column('type_departement', sa.String(50), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('capacite_max', sa.Integer, default=50),
        sa.Column('domaine_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('domaines.id', ondelete='CASCADE'), nullable=False),
        sa.Column('chef_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('utilisateur.id'), nullable=True),
        sa.Column('est_actif', sa.Boolean, default=True, nullable=False),
        sa.Column('date_creation', sa.DateTime, nullable=False),
        sa.Column('date_modification', sa.DateTime, nullable=True),
    )
    op.create_index('ix_departements_nom', 'departements', ['nom'])
    op.create_index('ix_departements_domaine_id', 'departements', ['domaine_id'])

    # Invitations
    op.create_table(
        'invitations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('role', sa.String(50), nullable=False),
        sa.Column('domaine_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('domaines.id', ondelete='SET NULL'), nullable=True),
        sa.Column('departement_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('departements.id', ondelete='SET NULL'), nullable=True),
        sa.Column('statut', sa.String(20), default='en_attente', nullable=False),
        sa.Column('message', sa.Text, nullable=True),
        sa.Column('token', sa.String(255), unique=True),
        sa.Column('cree_par', postgresql.UUID(as_uuid=True), sa.ForeignKey('utilisateur.id'), nullable=False),
        sa.Column('date_creation', sa.DateTime, nullable=False),
        sa.Column('date_expiration', sa.DateTime, nullable=False),
        sa.Column('date_acceptation', sa.DateTime, nullable=True),
    )
    op.create_index('ix_invitations_email', 'invitations', ['email'])
    op.create_index('ix_invitations_token', 'invitations', ['token'])

    # Équipes
    op.create_table(
        'equipes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('nom', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('departement_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('departements.id', ondelete='CASCADE'), nullable=False),
        sa.Column('chef_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('utilisateur.id'), nullable=True),
        sa.Column('est_actif', sa.Boolean, default=True, nullable=False),
        sa.Column('date_creation', sa.DateTime, nullable=False),
        sa.Column('date_modification', sa.DateTime, nullable=True),
    )
    op.create_index('ix_equipes_nom', 'equipes', ['nom'])
    op.create_index('ix_equipes_departement_id', 'equipes', ['departement_id'])


def downgrade() -> None:
    op.drop_table('equipes')
    op.drop_table('invitations')
    op.drop_table('departements')
    op.drop_table('domaines')