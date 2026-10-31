"""fusion_branches_courantes

ID de révision : ad7c75240a8b
Révisions précédentes : 6c0ab99453ef, 20261031_0100
Créée le : 2026-10-31 02:04:35.007152
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# Identifiants de révision
revision: str = 'ad7c75240a8b'
down_revision: Union[str, None] = ('6c0ab99453ef', '20261031_0100')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Application de la migration."""
    pass


def downgrade() -> None:
    """Annulation de la migration."""
    pass
