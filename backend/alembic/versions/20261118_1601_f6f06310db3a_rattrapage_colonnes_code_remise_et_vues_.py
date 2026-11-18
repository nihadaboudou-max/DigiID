"""rattrapage colonnes code_remise et vues analytiques

ID de révision : f6f06310db3a
Révisions précédentes : 9abbee559b4a
Créée le : 2026-11-18 16:01:16.095113
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# Identifiants de révision
revision: str = 'f6f06310db3a'
down_revision: Union[str, None] = '9abbee559b4a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Application de la migration."""
    pass


def downgrade() -> None:
    """Annulation de la migration."""
    pass
