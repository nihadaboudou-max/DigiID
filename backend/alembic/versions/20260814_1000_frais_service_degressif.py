"""frais de service dégressif + prélèvement unique par colis

ID de révision : 20260814_1000_frais_service_degressif
Révision précédente : 20260813_1000_paiement_minimal
Créée le : 2026-08-14 10:00:00.000000

Contexte (Plan B, étape S6) — trois ajustements du modèle économique :

1. **Prix du transport facultatif** : ``colis.frais_fcfa`` devient nullable et
   perd sa valeur par défaut. C'est le revenu du transporteur ; DigiID ne
   l'encaisse pas, on évite donc de l'exiger (ni de donner l'impression de
   surveiller les recettes du guichet).
2. **Répartition explicite** : ``transactions_paiement.commission_receveur``
   isole la part du receveur (25 FCFA) de notre part (``frais_plateforme``).
3. **Prélèvement unique** : index unique partiel garantissant qu'un colis ne
   peut avoir qu'**une seule** transaction active (en attente ou réussie) — les
   frais de service ne sont donc jamais prélevés deux fois.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260814_1000_frais_service_degressif"
down_revision: Union[str, None] = "20260813_1000_paiement_minimal"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Statuts pour lesquels un paiement de colis « occupe » le colis.
_STATUTS_ACTIFS = "('en_attente', 'reussi')"


def upgrade() -> None:
    # ─── 1. Prix du transport facultatif ─────────────────────────
    op.alter_column(
        "colis",
        "frais_fcfa",
        existing_type=sa.Integer(),
        nullable=True,
        server_default=None,
    )

    # ─── 2. Part du receveur isolée dans la transaction ──────────
    op.add_column(
        "transactions_paiement",
        sa.Column(
            "commission_receveur",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )

    # ─── 3. Un seul prélèvement par colis ────────────────────────
    op.create_index(
        "ix_transactions_paiement_colis_actif_unique",
        "transactions_paiement",
        ["colis_id"],
        unique=True,
        postgresql_where=sa.text(
            f"colis_id IS NOT NULL AND statut IN {_STATUTS_ACTIFS}"
        ),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_transactions_paiement_colis_actif_unique",
        table_name="transactions_paiement",
    )
    op.drop_column("transactions_paiement", "commission_receveur")
    op.alter_column(
        "colis",
        "frais_fcfa",
        existing_type=sa.Integer(),
        nullable=False,
        server_default="100",
    )
