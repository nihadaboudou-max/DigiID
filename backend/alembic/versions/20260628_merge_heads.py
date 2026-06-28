"""merge heads

Revision ID: 20260628_merge
Revises: 20260628_1000, police_001
Create Date: 2026-06-28
"""
from alembic import op

revision = '20260628_merge'
down_revision = ('20260628_1000', 'police_001')
branch_labels = None
depends_on = None

def upgrade() -> None:
    pass

def downgrade() -> None:
    pass