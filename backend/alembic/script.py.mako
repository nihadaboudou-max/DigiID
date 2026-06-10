# -*- coding: utf-8 -*-
"""${message}

ID de révision : ${up_revision}
Révisions précédentes : ${down_revision | comma,n}
Créée le : ${create_date}
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

# Identifiants de révision
revision: str = ${repr(up_revision)}
down_revision: Union[str, None] = ${repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}


def upgrade() -> None:
    """Application de la migration."""
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    """Annulation de la migration."""
    ${downgrades if downgrades else "pass"}
