# -*- coding: utf-8 -*-
"""Agrandir la taille des colonnes MRZ de verification_cni

Revision ID: 20260702_1300
Revises: 20260629_1800
Create Date: 2026-07-02 13:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = '20260702_1300'
down_revision = '20260629_1800'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Agrandir les colonnes MRZ de 30 à 100 caractères
    # Les MRZ ICAO TD1 font 30 caractères mais peuvent avoir des espaces supplémentaires
    op.alter_column(
        'verification_cni', 'mrz_ligne_1',
        type_=sa.String(100),
        existing_type=sa.String(30),
        existing_nullable=True,
    )
    op.alter_column(
        'verification_cni', 'mrz_ligne_2',
        type_=sa.String(100),
        existing_type=sa.String(30),
        existing_nullable=True,
    )
    op.alter_column(
        'verification_cni', 'mrz_ligne_3',
        type_=sa.String(100),
        existing_type=sa.String(30),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        'verification_cni', 'mrz_ligne_1',
        type_=sa.String(30),
        existing_type=sa.String(100),
        existing_nullable=True,
    )
    op.alter_column(
        'verification_cni', 'mrz_ligne_2',
        type_=sa.String(30),
        existing_type=sa.String(100),
        existing_nullable=True,
    )
    op.alter_column(
        'verification_cni', 'mrz_ligne_3',
        type_=sa.String(30),
        existing_type=sa.String(100),
        existing_nullable=True,
    )