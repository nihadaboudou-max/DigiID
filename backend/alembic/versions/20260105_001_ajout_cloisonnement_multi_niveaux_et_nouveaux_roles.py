"""Ajout cloisonnement multi-niveaux et nouveaux rôles

Revision ID: 20260105_001
Revises: 
Create Date: 2026-01-05 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260105_001'
down_revision = None  # À modifier selon ta dernière migration
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ajouter les colonnes de cloisonnement à la table utilisateur
    op.add_column('utilisateur', sa.Column('domaine_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('utilisateur', sa.Column('departement_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('utilisateur', sa.Column('est_chef_departement', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('utilisateur', sa.Column('superieur_id', postgresql.UUID(as_uuid=True), nullable=True))
    
    # Créer les index
    op.create_index('ix_utilisateur_domaine', 'utilisateur', ['domaine_id'], unique=False)
    op.create_index('ix_utilisateur_departement', 'utilisateur', ['departement_id'], unique=False)
    op.create_index('ix_utilisateur_chef', 'utilisateur', ['est_chef_departement'], unique=False)
    
    # Ajouter les contraintes de clé étrangère
    op.create_foreign_key(
        'fk_utilisateur_domaine',
        'utilisateur', 'domaines',
        ['domaine_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_foreign_key(
        'fk_utilisateur_departement',
        'utilisateur', 'departements',
        ['departement_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_foreign_key(
        'fk_utilisateur_superieur',
        'utilisateur', 'utilisateur',
        ['superieur_id'], ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    # Supprimer les contraintes
    op.drop_constraint('fk_utilisateur_superieur', 'utilisateur', type_='foreignkey')
    op.drop_constraint('fk_utilisateur_departement', 'utilisateur', type_='foreignkey')
    op.drop_constraint('fk_utilisateur_domaine', 'utilisateur', type_='foreignkey')
    
    # Supprimer les index
    op.drop_index('ix_utilisateur_chef', table_name='utilisateur')
    op.drop_index('ix_utilisateur_departement', table_name='utilisateur')
    op.drop_index('ix_utilisateur_domaine', table_name='utilisateur')
    
    # Supprimer les colonnes
    op.drop_column('utilisateur', 'superieur_id')
    op.drop_column('utilisateur', 'est_chef_departement')
    op.drop_column('utilisateur', 'departement_id')
    op.drop_column('utilisateur', 'domaine_id')