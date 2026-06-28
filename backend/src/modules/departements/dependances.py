# -*- coding: utf-8 -*-
"""Dépendances FastAPI pour les départements."""
from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Departement
from src.modules.departements.service import obtenir_departement


async def obtenir_departement_ou_404(
    departement_id: UUID,
    session: AsyncSession = Depends(obtenir_session),
) -> Departement:
    """Dépendance pour obtenir un département ou retourner 404."""
    return await obtenir_departement(session, departement_id)