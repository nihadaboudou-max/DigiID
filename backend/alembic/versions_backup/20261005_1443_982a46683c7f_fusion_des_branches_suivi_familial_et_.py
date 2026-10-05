"""Fusion des branches suivi familial et paiement

ID de révision : 982a46683c7f
Révisions précédentes : 20260816_1000_suivi_familial_sms, f106f41c6209
Créée le : 2026-10-05 14:43:42.647690
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# Identifiants de révision
revision: str = '982a46683c7f'
down_revision: Union[str, None] = ('20260816_1000_suivi_familial_sms', 'f106f41c6209')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Application de la migration."""
    pass


def downgrade() -> None:
    """Annulation de la migration."""
    pass
