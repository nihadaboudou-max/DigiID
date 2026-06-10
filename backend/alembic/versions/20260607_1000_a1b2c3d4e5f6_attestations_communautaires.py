# -*- coding: utf-8 -*-
"""Ajout de la table attestations_communautaires — Étape 4.

Revision ID: a1b2c3d4e5f6
Revises: j7k8l9m0n1o2
Create Date: 2026-06-07 10:00:00.000000

Description :
  Crée la table des attestations communautaires pour le réseau
  de confiance pair-à-pair entre utilisateurs DigiID.
"""
from typing import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# Identifiants de révision
revision: str = "a1b2c3d4e5f6"
down_revision: str = "j7k8l9m0n1o2"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """
    Crée la table attestations_communautaires avec :
      - Types énumérés (type_attestation_enum, statut_attestation_enum)
      - Contrainte anti-auto-attestation
      - Index pour la recherche et le tri
    """
    # --- Création des types ENUM (un par requête pour respecter asyncpg) ---
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'type_attestation_enum') THEN
                CREATE TYPE type_attestation_enum AS ENUM (
                    'identite', 'competence', 'moralite',
                    'residence', 'activite', 'personnalise'
                );
            END IF;
        END
        $$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'statut_attestation_enum') THEN
                CREATE TYPE statut_attestation_enum AS ENUM (
                    'EN_ATTENTE', 'APPROUVEE', 'REFUSEE', 'EXPIREE'
                );
            END IF;
        END
        $$;
        """
    )

    # --- Création de la table (SQL pur car create_type=False n'est pas respecté) ---
    op.execute(
        """
        CREATE TABLE attestations_communautaires (
            id UUID NOT NULL DEFAULT gen_random_uuid(),
            attestant_id UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
            atteste_id UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
            type_attestation type_attestation_enum NOT NULL DEFAULT 'identite',
            titre VARCHAR(200) NOT NULL,
            description TEXT,
            forces TEXT,
            lien_connu_depuis VARCHAR(100),
            lien_nature VARCHAR(100),
            statut statut_attestation_enum NOT NULL DEFAULT 'EN_ATTENTE',
            motif_refus TEXT,
            date_soumission TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            date_decision TIMESTAMP WITH TIME ZONE,
            date_expiration TIMESTAMP WITH TIME ZONE,
            poids_score FLOAT NOT NULL DEFAULT 5.0,
            signature_numerique TEXT,
            est_active BOOLEAN NOT NULL DEFAULT true,
            est_visible_public BOOLEAN NOT NULL DEFAULT false,
            CONSTRAINT pk_attestations_communautaires PRIMARY KEY (id),
            CONSTRAINT ck_attestation_pas_auto CHECK (attestant_id != atteste_id)
        );
        """
    )

    # --- Index ---
    op.execute(
        """
        CREATE INDEX ix_attestations_communautaires_attestant_id
            ON attestations_communautaires(attestant_id);
        """
    )
    op.execute(
        """
        CREATE INDEX ix_attestations_communautaires_atteste_id
            ON attestations_communautaires(atteste_id);
        """
    )
    op.execute(
        """
        CREATE INDEX ix_attestations_communautaires_statut
            ON attestations_communautaires(statut);
        """
    )
    op.execute(
        """
        CREATE INDEX ix_attestations_attestant_atteste
            ON attestations_communautaires(attestant_id, atteste_id);
        """
    )
    op.execute(
        """
        CREATE INDEX ix_attestations_statut_date
            ON attestations_communautaires(statut, date_soumission);
        """
    )


def downgrade() -> None:
    """
    Supprime la table et les types énumérés.
    """
    # Supprimer d'abord la table
    op.drop_table("attestations_communautaires")

    # Supprimer les types énumérés
    op.execute("DROP TYPE IF EXISTS statut_attestation_enum")
    op.execute("DROP TYPE IF EXISTS type_attestation_enum")
