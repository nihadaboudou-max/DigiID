"""Identité DigiID durable, enregistrement direct chauffeur, profils logistiques

ID de révision : 20261006_1000_identite_digiid_profils
Révision précédente : 22500ece2f6e
Créée le : 2026-10-06 10:00:00.000000

P1 — « Le client au centre, le guichet en appui » :

  - **Carte DigiID durable** : ``utilisateur.qr_token_digiid`` (jeton opaque
    encodé dans le QR personnel) + ``utilisateur.adresse`` (pré-remplissage).
  - **Enregistrement direct par le chauffeur** : ``colis.mode_enregistrement``,
    ``colis.enregistre_par_id``, ``suivi_familial.mode_enregistrement``
    (+ statuts ``enregistre_direct``).
  - **Profils logistiques** : nouvelle table ``profils_logistiques``
    (pièce d'identité, permis, véhicule, statut de vérification métier).

⚠️ Toutes les instructions sont **idempotentes** (``IF NOT EXISTS``) : sur les
bases existantes, ``create_all`` a déjà créé la table et ``scripts/migrer.py``
ajoute les colonnes. Cette migration sert de trace et sécurise une base vierge.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261006_1000_identite_digiid_profils"
down_revision: Union[str, None] = "22500ece2f6e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── Carte DigiID durable (utilisateur) ──────────────────────────
    op.execute("ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS adresse VARCHAR(255)")
    op.execute(
        "ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS qr_token_digiid VARCHAR(64)"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_utilisateur_qr_token_digiid "
        "ON utilisateur(qr_token_digiid) WHERE qr_token_digiid IS NOT NULL"
    )

    # ─── Colis : origine de l'enregistrement ─────────────────────────
    op.execute(
        "ALTER TABLE colis ADD COLUMN IF NOT EXISTS mode_enregistrement "
        "VARCHAR(20) NOT NULL DEFAULT 'guichet'"
    )
    op.execute(
        "ALTER TABLE colis ADD COLUMN IF NOT EXISTS enregistre_par_id UUID "
        "REFERENCES utilisateur(id) ON DELETE SET NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_colis_enregistre_par ON colis(enregistre_par_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_colis_mode_enregistrement "
        "ON colis(mode_enregistrement)"
    )

    # ─── Suivi familial : origine de l'enregistrement ────────────────
    op.execute(
        "ALTER TABLE suivi_familial ADD COLUMN IF NOT EXISTS mode_enregistrement "
        "VARCHAR(20) NOT NULL DEFAULT 'guichet'"
    )

    # ─── Profils logistiques (dossier professionnel) ─────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS profils_logistiques (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            utilisateur_id UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
            type_profil VARCHAR(20) NOT NULL,
            identifiant_public VARCHAR(20) NOT NULL,
            type_piece VARCHAR(30),
            numero_piece VARCHAR(60),
            piece_verifiee BOOLEAN NOT NULL DEFAULT false,
            permis_numero VARCHAR(60),
            permis_categorie VARCHAR(30),
            permis_expiration DATE,
            permis_verifie BOOLEAN NOT NULL DEFAULT false,
            vehicule_immatriculation VARCHAR(30),
            vehicule_marque VARCHAR(60),
            vehicule_modele VARCHAR(60),
            vehicule_capacite INTEGER,
            photo_verifiee BOOLEAN NOT NULL DEFAULT false,
            statut_verification VARCHAR(20) NOT NULL DEFAULT 'en_attente',
            est_verifie BOOLEAN NOT NULL DEFAULT false,
            verifie_le TIMESTAMP WITH TIME ZONE,
            verifie_par_id UUID REFERENCES utilisateur(id) ON DELETE SET NULL,
            notes TEXT,
            cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            modifie_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """)
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_profils_logistiques_utilisateur_unique "
        "ON profils_logistiques(utilisateur_id)"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_profils_logistiques_identifiant_unique "
        "ON profils_logistiques(identifiant_public)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_profils_logistiques_type_profil "
        "ON profils_logistiques(type_profil)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_profils_logistiques_statut "
        "ON profils_logistiques(statut_verification)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_profils_logistiques_vehicule "
        "ON profils_logistiques(vehicule_immatriculation)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS profils_logistiques")
    op.execute("ALTER TABLE suivi_familial DROP COLUMN IF EXISTS mode_enregistrement")
    op.execute("DROP INDEX IF EXISTS ix_colis_mode_enregistrement")
    op.execute("DROP INDEX IF EXISTS ix_colis_enregistre_par")
    op.execute("ALTER TABLE colis DROP COLUMN IF EXISTS enregistre_par_id")
    op.execute("ALTER TABLE colis DROP COLUMN IF EXISTS mode_enregistrement")
    op.execute("DROP INDEX IF EXISTS ix_utilisateur_qr_token_digiid")
    op.execute("ALTER TABLE utilisateur DROP COLUMN IF EXISTS qr_token_digiid")
    op.execute("ALTER TABLE utilisateur DROP COLUMN IF EXISTS adresse")
