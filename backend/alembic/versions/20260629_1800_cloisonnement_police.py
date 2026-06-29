"""ajout cloisonnement police

Revision ID: 20260629_1800
Revises: 20260629_1700
Create Date: 2026-06-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '20260629_1800'
down_revision = '20260629_1700'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Table alertes_police
    op.add_column('alertes_police', sa.Column('domaine_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('alertes_police', sa.Column('departement_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index('ix_alertes_police_domaine', 'alertes_police', ['domaine_id'])
    op.create_index('ix_alertes_police_departement', 'alertes_police', ['departement_id'])
    op.create_foreign_key('fk_alertes_police_domaine', 'alertes_police', 'domaines', ['domaine_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_alertes_police_departement', 'alertes_police', 'departements', ['departement_id'], ['id'], ondelete='SET NULL')
    
    # Table notes_internes
    op.add_column('notes_internes', sa.Column('domaine_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('notes_internes', sa.Column('departement_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index('ix_notes_internes_domaine', 'notes_internes', ['domaine_id'])
    op.create_index('ix_notes_internes_departement', 'notes_internes', ['departement_id'])
    op.create_foreign_key('fk_notes_internes_domaine', 'notes_internes', 'domaines', ['domaine_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_notes_internes_departement', 'notes_internes', 'departements', ['departement_id'], ['id'], ondelete='SET NULL')
    
    # Table historique_recherches_police
    op.add_column('historique_recherches_police', sa.Column('domaine_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('historique_recherches_police', sa.Column('departement_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index('ix_historique_recherches_police_domaine', 'historique_recherches_police', ['domaine_id'])
    op.create_index('ix_historique_recherches_police_departement', 'historique_recherches_police', ['departement_id'])
    op.create_foreign_key('fk_historique_recherches_police_domaine', 'historique_recherches_police', 'domaines', ['domaine_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_historique_recherches_police_departement', 'historique_recherches_police', 'departements', ['departement_id'], ['id'], ondelete='SET NULL')
    
    # Table enrolements_police
    op.add_column('enrolements_police', sa.Column('domaine_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('enrolements_police', sa.Column('departement_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index('ix_enrolements_police_domaine', 'enrolements_police', ['domaine_id'])
    op.create_index('ix_enrolements_police_departement', 'enrolements_police', ['departement_id'])
    op.create_foreign_key('fk_enrolements_police_domaine', 'enrolements_police', 'domaines', ['domaine_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_enrolements_police_departement', 'enrolements_police', 'departements', ['departement_id'], ['id'], ondelete='SET NULL')
    
    # Table verifications_police
    op.add_column('verifications_police', sa.Column('domaine_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('verifications_police', sa.Column('departement_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index('ix_verifications_police_domaine', 'verifications_police', ['domaine_id'])
    op.create_index('ix_verifications_police_departement', 'verifications_police', ['departement_id'])
    op.create_foreign_key('fk_verifications_police_domaine', 'verifications_police', 'domaines', ['domaine_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_verifications_police_departement', 'verifications_police', 'departements', ['departement_id'], ['id'], ondelete='SET NULL')
    
    # Table signalements_fraude
    op.add_column('signalements_fraude', sa.Column('domaine_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('signalements_fraude', sa.Column('departement_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index('ix_signalements_fraude_domaine', 'signalements_fraude', ['domaine_id'])
    op.create_index('ix_signalements_fraude_departement', 'signalements_fraude', ['departement_id'])
    op.create_foreign_key('fk_signalements_fraude_domaine', 'signalements_fraude', 'domaines', ['domaine_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_signalements_fraude_departement', 'signalements_fraude', 'departements', ['departement_id'], ['id'], ondelete='SET NULL')

def downgrade() -> None:
    # signalements_fraude
    op.drop_constraint('fk_signalements_fraude_departement', 'signalements_fraude', type_='foreignkey')
    op.drop_constraint('fk_signalements_fraude_domaine', 'signalements_fraude', type_='foreignkey')
    op.drop_index('ix_signalements_fraude_departement', table_name='signalements_fraude')
    op.drop_index('ix_signalements_fraude_domaine', table_name='signalements_fraude')
    op.drop_column('signalements_fraude', 'departement_id')
    op.drop_column('signalements_fraude', 'domaine_id')
    
    # verifications_police
    op.drop_constraint('fk_verifications_police_departement', 'verifications_police', type_='foreignkey')
    op.drop_constraint('fk_verifications_police_domaine', 'verifications_police', type_='foreignkey')
    op.drop_index('ix_verifications_police_departement', table_name='verifications_police')
    op.drop_index('ix_verifications_police_domaine', table_name='verifications_police')
    op.drop_column('verifications_police', 'departement_id')
    op.drop_column('verifications_police', 'domaine_id')
    
    # enrolements_police
    op.drop_constraint('fk_enrolements_police_departement', 'enrolements_police', type_='foreignkey')
    op.drop_constraint('fk_enrolements_police_domaine', 'enrolements_police', type_='foreignkey')
    op.drop_index('ix_enrolements_police_departement', table_name='enrolements_police')
    op.drop_index('ix_enrolements_police_domaine', table_name='enrolements_police')
    op.drop_column('enrolements_police', 'departement_id')
    op.drop_column('enrolements_police', 'domaine_id')
    
    # historique_recherches_police
    op.drop_constraint('fk_historique_recherches_police_departement', 'historique_recherches_police', type_='foreignkey')
    op.drop_constraint('fk_historique_recherches_police_domaine', 'historique_recherches_police', type_='foreignkey')
    op.drop_index('ix_historique_recherches_police_departement', table_name='historique_recherches_police')
    op.drop_index('ix_historique_recherches_police_domaine', table_name='historique_recherches_police')
    op.drop_column('historique_recherches_police', 'departement_id')
    op.drop_column('historique_recherches_police', 'domaine_id')
    
    # notes_internes
    op.drop_constraint('fk_notes_internes_departement', 'notes_internes', type_='foreignkey')
    op.drop_constraint('fk_notes_internes_domaine', 'notes_internes', type_='foreignkey')
    op.drop_index('ix_notes_internes_departement', table_name='notes_internes')
    op.drop_index('ix_notes_internes_domaine', table_name='notes_internes')
    op.drop_column('notes_internes', 'departement_id')
    op.drop_column('notes_internes', 'domaine_id')
    
    # alertes_police
    op.drop_constraint('fk_alertes_police_departement', 'alertes_police', type_='foreignkey')
    op.drop_constraint('fk_alertes_police_domaine', 'alertes_police', type_='foreignkey')
    op.drop_index('ix_alertes_police_departement', table_name='alertes_police')
    op.drop_index('ix_alertes_police_domaine', table_name='alertes_police')
    op.drop_column('alertes_police', 'departement_id')
    op.drop_column('alertes_police', 'domaine_id')