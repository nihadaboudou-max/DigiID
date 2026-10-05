"""phase4 add fraude and verification tables

Revision ID: ab12cd34ef56
Revises: f2a8c1d9e5b7
Create Date: 2026-06-04 23:55:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'ab12cd34ef56'
down_revision = 'f2a8c1d9e5b7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'fraude_incident',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('utilisateur_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('utilisateur.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type_action', sa.String(length=50), nullable=False),
        sa.Column('score_risque', sa.Integer(), nullable=False),
        sa.Column('niveau', sa.String(length=30), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('adresse_ip', sa.String(length=45), nullable=True),
        sa.Column('appareil', sa.String(length=200), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('cree_le', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('modifie_le', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(op.f('ix_fraude_incident_utilisateur_id'), 'fraude_incident', ['utilisateur_id'])

    op.create_table(
        'verification_visuelle',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('utilisateur_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('utilisateur.id', ondelete='CASCADE'), nullable=False),
        sa.Column('nom_fichier', sa.String(length=255), nullable=False),
        sa.Column('type_mime', sa.String(length=100), nullable=False),
        sa.Column('taille_octets', sa.Integer(), nullable=False),
        sa.Column('statut', sa.String(length=30), nullable=False),
        sa.Column('raison', sa.Text(), nullable=True),
        sa.Column('score_liveness', sa.Float(), nullable=False, server_default=sa.text('0.0')),
        sa.Column('score_similarite', sa.Float(), nullable=True),
        sa.Column('embedding', sa.JSON(), nullable=True),
        sa.Column('doublons', sa.JSON(), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('date_verification', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cree_le', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('modifie_le', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(op.f('ix_verification_visuelle_utilisateur_id'), 'verification_visuelle', ['utilisateur_id'])


def downgrade() -> None:
    op.drop_index(op.f('ix_verification_visuelle_utilisateur_id'), table_name='verification_visuelle')
    op.drop_table('verification_visuelle')
    op.drop_index(op.f('ix_fraude_incident_utilisateur_id'), table_name='fraude_incident')
    op.drop_table('fraude_incident')
