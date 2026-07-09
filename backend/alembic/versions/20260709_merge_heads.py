# -*- coding: utf-8 -*-
"""Merge multiple heads into one.

Revision ID: 20260709_merge
Revises: 20260105_001, 20260702_1300
Create Date: 2026-07-09 01:00:00.000000
"""
from typing import Sequence
from alembic import op


revision: str = "20260709_merge"
down_revision: tuple[str, ...] = ("20260105_001", "20260702_1300")
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Merge - no schema changes."""
    pass


def downgrade() -> None:
    """Merge - no schema changes."""
    pass