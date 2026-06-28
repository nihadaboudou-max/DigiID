"""merge domaines et police

Revision ID: XXXX
Revises: 20260628_1000, police_001
Create Date: 2026-06-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'XXXX'  # Garde le même ID généré
down_revision = ('20260628_1000', 'police_001')  # Tuple pour merge
branch_labels = None
depends_on = None

def upgrade() -> None:
    """Les tables existent déjà, migration vide."""
    pass

def downgrade() -> None:
    """Pas de downgrade pour un merge."""
    pass