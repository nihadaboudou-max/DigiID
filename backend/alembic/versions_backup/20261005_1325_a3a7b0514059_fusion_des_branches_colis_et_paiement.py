"""Fusion des branches colis et paiement

ID de révision : a3a7b0514059
Révisions précédentes : 20260815_1000_nombre_articles_colis, 72b818dbb0e9
Créée le : 2026-10-05 13:25:42.929015
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# Identifiants de révision
revision: str = 'a3a7b0514059'
down_revision: Union[str, None] = ('20260815_1000_nombre_articles_colis', '72b818dbb0e9')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Application de la migration."""
    pass


def downgrade() -> None:
    """Annulation de la migration."""
    pass
