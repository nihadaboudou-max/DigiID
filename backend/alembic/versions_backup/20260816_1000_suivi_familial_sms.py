"""suivi familial + SMS (suivi_familial, evenements, notifications_logistique)

ID de révision : 20260816_1000_suivi_familial_sms
Révision précédente : 20260815_1000_nombre_articles_colis
Créée le : 2026-08-16 10:00:00.000000

Contexte (Plan B, étape S7) :

  - **Suivi familial** : un enfant voyage seul, DigiID émet un ticket
    ``type=ENFANT`` (QR + code ``ENF-…``) et rassure la famille par **SMS au
    départ puis à l'arrivée**. La timeline du voyage est tracée dans
    ``suivi_familial_evenements`` (même logique idempotente que les colis).
  - **Notifications logistiques** : journal des SMS (départ / arrivée /
    livraison) émis pour un colis ou un enfant. En mode mock, ce journal rend
    le SMS simulé **visible** dans l'interface.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260816_1000_suivi_familial_sms"
down_revision: Union[str, None] = "20260815_1000_nombre_articles_colis"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── Suivi familial (enfants voyageant seuls) ────────────────────
    op.create_table(
        "suivi_familial",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ticket_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("enfant_nom", sa.String(150), nullable=False),
        sa.Column("enfant_age", sa.Integer(), nullable=True),
        sa.Column("enfant_sexe", sa.String(10), nullable=True),
        sa.Column("parent_nom", sa.String(150), nullable=True),
        sa.Column("telephone_parent", sa.String(30), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("gare_depart_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("gare_arrivee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("voyage_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("statut", sa.String(30), nullable=False, server_default="enregistre"),
        sa.Column("sms_depart_envoye", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("sms_arrivee_envoye", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("enregistre_par_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("cree_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("modifie_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["parent_id"], ["utilisateur.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["gare_depart_id"], ["gares.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["gare_arrivee_id"], ["gares.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["voyage_id"], ["voyages.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["enregistre_par_id"], ["utilisateur.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_suivi_familial_ticket_unique", "suivi_familial", ["ticket_id"], unique=True)
    op.create_index("ix_suivi_familial_voyage", "suivi_familial", ["voyage_id"])
    op.create_index("ix_suivi_familial_gare_depart", "suivi_familial", ["gare_depart_id"])
    op.create_index("ix_suivi_familial_gare_arrivee", "suivi_familial", ["gare_arrivee_id"])
    op.create_index("ix_suivi_familial_statut", "suivi_familial", ["statut"])
    op.create_index("ix_suivi_familial_enregistre_par", "suivi_familial", ["enregistre_par_id"])

    # ─── Événements du suivi familial (timeline) ─────────────────────
    op.create_table(
        "suivi_familial_evenements",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("suivi_familial_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("type_evenement", sa.String(40), nullable=False),
        sa.Column("acteur_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("gare_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("localisation", sa.String(200), nullable=True),
        sa.Column("horodatage", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("idempotency_key", sa.String(120), nullable=True),
        sa.Column("synchro_le", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cree_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("modifie_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["suivi_familial_id"], ["suivi_familial.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["acteur_id"], ["utilisateur.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["gare_id"], ["gares.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_suivi_fam_evenements_suivi", "suivi_familial_evenements", ["suivi_familial_id"])
    op.create_index("ix_suivi_fam_evenements_type", "suivi_familial_evenements", ["type_evenement"])
    op.create_index("ix_suivi_fam_evenements_horodatage", "suivi_familial_evenements", ["horodatage"])
    op.create_index(
        "ix_suivi_fam_evenements_idempotency_unique",
        "suivi_familial_evenements",
        ["idempotency_key"],
        unique=True,
    )

    # ─── Notifications logistiques (SMS départ/arrivée) ──────────────
    op.create_table(
        "notifications_logistique",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("canal", sa.String(20), nullable=False, server_default="sms"),
        sa.Column("type_cible", sa.String(30), nullable=False),
        sa.Column("cible_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("type_evenement", sa.String(40), nullable=False),
        sa.Column("destinataire_role", sa.String(30), nullable=True),
        sa.Column("telephone", sa.String(30), nullable=True),
        sa.Column("message", sa.String(500), nullable=False),
        sa.Column("envoye", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("cree_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("modifie_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notifs_logistique_cible", "notifications_logistique", ["type_cible", "cible_id"])
    op.create_index("ix_notifs_logistique_evenement", "notifications_logistique", ["type_evenement"])
    op.create_index("ix_notifs_logistique_telephone", "notifications_logistique", ["telephone"])


def downgrade() -> None:
    op.drop_table("notifications_logistique")
    op.drop_table("suivi_familial_evenements")
    op.drop_table("suivi_familial")
