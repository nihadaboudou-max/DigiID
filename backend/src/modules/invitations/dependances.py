# -*- coding: utf-8 -*-
"""Dépendances FastAPI pour les invitations."""
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles.invitation import Invitation
from src.modules.invitations.service import obtenir_invitation_par_id


async def obtenir_invitation_ou_404(
    invitation_id: UUID,
    session: AsyncSession = Depends(obtenir_session),
) -> Invitation:
    """Dépendance pour obtenir une invitation ou retourner 404."""
    invitation = await obtenir_invitation_par_id(session, invitation_id)
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation introuvable",
        )
    return invitation