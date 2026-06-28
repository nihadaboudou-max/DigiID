"""merge_invitations

ID de révision : 0a34754d38ca
Révisions précédentes : 733f1b01f503, 20260628_1600
Créée le : 2026-06-28 23:48:46.682761
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# Identifiants de révision
revision: str = '0a34754d38ca'
down_revision: Union[str, None] = ('733f1b01f503', '20260628_1600')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Application de la migration."""
    pass


def downgrade() -> None:
    """Annulation de la migration."""
    pass
