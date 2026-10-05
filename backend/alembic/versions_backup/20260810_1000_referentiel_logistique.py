"""référentiel logistique (gares, lignes, véhicules, voyages, acteurs)

ID de révision : 20260810_1000_referentiel_logistique
Révision précédente : 20260807_0900_ajout_photo_chemin_verifications
Créée le : 2026-08-10 10:00:00.000000

Contexte (Plan B, étape S1) : socle de données du pivot logistique avant les
colis. Crée les 5 tables du référentiel.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260810_1000_referentiel_logistique"
down_revision: Union[str, None] = "20260807_0900_ajout_photo_chemin_verifications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── Gares ───────────────────────────────────────────────────────
    op.create_table(
        "gares",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nom", sa.String(150), nullable=False),
        sa.Column("code", sa.String(20), nullable=False),
        sa.Column("ville", sa.String(100), nullable=False),
        sa.Column("domain_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actif", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("cree_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("modifie_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["domain_id"], ["domaines.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_gares_code_unique", "gares", ["code"], unique=True)
    op.create_index("ix_gares_ville", "gares", ["ville"])
    op.create_index("ix_gares_actif", "gares", ["actif"])
    op.create_index("ix_gares_domain_id", "gares", ["domain_id"])

    # ─── Lignes ──────────────────────────────────────────────────────
    op.create_table(
        "lignes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("gare_depart_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("gare_arrivee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("distance_km", sa.Float(), nullable=True),
        sa.Column("duree_min", sa.Integer(), nullable=True),
        sa.Column("actif", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("cree_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("modifie_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["gare_depart_id"], ["gares.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["gare_arrivee_id"], ["gares.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_lignes_depart", "lignes", ["gare_depart_id"])
    op.create_index("ix_lignes_arrivee", "lignes", ["gare_arrivee_id"])
    op.create_index("ix_lignes_actif", "lignes", ["actif"])

    # ─── Véhicules ───────────────────────────────────────────────────
    op.create_table(
        "vehicules",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("immatriculation", sa.String(30), nullable=False),
        sa.Column("marque", sa.String(100), nullable=True),
        sa.Column("capacite", sa.Integer(), nullable=True),
        sa.Column("gare_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actif", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("cree_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("modifie_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["gare_id"], ["gares.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_vehicules_immatriculation_unique", "vehicules", ["immatriculation"], unique=True)
    op.create_index("ix_vehicules_gare", "vehicules", ["gare_id"])
    op.create_index("ix_vehicules_actif", "vehicules", ["actif"])

    # ─── Voyages ─────────────────────────────────────────────────────
    op.create_table(
        "voyages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ligne_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("vehicule_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("chauffeur_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("date_depart", sa.DateTime(timezone=True), nullable=False),
        sa.Column("date_arrivee", sa.DateTime(timezone=True), nullable=True),
        sa.Column("statut", sa.String(30), nullable=False, server_default="planifie"),
        sa.Column("cree_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("modifie_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["ligne_id"], ["lignes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["vehicule_id"], ["vehicules.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["chauffeur_id"], ["utilisateur.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_voyages_ligne", "voyages", ["ligne_id"])
    op.create_index("ix_voyages_vehicule", "voyages", ["vehicule_id"])
    op.create_index("ix_voyages_chauffeur", "voyages", ["chauffeur_id"])
    op.create_index("ix_voyages_depart", "voyages", ["date_depart"])
    op.create_index("ix_voyages_statut", "voyages", ["statut"])

    # ─── Acteurs logistiques ─────────────────────────────────────────
    op.create_table(
        "acteurs_logistiques",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("utilisateur_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(30), nullable=False),
        sa.Column("gare_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("numero_licence", sa.String(50), nullable=True),
        sa.Column("actif", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("cree_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("modifie_le", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["utilisateur_id"], ["utilisateur.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["gare_id"], ["gares.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_acteurs_utilisateur", "acteurs_logistiques", ["utilisateur_id"])
    op.create_index("ix_acteurs_gare", "acteurs_logistiques", ["gare_id"])
    op.create_index("ix_acteurs_role", "acteurs_logistiques", ["role"])
    op.create_index("ix_acteurs_licence_unique", "acteurs_logistiques", ["numero_licence"], unique=True)


def downgrade() -> None:
    op.drop_table("acteurs_logistiques")
    op.drop_table("voyages")
    op.drop_table("vehicules")
    op.drop_table("lignes")
    op.drop_table("gares")
