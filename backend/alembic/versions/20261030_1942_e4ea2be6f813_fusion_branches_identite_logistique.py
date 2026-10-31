"""fusion_branches_identite_logistique

ID de révision : e4ea2be6f813
Révisions précédentes : e966ad25b005, 20261029_0900
Créée le : 2026-10-30 19:42:22.980510
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# Identifiants de révision
revision: str = 'e4ea2be6f813'
down_revision: Union[str, None] = ('e966ad25b005', '20261029_0900')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Application de la migration."""
    pass


def downgrade() -> None:
    """Annulation de la migration."""
    pass
