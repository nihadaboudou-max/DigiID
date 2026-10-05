"""colis : nombre d'articles (base du frais de service par tranches)

ID de révision : 20260815_1000_nombre_articles_colis
Révision précédente : 20260814_1000_frais_service_degressif
Créée le : 2026-08-15 10:00:00.000000

Contexte (Plan B, étape S6 — correction tarifaire) : le frais de service DigiID
n'est plus dégressif selon le nombre de colis suivis dans le mois, mais calculé
selon le **nombre d'articles** contenus dans le colis (1-3 → 100 F, 4-6 → 200 F,
7-10 → 350 F, plus de 10 → 500 F). On ajoute donc la colonne ``nombre_articles``
au colis (valeur par défaut : 1, pour les colis déjà enregistrés).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260815_1000_nombre_articles_colis"
down_revision: Union[str, None] = "20260814_1000_frais_service_degressif"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "colis",
        sa.Column(
            "nombre_articles",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
    )


def downgrade() -> None:
    op.drop_column("colis", "nombre_articles")
