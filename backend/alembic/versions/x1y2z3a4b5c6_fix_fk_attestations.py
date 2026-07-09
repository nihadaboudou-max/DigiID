# -*- coding: utf-8 -*-
"""Correction des Foreign Keys attestations → utilisateurs (pluriel).

Revision ID: x1y2z3a4b5c6
Revises: p2q3r4s5t6u7
Create Date: 2026-07-09 00:30:00.000000

Description :
  Corrige les Foreign Keys qui pointent vers 'utilisateur' (inexistant)
  pour pointer vers 'utilisateurs' (table réelle).
"""
from typing import Sequence

from alembic import op


# Identifiants de révision
revision: str = "x1y2z3a4b5c6"
down_revision: str = "p2q3r4s5t6u7"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """
    Corrige les Foreign Keys de la table attestations_communautaires.
    """
    
    # =====================================================================
    # ÉTAPE 1 : Supprimer les anciennes contraintes FK (vers 'utilisateur')
    # =====================================================================
    
    op.execute("""
        ALTER TABLE attestations_communautaires 
        DROP CONSTRAINT IF EXISTS attestations_communautaires_attestant_id_fkey
    """)
    
    op.execute("""
        ALTER TABLE attestations_communautaires 
        DROP CONSTRAINT IF EXISTS attestations_communautaires_atteste_id_fkey
    """)
    
    # =====================================================================
    # ÉTAPE 2 : Ajouter les nouvelles contraintes FK (vers 'utilisateurs')
    # =====================================================================
    
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
    
    # =====================================================================
    # ÉTAPE 3 : Corriger la FK valide_par si elle existe
    # =====================================================================
    
    op.execute("""
        ALTER TABLE attestations_communautaires 
        DROP CONSTRAINT IF EXISTS attestations_communautaires_valide_par_fkey
    """)
    
    op.execute("""
        ALTER TABLE attestations_communautaires 
        ADD CONSTRAINT attestations_communautaires_valide_par_fkey
        FOREIGN KEY (valide_par) 
        REFERENCES utilisateurs(id) 
        ON DELETE SET NULL
    """)


def downgrade() -> None:
    """
    Annule les corrections (retour à l'état précédent).
    """
    
    # Supprimer les nouvelles contraintes
    op.execute("""
        ALTER TABLE attestations_communautaires 
        DROP CONSTRAINT IF EXISTS attestations_communautaires_attestant_id_fkey
    """)
    
    op.execute("""
        ALTER TABLE attestations_communautaires 
        DROP CONSTRAINT IF EXISTS attestations_communautaires_atteste_id_fkey
    """)
    
    op.execute("""
        ALTER TABLE attestations_communautaires 
        DROP CONSTRAINT IF EXISTS attestations_communautaires_valide_par_fkey
    """)
    
    # Remettre les anciennes contraintes (vers 'utilisateur')
    op.execute("""
        ALTER TABLE attestations_communautaires 
        ADD CONSTRAINT attestations_communautaires_attestant_id_fkey
        FOREIGN KEY (attestant_id) 
        REFERENCES utilisateur(id) 
        ON DELETE CASCADE
    """)
    
    op.execute("""
        ALTER TABLE attestations_communautaires 
        ADD CONSTRAINT attestations_communautaires_atteste_id_fkey
        FOREIGN KEY (atteste_id) 
        REFERENCES utilisateur(id) 
        ON DELETE CASCADE
    """)