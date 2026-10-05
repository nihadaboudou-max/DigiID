"""add streak and bonus fields to utilisateur

Revision ID: 9d8c5e1c8f3a
Revises: ed9346c47f5a
Create Date: 2026-06-04 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9d8c5e1c8f3a'
down_revision = 'ed9346c47f5a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ajouter les champs manquants à la table utilisateur
    op.add_column('utilisateur', sa.Column('streak_actuel', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('utilisateur', sa.Column('streak_record', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('utilisateur', sa.Column('bonus_score_cumule', sa.Integer(), nullable=False, server_default='0'))
    
    # Ajouter des index pour les performances
    op.create_index(op.f('ix_utilisateur_streak_actuel'), 'utilisateur', ['streak_actuel'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_utilisateur_streak_actuel'), table_name='utilisateur')
    op.drop_column('utilisateur', 'bonus_score_cumule')
    op.drop_column('utilisateur', 'streak_record')
    op.drop_column('utilisateur', 'streak_actuel')
