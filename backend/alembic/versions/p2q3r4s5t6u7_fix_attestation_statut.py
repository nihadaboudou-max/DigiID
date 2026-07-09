# -*- coding: utf-8 -*-
"""Correction de l'enum statut_attestation_enum et de la table attestations_communautaires.

Revision ID: p2q3r4s5t6u7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-08 23:50:00.000000

Description :
  - Remplace l'enum MAJUSCULES par des minuscules cohérentes avec le frontend
  - Renomme date_decision → date_validation
  - Ajoute la colonne valide_par
  - Corrige la ForeignKey utilisateur → utilisateurs
"""
from typing import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# Identifiants de révision
revision: str = "p2q3r4s5t6u7"
down_revision: str = "a1b2c3d4e5f6"  # ← La migration précédente
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """
    Corrige la table attestations_communautaires :
      1. Supprime l'ancien enum MAJUSCULES
      2. Crée un nouvel enum en minuscules
      3. Renomme date_decision → date_validation
      4. Ajoute la colonne valide_par
      5. Convertit les données existantes
    """
    
    # =====================================================================
    # ÉTAPE 1 : Convertir les données existantes AVANT de changer l'enum
    # =====================================================================
    
    # Convertir les valeurs MAJUSCULES en minuscules
    op.execute("""
        UPDATE attestations_communautaires 
        SET statut = LOWER(statut)
        WHERE statut IN ('EN_ATTENTE', 'APPROUVEE', 'REFUSEE', 'EXPIREE')
    """)
    
    # Convertir 'approuvee' en 'validee' (cohérent avec le frontend)
    op.execute("""
        UPDATE attestations_communautaires 
        SET statut = 'validee'
        WHERE statut = 'approuvee'
    """)
    
    # =====================================================================
    # ÉTAPE 2 : Supprimer l'ancien enum MAJUSCULES
    # =====================================================================
    
    # D'abord, changer temporairement la colonne en VARCHAR pour pouvoir supprimer l'enum
    op.execute("""
        ALTER TABLE attestations_communautaires 
        ALTER COLUMN statut TYPE VARCHAR(50)
        USING statut::text
    """)
    
    # Maintenant on peut supprimer l'ancien enum
    op.execute("DROP TYPE IF EXISTS statut_attestation_enum")
    
    # =====================================================================
    # ÉTAPE 3 : Créer le nouvel enum en minuscules
    # =====================================================================
    
    op.execute("""
        CREATE TYPE statut_attestation_enum AS ENUM (
            'en_attente',
            'validee',
            'refusee',
            'expiree'
        )
    """)
    
    # =====================================================================
    # ÉTAPE 4 : Reconvertir la colonne vers le nouvel enum
    # =====================================================================
    
    op.execute("""
        ALTER TABLE attestations_communautaires 
        ALTER COLUMN statut TYPE statut_attestation_enum
        USING statut::statut_attestation_enum
    """)
    
    # Définir la valeur par défaut
    op.execute("""
        ALTER TABLE attestations_communautaires 
        ALTER COLUMN statut SET DEFAULT 'en_attente'::statut_attestation_enum
    """)
    
    # =====================================================================
    # ÉTAPE 5 : Renommer date_decision → date_validation
    # =====================================================================
    
    op.execute("""
        ALTER TABLE attestations_communautaires 
        RENAME COLUMN date_decision TO date_validation
    """)
    
    # =====================================================================
    # ÉTAPE 6 : Ajouter la colonne valide_par
    # =====================================================================
    
    op.execute("""
        ALTER TABLE attestations_communautaires 
        ADD COLUMN IF NOT EXISTS valide_par UUID REFERENCES utilisateurs(id) ON DELETE SET NULL
    """)
    
    # =====================================================================
    # ÉTAPE 7 : Créer un index sur valide_par
    # =====================================================================
    
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_attestations_communautaires_valide_par
            ON attestations_communautaires(valide_par)
    """)


def downgrade() -> None:
    """
    Annule les corrections (retour à l'état initial).
    """
    
    # Supprimer l'index
    op.execute("DROP INDEX IF EXISTS ix_attestations_communautaires_valide_par")
    
    # Supprimer la colonne valide_par
    op.execute("ALTER TABLE attestations_communautaires DROP COLUMN IF EXISTS valide_par")
    
    # Renommer date_validation → date_decision
    op.execute("""
        ALTER TABLE attestations_communautaires 
        RENAME COLUMN date_validation TO date_decision
    """)
    
    # Revenir à l'ancien enum MAJUSCULES
    op.execute("""
        ALTER TABLE attestations_communautaires 
        ALTER COLUMN statut TYPE VARCHAR(50)
        USING statut::text
    """)
    
    op.execute("DROP TYPE IF EXISTS statut_attestation_enum")
    
    op.execute("""
        CREATE TYPE statut_attestation_enum AS ENUM (
            'EN_ATTENTE', 'APPROUVEE', 'REFUSEE', 'EXPIREE'
        )
    """)
    
    op.execute("""
        ALTER TABLE attestations_communautaires 
        ALTER COLUMN statut TYPE statut_attestation_enum
        USING statut::statut_attestation_enum
    """)
    
    op.execute("""
        ALTER TABLE attestations_communautaires 
        ALTER COLUMN statut SET DEFAULT 'EN_ATTENTE'::statut_attestation_enum
    """)