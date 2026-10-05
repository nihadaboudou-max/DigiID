"""fusion branches identite et permis

ID de révision : cdeee85236b2
Révisions précédentes : 20260725_1200_ajout_identite_permis_assurance, ced3f38acfce
Créée le : 2026-08-03 23:04:21.108317
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# Identifiants de révision
revision: str = 'cdeee85236b2'
down_revision: Union[str, None] = ('20260725_1200_ajout_identite_permis_assurance', 'ced3f38acfce')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Application de la migration."""
    pass


def downgrade() -> None:
    """Annulation de la migration."""
    pass
