"""add code_parrainage to utilisateur

Revision ID: f2a8c1d9e5b7
Revises: 9d8c5e1c8f3a
Create Date: 2026-06-04 21:05:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f2a8c1d9e5b7'
down_revision = '9d8c5e1c8f3a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ajouter le champ code_parrainage à la table utilisateur
    op.add_column('utilisateur', sa.Column('code_parrainage', sa.String(length=8), nullable=True))
    op.create_index(op.f('ix_utilisateur_code_parrainage'), 'utilisateur', ['code_parrainage'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_utilisateur_code_parrainage'), table_name='utilisateur')
    op.drop_column('utilisateur', 'code_parrainage')
