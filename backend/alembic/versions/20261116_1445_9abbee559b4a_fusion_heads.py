"""fusion_heads

ID de révision : 9abbee559b4a
Révisions précédentes : eeb065620cab, 20261121_0900
Créée le : 2026-11-16 14:45:05.000828
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# Identifiants de révision
revision: str = '9abbee559b4a'
down_revision: Union[str, None] = ('eeb065620cab', '20261121_0900')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Application de la migration."""
    pass


def downgrade() -> None:
    """Annulation de la migration."""
    pass
