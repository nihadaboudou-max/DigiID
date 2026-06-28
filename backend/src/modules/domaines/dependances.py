# -*- coding: utf-8 -*-
"""Dépendances FastAPI pour les domaines."""
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Domaine
from src.modules.domaines.service import obtenir_domaine


async def obtenir_domaine_ou_404(
    domaine_id: UUID,
    session: AsyncSession = Depends(obtenir_session),
) -> Domaine:
    """Dépendance pour obtenir un domaine ou retourner 404."""
    return await obtenir_domaine(session, domaine_id)