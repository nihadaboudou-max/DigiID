"""table equipes et equipe_membres

Revision ID: 20260629_1700
Revises: 0a34754d38ca
Create Date: 2026-06-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '20260629_1700'
down_revision = '0a34754d38ca'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Table equipes
    op.create_table(
        'equipes',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('nom', sa.String(150), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('departement_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('chef_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('est_actif', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('date_creation', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('date_modification', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['departement_id'], ['departements.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['chef_id'], ['utilisateur.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_equipes_departement', 'equipes', ['departement_id'])
    op.create_index('ix_equipes_chef', 'equipes', ['chef_id'])
    op.create_index('ix_equipes_actif', 'equipes', ['est_actif'])

    # Table d'association equipe_membres
    op.create_table(
        'equipe_membres',
        sa.Column('equipe_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('utilisateur_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('date_ajout', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['equipe_id'], ['equipes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['utilisateur_id'], ['utilisateur.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('equipe_id', 'utilisateur_id'),
    )


def downgrade() -> None:
    op.drop_table('equipe_membres')
    op.drop_index('ix_equipes_actif', table_name='equipes')
    op.drop_index('ix_equipes_chef', table_name='equipes')
    op.drop_index('ix_equipes_departement', table_name='equipes')
    op.drop_table('equipes')