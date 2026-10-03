"""colis de bout en bout (colis, tickets QR + code clair, colis_evenements)

ID de révision : 20260811_1000_colis_bout_en_bout
Révision précédente : 20260810_1000_referentiel_logistique
Créée le : 2026-08-11 10:00:00.000000

Contexte (Plan B, étape S2) : cœur de la démo. Enregistrement d'un colis,
ticket (QR dynamique + numéro en clair) et timeline d'événements idempotents
(règle anti-« DÉJÀ LIVRÉ »).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260811_1000_colis_bout_en_bout"
down_revision: Union[str, None] = "20260810_1000_referentiel_logistique"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── Tickets (QR + numéro en clair) ──────────────────────────────
    op.create_table(
        "tickets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code_clair", sa.String(40), nullable=False),
        sa.Column("qr_token", sa.String(96), nullable=False),
        sa.Column("type", sa.String(20), nullable=False, server_default="COLIS"),
        sa.Column("reference_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("voyage_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("statut", sa.String(30), nullable=False, server_default="emis"),
        sa.Column("nb_scans", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("premier_scan_le", sa.DateTime(timezone=True), nullable=True),
        sa.Column("imprime_le", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cree_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("modifie_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["voyage_id"], ["voyages.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tickets_code_clair_unique", "tickets", ["code_clair"], unique=True)
    op.create_index("ix_tickets_qr_token_unique", "tickets", ["qr_token"], unique=True)
    op.create_index("ix_tickets_type", "tickets", ["type"])
    op.create_index("ix_tickets_reference", "tickets", ["reference_id"])
    op.create_index("ix_tickets_voyage", "tickets", ["voyage_id"])
    op.create_index("ix_tickets_statut", "tickets", ["statut"])

    # ─── Colis ───────────────────────────────────────────────────────
    op.create_table(
        "colis",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ticket_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("expediteur_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("destinataire_nom", sa.String(150), nullable=False),
        sa.Column("destinataire_tel", sa.String(30), nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("poids_kg", sa.Float(), nullable=True),
        sa.Column("valeur_fcfa", sa.Integer(), nullable=True),
        sa.Column("gare_depart_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("gare_arrivee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("voyage_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("receveur_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("chauffeur_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("statut", sa.String(30), nullable=False, server_default="enregistre"),
        sa.Column("frais_fcfa", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("livre_le", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cree_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("modifie_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["expediteur_id"], ["utilisateur.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["gare_depart_id"], ["gares.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["gare_arrivee_id"], ["gares.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["voyage_id"], ["voyages.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["receveur_id"], ["utilisateur.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["chauffeur_id"], ["utilisateur.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_colis_ticket_unique", "colis", ["ticket_id"], unique=True)
    op.create_index("ix_colis_expediteur", "colis", ["expediteur_id"])
    op.create_index("ix_colis_gare_depart", "colis", ["gare_depart_id"])
    op.create_index("ix_colis_gare_arrivee", "colis", ["gare_arrivee_id"])
    op.create_index("ix_colis_voyage", "colis", ["voyage_id"])
    op.create_index("ix_colis_receveur", "colis", ["receveur_id"])
    op.create_index("ix_colis_chauffeur", "colis", ["chauffeur_id"])
    op.create_index("ix_colis_statut", "colis", ["statut"])

    # ─── Événements colis (timeline) ─────────────────────────────────
    op.create_table(
        "colis_evenements",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("colis_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("type_evenement", sa.String(40), nullable=False),
        sa.Column("acteur_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("gare_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("localisation", sa.String(200), nullable=True),
        sa.Column("horodatage", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("idempotency_key", sa.String(120), nullable=True),
        sa.Column("synchro_le", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cree_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("modifie_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["colis_id"], ["colis.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["acteur_id"], ["utilisateur.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["gare_id"], ["gares.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_colis_evenements_colis", "colis_evenements", ["colis_id"])
    op.create_index("ix_colis_evenements_type", "colis_evenements", ["type_evenement"])
    op.create_index("ix_colis_evenements_horodatage", "colis_evenements", ["horodatage"])
    op.create_index("ix_colis_evenements_acteur", "colis_evenements", ["acteur_id"])
    op.create_index(
        "ix_colis_evenements_idempotency_unique",
        "colis_evenements",
        ["idempotency_key"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_table("colis_evenements")
    op.drop_table("colis")
    op.drop_table("tickets")
