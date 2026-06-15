"""Service métier pour l'enrôlement citoyen."""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles.enrolement import Enrolement


async def creer_enrolement(session: AsyncSession, agent_id: UUID, data: dict) -> Enrolement:
    enrolement = Enrolement(agent_id=agent_id, **data)
    session.add(enrolement)
    await session.commit()
    await session.refresh(enrolement)
    return enrolement


async def obtenir_enrolements(
    session: AsyncSession, agent_id: UUID, statut: str | None = None
) -> list[Enrolement]:
    query = select(Enrolement).where(Enrolement.agent_id == agent_id)
    if statut and statut != "tous":
        query = query.where(Enrolement.statut == statut)
    query = query.order_by(Enrolement.date_enrolement.desc())
    result = await session.execute(query)
    return list(result.scalars().all())


async def obtenir_enrolement(session: AsyncSession, enrolement_id: UUID) -> Enrolement | None:
    result = await session.execute(select(Enrolement).where(Enrolement.id == enrolement_id))
    return result.scalar_one_or_none()


async def mettre_a_jour_enrolement(
    session: AsyncSession, enrolement_id: UUID, data: dict
) -> Enrolement | None:
    enrolement = await obtenir_enrolement(session, enrolement_id)
    if not enrolement:
        return None
    for key, value in data.items():
        if value is not None:
            setattr(enrolement, key, value)
    await session.commit()
    await session.refresh(enrolement)
    return enrolement
