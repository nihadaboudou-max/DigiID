# -*- coding: utf-8 -*-
"""Dépendances FastAPI du module logistique (get-or-404)."""
from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Gare, Ligne, Vehicule, Voyage, ActeurLogistique
from src.modules.logistique import service


async def obtenir_gare_ou_404(
    gare_id: UUID, session: AsyncSession = Depends(obtenir_session)
) -> Gare:
    return await service.obtenir_gare(session, gare_id)


async def obtenir_ligne_ou_404(
    ligne_id: UUID, session: AsyncSession = Depends(obtenir_session)
) -> Ligne:
    return await service.obtenir_ligne(session, ligne_id)


async def obtenir_vehicule_ou_404(
    vehicule_id: UUID, session: AsyncSession = Depends(obtenir_session)
) -> Vehicule:
    return await service.obtenir_vehicule(session, vehicule_id)


async def obtenir_voyage_ou_404(
    voyage_id: UUID, session: AsyncSession = Depends(obtenir_session)
) -> Voyage:
    return await service.obtenir_voyage(session, voyage_id)


async def obtenir_acteur_ou_404(
    acteur_id: UUID, session: AsyncSession = Depends(obtenir_session)
) -> ActeurLogistique:
    return await service.obtenir_acteur(session, acteur_id)
