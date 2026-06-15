"""Service métier pour le module ONG."""
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles.ong import BeneficiaireONG, ProgrammeONG, MissionTerrain


async def creer_beneficiaire(session: AsyncSession, ong_id: UUID, data: dict) -> BeneficiaireONG:
    b = BeneficiaireONG(ong_id=ong_id, **data)
    session.add(b)
    await session.commit()
    await session.refresh(b)
    return b


async def obtenir_beneficiaires(session: AsyncSession, ong_id: UUID) -> list[BeneficiaireONG]:
    result = await session.execute(
        select(BeneficiaireONG)
        .where(BeneficiaireONG.ong_id == ong_id)
        .order_by(BeneficiaireONG.date_inscription.desc())
    )
    return list(result.scalars().all())


async def compter_beneficiaires(session: AsyncSession, ong_id: UUID) -> int:
    result = await session.execute(
        select(func.count(BeneficiaireONG.id)).where(BeneficiaireONG.ong_id == ong_id)
    )
    return result.scalar() or 0


async def creer_programme(session: AsyncSession, ong_id: UUID, data: dict) -> ProgrammeONG:
    p = ProgrammeONG(ong_id=ong_id, **data)
    session.add(p)
    await session.commit()
    await session.refresh(p)
    return p


async def obtenir_programmes(session: AsyncSession, ong_id: UUID) -> list[ProgrammeONG]:
    result = await session.execute(
        select(ProgrammeONG)
        .where(ProgrammeONG.ong_id == ong_id)
        .order_by(ProgrammeONG.date_debut.desc())
    )
    return list(result.scalars().all())


async def creer_mission(session: AsyncSession, ong_id: UUID, data: dict) -> MissionTerrain:
    m = MissionTerrain(ong_id=ong_id, **data)
    session.add(m)
    await session.commit()
    await session.refresh(m)
    return m


async def obtenir_missions(session: AsyncSession, ong_id: UUID) -> list[MissionTerrain]:
    result = await session.execute(
        select(MissionTerrain)
        .where(MissionTerrain.ong_id == ong_id)
        .order_by(MissionTerrain.date_depart.desc())
    )
    return list(result.scalars().all())
