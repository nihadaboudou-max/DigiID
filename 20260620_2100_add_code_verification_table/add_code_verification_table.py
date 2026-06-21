"""add_code_verification_table
ID de révision : a1b2c3d4e5f6
Révisions précédentes : 8eec7cc31fea
Créée le : 2026-06-22 10:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '8eec7cc31fea'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS code_verification (
            id UUID NOT NULL,
            utilisateur_id UUID NOT NULL,
            canal VARCHAR(20) NOT NULL,
            code VARCHAR(10) NOT NULL,
            destination VARCHAR(255) NOT NULL,
            tentative INTEGER NOT NULL DEFAULT 0,
            est_utilise BOOLEAN NOT NULL DEFAULT FALSE,
            date_expiration TIMESTAMP WITH TIME ZONE NOT NULL,
            type_verification VARCHAR(50) NOT NULL,
            cree_le TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            modifie_le TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            CONSTRAINT pk_code_verification PRIMARY KEY (id),
            CONSTRAINT fk_code_verification_utilisateur_id_utilisateur
                FOREIGN KEY (utilisateur_id) REFERENCES utilisateur (id)
                ON DELETE CASCADE
        )
    """))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_code_verification_utilisateur_id ON code_verification (utilisateur_id)"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_code_verification_date_expiration ON code_verification (date_expiration)"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_code_verification_type_canal ON code_verification (type_verification, canal)"))


def downgrade() -> None:
    op.execute(sa.text("DROP TABLE IF EXISTS code_verification"))
