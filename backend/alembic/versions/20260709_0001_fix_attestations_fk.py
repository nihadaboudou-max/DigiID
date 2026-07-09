# -*- coding: utf-8 -*-
"""Fix attestations_communautaires FK to point to utilisateurs (plural).

Revision ID: 20260709_0001
Revises: 20260709_merge
Create Date: 2026-07-09 01:05:00.000000
"""
from typing import Sequence
from alembic import op


revision: str = "20260709_0001"
down_revision: str = "20260709_merge"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """
    Corrige les Foreign Keys de attestations_communautaires
    pour pointer vers 'utilisateurs' (pluriel) au lieu de 'utilisateur'.
    """
    
    # 1. Supprimer les anciennes contraintes FK
    op.execute("""
        ALTER TABLE attestations_communautaires 
        DROP CONSTRAINT IF EXISTS attestations_communautaires_attestant_id_fkey
    """)
    
    op.execute("""
        ALTER TABLE attestations_communautaires 
        DROP CONSTRAINT IF EXISTS attestations_communautaires_atteste_id_fkey
    """)
    
    # 2. Ajouter les nouvelles FK pointant vers 'utilisateurs'
    op.execute("""
        ALTER TABLE attestations_communautaires 
        ADD CONSTRAINT attestations_communautaires_attestant_id_fkey
        FOREIGN KEY (attestant_id) 
        REFERENCES utilisateurs(id) 
        ON DELETE CASCADE
    """)
    
    op.execute("""
        ALTER TABLE attestations_communautaires 
        ADD CONSTRAINT attestations_communautaires_atteste_id_fkey
        FOREIGN KEY (atteste_id) 
        REFERENCES utilisateurs(id) 
        ON DELETE CASCADE
    """)
    
    # 3. Renommer date_decision → date_validation
    op.execute("""
        ALTER TABLE attestations_communautaires 
        RENAME COLUMN date_decision TO date_validation
    """)
    
    # 4. Ajouter la colonne valide_par
    op.execute("""
        ALTER TABLE attestations_communautaires 
        ADD COLUMN IF NOT EXISTS valide_par UUID 
        REFERENCES utilisateurs(id) ON DELETE SET NULL
    """)


def downgrade() -> None:
    """Annule les corrections."""
    op.execute("""
        ALTER TABLE attestations_communautaires 
        DROP CONSTRAINT IF EXISTS attestations_communautaires_valide_par_fkey
    """)
    op.execute("""
        ALTER TABLE attestations_communautaires 
        DROP COLUMN IF EXISTS valide_par
    """)
    op.execute("""
        ALTER TABLE attestations_communautaires 
        RENAME COLUMN date_validation TO date_decision
    """)
    op.execute("""
        ALTER TABLE attestations_communautaires 
        DROP CONSTRAINT IF EXISTS attestations_communautaires_attestant_id_fkey
    """)
    op.execute("""
        ALTER TABLE attestations_communautaires 
        DROP CONSTRAINT IF EXISTS attestations_communautaires_atteste_id_fkey
    """)