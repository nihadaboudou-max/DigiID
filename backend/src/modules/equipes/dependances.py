# -*- coding: utf-8 -*-
"""Dépendances FastAPI pour les équipes."""
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles.equipe import Equipe
from src.modules.equipes.service import obtenir_equipe_par_id


async def obtenir_equipe_ou_404(
    equipe_id: UUID,
    session: AsyncSession = Depends(obtenir_session),
) -> Equipe:
    """Dépendance pour obtenir une équipe ou retourner 404."""
    equipe = await obtenir_equipe_par_id(session, equipe_id)
    if not equipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Équipe introuvable",
        )
    return equipe