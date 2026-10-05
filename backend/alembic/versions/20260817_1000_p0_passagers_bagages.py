"""P0 ajusté — passagers/bagages, attribution chauffeur, pré-alerte

ID de révision : 20260817_1000_p0_passagers_bagages
Révision précédente : 20260816_1000_suivi_familial_sms
Créée le : 2026-08-17 10:00:00.000000

Ajustements du P0 (PROTOTYPE MÉMOIRE) :

  - **Enregistrement & contacts** : un passager (enfant **ou** adulte) est
    enregistré avec l'acheteur du ticket (enfant) / son propre numéro (adulte)
    **et** un proche de confiance à prévenir.
  - **Attribution obligatoire** : ``chauffeur_id`` ajouté au suivi familial
    (le voyage reste obligatoire, contrôlé applicativement).
  - **Bagages** : ``nombre_bagages`` (1 à 10) sur passager et colis + table
    ``bagages`` (une étiquette QR par sac — traçabilité / anti-fraude, **sans
    impact** sur le prix).
  - **Pré-alerte d'arrivée** : drapeau ``pre_alerte_envoyee``.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260817_1000_p0_passagers_bagages"
down_revision: Union[str, None] = "20260816_1000_suivi_familial_sms"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── Passager : contacts, attribution chauffeur, bagages, pré-alerte ──
    op.add_column("suivi_familial", sa.Column("type_passager", sa.String(10),
                  nullable=False, server_default="enfant"))
    op.add_column("suivi_familial", sa.Column("telephone_passager", sa.String(30), nullable=True))
    op.add_column("suivi_familial", sa.Column("acheteur_nom", sa.String(150), nullable=True))
    op.add_column("suivi_familial", sa.Column("acheteur_tel", sa.String(30), nullable=True))
    op.add_column("suivi_familial", sa.Column("proche_nom", sa.String(150), nullable=True))
    op.add_column("suivi_familial", sa.Column("proche_telephone", sa.String(30), nullable=True))
    op.add_column("suivi_familial", sa.Column("nombre_bagages", sa.Integer(),
                  nullable=False, server_default="1"))
    op.add_column("suivi_familial", sa.Column("chauffeur_id",
                  postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("suivi_familial", sa.Column("pre_alerte_envoyee", sa.Boolean(),
                  nullable=False, server_default="false"))
    op.create_foreign_key("fk_suivi_familial_chauffeur", "suivi_familial",
                          "utilisateur", ["chauffeur_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_suivi_familial_chauffeur", "suivi_familial", ["chauffeur_id"])

    # ─── Colis : nombre de sacs (traçabilité, sans impact sur le prix) ────
    op.add_column("colis", sa.Column("nombre_bagages", sa.Integer(),
                  nullable=False, server_default="1"))

    # ─── Bagages : une étiquette QR par sac ──────────────────────────────
    op.create_table(
        "bagages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ticket_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("suivi_familial_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("colis_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("numero_serie", sa.String(30), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("nombre_total", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("statut", sa.String(20), nullable=False, server_default="attendu"),
        sa.Column("cree_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("modifie_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["suivi_familial_id"], ["suivi_familial.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["colis_id"], ["colis.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_bagages_ticket_unique", "bagages", ["ticket_id"], unique=True)
    op.create_index("ix_bagages_suivi_familial", "bagages", ["suivi_familial_id"])
    op.create_index("ix_bagages_colis", "bagages", ["colis_id"])
    op.create_index("ix_bagages_statut", "bagages", ["statut"])


def downgrade() -> None:
    op.drop_table("bagages")
    op.drop_column("colis", "nombre_bagages")
    op.drop_index("ix_suivi_familial_chauffeur", table_name="suivi_familial")
    op.drop_constraint("fk_suivi_familial_chauffeur", "suivi_familial", type_="foreignkey")
    for colonne in (
        "pre_alerte_envoyee", "chauffeur_id", "nombre_bagages", "proche_telephone",
        "proche_nom", "acheteur_tel", "acheteur_nom", "telephone_passager",
        "type_passager",
    ):
        op.drop_column("suivi_familial", colonne)
