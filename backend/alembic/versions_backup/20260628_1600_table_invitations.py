"""table invitations

Revision ID: 20260628_1600
Revises: 20260628_1500
Create Date: 2026-06-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '20260628_1600'
down_revision = '20260628_1500'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'invitations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('token', sa.String(64), nullable=False),
        sa.Column('role', sa.String(50), nullable=False),
        sa.Column('domaine_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('departement_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('statut', sa.String(20), nullable=False, server_default='en_attente'),
        sa.Column('cree_par', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('message', sa.Text, nullable=True),
        sa.Column('date_creation', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('date_expiration', sa.DateTime(timezone=True), nullable=False),
        sa.Column('date_acceptation', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['domaine_id'], ['domaines.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['departement_id'], ['departements.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['cree_par'], ['utilisateur.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_invitations_token_unique', 'invitations', ['token'], unique=True)
    op.create_index('ix_invitations_email', 'invitations', ['email'])
    op.create_index('ix_invitations_statut', 'invitations', ['statut'])
    op.create_index('ix_invitations_domaine', 'invitations', ['domaine_id'])
    op.create_index('ix_invitations_cree_par', 'invitations', ['cree_par'])


def downgrade() -> None:
    op.drop_index('ix_invitations_cree_par', table_name='invitations')
    op.drop_index('ix_invitations_domaine', table_name='invitations')
    op.drop_index('ix_invitations_statut', table_name='invitations')
    op.drop_index('ix_invitations_email', table_name='invitations')
    op.drop_index('ix_invitations_token_unique', table_name='invitations')
    op.drop_table('invitations')