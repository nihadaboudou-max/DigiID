"""fusion_definitive_et_propre

ID de révision : 15f0e9cc68d4
Révisions précédentes : base_propre, 20260817_1000_p0_passagers_bagages
Créée le : 2026-10-05 21:24:48.927853
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# Identifiants de révision
revision: str = '15f0e9cc68d4'
down_revision: Union[str, None] = ('base_propre', '20260817_1000_p0_passagers_bagages')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Application de la migration."""
    pass


def downgrade() -> None:
    """Annulation de la migration."""
    pass
