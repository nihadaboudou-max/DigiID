"""ajout cloisonnement multi niveaux

Revision ID: XXXX
Revises: 20260628_0032_5921aaabce38
Create Date: 2026-06-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'XXXX'
down_revision = '20260628_0032_5921aaabce38'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Les tables existent déjà (créées manuellement), on stamp juste
    # Mais on peut ajouter des index supplémentaires si besoin
    pass

def downgrade() -> None:
    pass