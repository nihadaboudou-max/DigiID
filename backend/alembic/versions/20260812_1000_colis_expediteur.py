"""colis : nom et téléphone de l'expéditeur saisis au guichet

ID de révision : 20260812_1000_colis_expediteur
Révision précédente : 20260811_1000_colis_bout_en_bout
Créée le : 2026-08-12 10:00:00.000000

Contexte (Plan B, étape S3) : l'assistant d'enregistrement du guichet saisit
désormais l'expéditeur (souvent un tiers sans compte DigiID) à l'étape 1.
On stocke donc son nom et son téléphone en clair, en plus de `expediteur_id`.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260812_1000_colis_expediteur"
down_revision: Union[str, None] = "20260811_1000_colis_bout_en_bout"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("colis", sa.Column("expediteur_nom", sa.String(150), nullable=True))
    op.add_column("colis", sa.Column("expediteur_tel", sa.String(30), nullable=True))


def downgrade() -> None:
    op.drop_column("colis", "expediteur_tel")
    op.drop_column("colis", "expediteur_nom")
