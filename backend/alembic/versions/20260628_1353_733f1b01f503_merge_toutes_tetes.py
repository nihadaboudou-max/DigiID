"""merge_toutes_tetes

ID de révision : 733f1b01f503
Révisions précédentes : 20260628_1500, 20260628_merge
Créée le : 2026-06-28 13:53:34.553910
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# Identifiants de révision
revision: str = '733f1b01f503'
down_revision: Union[str, None] = ('20260628_1500', '20260628_merge')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Application de la migration."""
    pass


def downgrade() -> None:
    """Annulation de la migration."""
    pass
