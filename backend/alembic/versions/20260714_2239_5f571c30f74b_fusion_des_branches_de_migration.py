"""Fusion des branches de migration

ID de révision : 5f571c30f74b
Révisions précédentes : 20260105_001, 20260702_1300
Créée le : 2026-07-14 22:39:27.055735
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# Identifiants de révision
revision: str = '5f571c30f74b'
down_revision: Union[str, None] = ('20260105_001', '20260702_1300')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Application de la migration."""
    pass


def downgrade() -> None:
    """Annulation de la migration."""
    pass
