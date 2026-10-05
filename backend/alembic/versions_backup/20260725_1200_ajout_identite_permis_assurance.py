"""ajouter nom_famille et prenoms aux documents permis et assurance

Revision ID: 20260725_1200_ajout_identite_permis_assurance
Revises: c7a8b9d0e1f2
Create Date: 2026-07-25 12:00:00.000000

Contexte : l'OCR extrait le nom/prénom du titulaire lors du scan d'un permis
ou d'une assurance (pour la validation de cohérence) mais ces données n'étaient
pas persistées. Cette migration ajoute les colonnes correspondantes afin que
l'historique puisse les renvoyer et que la page « Documents d'identité »
les affiche.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260725_1200_ajout_identite_permis_assurance"
down_revision: Union[str, None] = "c7a8b9d0e1f2"
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
    _ajouter_colonnes_si_absentes("permis_conduire", [
        ("nom_famille", sa.String(255)),
        ("prenoms", sa.String(255)),
    ])
    _ajouter_colonnes_si_absentes("assurances_auto", [
        ("nom_famille", sa.String(255)),
        ("prenoms", sa.String(255)),
    ])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for table in ("permis_conduire", "assurances_auto"):
        if table not in inspector.get_table_names():
            continue
        existantes = {c["name"] for c in inspector.get_columns(table)}
        for colonne in ("nom_famille", "prenoms"):
            if colonne in existantes:
                op.drop_column(table, colonne)
