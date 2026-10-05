"""Fusion p0_passagers_bagages

ID de révision : ff6df78c095d
Révisions précédentes : 20260817_1000_p0_passagers_bagages, 982a46683c7f
Créée le : 2026-10-05 20:29:19.065376
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# Identifiants de révision
revision: str = 'ff6df78c095d'
down_revision: Union[str, None] = ('20260817_1000_p0_passagers_bagages', '982a46683c7f')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Application de la migration."""
    pass


def downgrade() -> None:
    """Annulation de la migration."""
    pass
