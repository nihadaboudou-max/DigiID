"""ajout colonne photo_chemin aux verifications visuelle et CNI

ID de révision : 20260807_0900_ajout_photo_chemin_verifications
Révision précédente : 8c2972f8b688
Créée le : 2026-08-07 09:00:00.000000

Contexte : le backend stocke désormais sur disque le selfie approuvé
(verification visuelle) et l'image du recto de la CNI, puis les sert à la
police via un endpoint protégé (contrôle visuel d'identité). Cette migration
ajoute la colonne `photo_chemin` (chemin relatif au dossier media) aux deux
tables concernées.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# Identifiants de révision
revision: str = "20260807_0900_ajout_photo_chemin_verifications"
down_revision: Union[str, None] = "8c2972f8b688"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _ajouter_colonnes_si_absentes(table: str, colonnes: list[tuple[str, sa.types.TypeEngine]]) -> None:
    """Ajoute des colonnes nullable uniquement si elles n'existent pas encore."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if table not in inspector.get_table_names():
        return
    existantes = {c["name"] for c in inspector.get_columns(table)}
    for nom, type_ in colonnes:
        if nom not in existantes:
            op.add_column(table, sa.Column(nom, type_, nullable=True))


def upgrade() -> None:
    _ajouter_colonnes_si_absentes("verification_visuelle", [
        ("photo_chemin", sa.String(500)),
    ])
    _ajouter_colonnes_si_absentes("verification_cni", [
        ("photo_chemin", sa.String(500)),
    ])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for table in ("verification_visuelle", "verification_cni"):
        if table not in inspector.get_table_names():
            continue
        existantes = {c["name"] for c in inspector.get_columns(table)}
        if "photo_chemin" in existantes:
            op.drop_column(table, "photo_chemin")
