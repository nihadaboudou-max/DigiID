"""add configuration_systeme table for feature flags

Revision ID: f4a8d2b1e7c9
Revises: ab12cd34ef56
Create Date: 2026-06-05 11:30:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'f4a8d2b1e7c9'
down_revision = 'ab12cd34ef56'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'configuration_systeme',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('cle', sa.String(length=100), unique=True, nullable=False, index=True),
        sa.Column('valeur', sa.JSON(), nullable=False, server_default=sa.text("'false'::jsonb")),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('categorie', sa.String(length=50), nullable=True, index=True),
        sa.Column('phase_introduction', sa.String(length=20), nullable=True),
        sa.Column('niveau_sensibilite', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('est_actif', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('cree_le', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('modifie_le', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_config_categorie_actif', 'configuration_systeme', ['categorie', 'est_actif'])


def downgrade() -> None:
    op.drop_index('ix_config_categorie_actif', table_name='configuration_systeme')
    op.drop_table('configuration_systeme')
