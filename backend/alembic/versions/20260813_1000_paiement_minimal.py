"""paiement minimal : portefeuilles, mouvements, transactions, commissions

ID de révision : 20260813_1000_paiement_minimal
Révision précédente : 20260812_1000_colis_expediteur
Créée le : 2026-08-13 10:00:00.000000

Contexte (Plan B, étape S6) : encaissement d'un colis (espèces ou mobile money
en mode mock) et **micro-commission de 25 FCFA reversée au receveur** dans sa
cagnotte. On trace chaque variation de solde (mouvements) pour garantir
l'auditabilité et l'idempotence (référence + clé d'idempotence uniques).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260813_1000_paiement_minimal"
down_revision: Union[str, None] = "20260812_1000_colis_expediteur"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── Portefeuilles (cagnottes) ──────────────────────────────
    op.create_table(
        "portefeuilles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("proprietaire_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("solde_fcfa", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("devise", sa.String(3), nullable=False, server_default="XOF"),
        sa.Column("actif", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("maj_le", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cree_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("modifie_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["proprietaire_id"], ["utilisateur.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_portefeuilles_proprietaire_unique",
        "portefeuilles",
        ["proprietaire_id"],
        unique=True,
    )
    op.create_index("ix_portefeuilles_actif", "portefeuilles", ["actif"])

    # ─── Mouvements de portefeuille ─────────────────────────────
    op.create_table(
        "mouvements_portefeuille",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("portefeuille_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sens", sa.String(10), nullable=False),
        sa.Column("montant_fcfa", sa.Integer(), nullable=False),
        sa.Column("motif", sa.String(60), nullable=False),
        sa.Column("reference_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("solde_apres", sa.Integer(), nullable=False),
        sa.Column("cree_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("modifie_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["portefeuille_id"], ["portefeuilles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_mouvements_portefeuille_pf", "mouvements_portefeuille", ["portefeuille_id"])
    op.create_index("ix_mouvements_portefeuille_sens", "mouvements_portefeuille", ["sens"])
    op.create_index("ix_mouvements_portefeuille_motif", "mouvements_portefeuille", ["motif"])
    op.create_index("ix_mouvements_portefeuille_reference", "mouvements_portefeuille", ["reference_id"])

    # ─── Transactions de paiement ───────────────────────────────
    op.create_table(
        "transactions_paiement",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reference", sa.String(40), nullable=False),
        sa.Column("idempotency_key", sa.String(120), nullable=True),
        sa.Column("payeur_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("beneficiaire_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("type", sa.String(20), nullable=False, server_default="COLIS"),
        sa.Column("colis_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("montant_fcfa", sa.Integer(), nullable=False),
        sa.Column("frais_plateforme", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("montant_net", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("statut", sa.String(20), nullable=False, server_default="en_attente"),
        sa.Column("moyen", sa.String(20), nullable=False, server_default="especes"),
        sa.Column("telephone", sa.String(30), nullable=True),
        sa.Column("confirme_le", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cree_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("modifie_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["payeur_id"], ["utilisateur.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["beneficiaire_id"], ["utilisateur.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["colis_id"], ["colis.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_transactions_paiement_reference_unique", "transactions_paiement", ["reference"], unique=True)
    op.create_index(
        "ix_transactions_paiement_idempotency_unique",
        "transactions_paiement",
        ["idempotency_key"],
        unique=True,
    )
    op.create_index("ix_transactions_paiement_payeur", "transactions_paiement", ["payeur_id"])
    op.create_index("ix_transactions_paiement_beneficiaire", "transactions_paiement", ["beneficiaire_id"])
    op.create_index("ix_transactions_paiement_colis", "transactions_paiement", ["colis_id"])
    op.create_index("ix_transactions_paiement_statut", "transactions_paiement", ["statut"])
    op.create_index("ix_transactions_paiement_type", "transactions_paiement", ["type"])
    op.create_index("ix_transactions_paiement_moyen", "transactions_paiement", ["moyen"])

    # ─── Commissions (reversements au receveur) ─────────────────
    op.create_table(
        "commissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("transaction_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("receveur_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("montant_fcfa", sa.Integer(), nullable=False),
        sa.Column("statut", sa.String(20), nullable=False, server_default="a_verser"),
        sa.Column("portefeuille_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("verse_le", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cree_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("modifie_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["transaction_id"], ["transactions_paiement.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["receveur_id"], ["utilisateur.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["portefeuille_id"], ["portefeuilles.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_commissions_transaction", "commissions", ["transaction_id"])
    op.create_index("ix_commissions_receveur", "commissions", ["receveur_id"])
    op.create_index("ix_commissions_statut", "commissions", ["statut"])
    op.create_index(
        "ix_commissions_transaction_receveur_unique",
        "commissions",
        ["transaction_id", "receveur_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_table("commissions")
    op.drop_table("transactions_paiement")
    op.drop_table("mouvements_portefeuille")
    op.drop_table("portefeuilles")
