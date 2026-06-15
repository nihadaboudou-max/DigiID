# -*- coding: utf-8 -*-
"""Service métier pour le module médical."""
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles.dossier_medical import DossierMedical, Consultation, Ordonnance
from src.noyau.exceptions import ErreurRessourceIntrouvable


async def creer_dossier(
    session: AsyncSession,
    medecin_id: UUID,
    data: dict,
) -> DossierMedical:
    dossier = DossierMedical(medecin_id=medecin_id, **data)
    session.add(dossier)
    await session.commit()
    await session.refresh(dossier)
    return dossier


async def obtenir_dossiers(
    session: AsyncSession,
    medecin_id: UUID,
    statut: str | None = None,
    recherche: str | None = None,
) -> list[DossierMedical]:
    query = select(DossierMedical).where(DossierMedical.medecin_id == medecin_id)
    if statut and statut != "tous":
        query = query.where(DossierMedical.statut == statut)
    if recherche:
        query = query.where(
            DossierMedical.patient_nom.ilike(f"%{recherche}%")
            | DossierMedical.patient_digiid.ilike(f"%{recherche}%")
        )
    query = query.order_by(DossierMedical.date_creation.desc())
    result = await session.execute(query)
    return list(result.scalars().all())


async def obtenir_dossier(
    session: AsyncSession,
    dossier_id: UUID,
    medecin_id: UUID,
) -> DossierMedical:
    result = await session.execute(
        select(DossierMedical).where(
            DossierMedical.id == dossier_id,
            DossierMedical.medecin_id == medecin_id,
        )
    )
    dossier = result.scalar_one_or_none()
    if not dossier:
        raise ErreurRessourceIntrouvable(f"Dossier {dossier_id} introuvable")
    return dossier


async def modifier_dossier(
    session: AsyncSession,
    dossier_id: UUID,
    medecin_id: UUID,
    data: dict,
) -> DossierMedical:
    dossier = await obtenir_dossier(session, dossier_id, medecin_id)
    for key, value in data.items():
        if value is not None:
            setattr(dossier, key, value)
    await session.commit()
    await session.refresh(dossier)
    return dossier


async def ajouter_consultation(
    session: AsyncSession,
    medecin_id: UUID,
    data: dict,
) -> Consultation:
    consultation = Consultation(medecin_id=medecin_id, **data)
    session.add(consultation)
    await session.commit()
    await session.refresh(consultation)
    return consultation


async def obtenir_consultations(
    session: AsyncSession,
    dossier_id: UUID,
) -> list[Consultation]:
    result = await session.execute(
        select(Consultation)
        .where(Consultation.dossier_id == dossier_id)
        .order_by(Consultation.date_consultation.desc())
    )
    return list(result.scalars().all())


async def creer_ordonnance(
    session: AsyncSession,
    medecin_id: UUID,
    data: dict,
) -> Ordonnance:
    ordonnance = Ordonnance(medecin_id=medecin_id, **data)
    session.add(ordonnance)
    await session.commit()
    await session.refresh(ordonnance)
    return ordonnance


async def obtenir_ordonnances(
    session: AsyncSession,
    dossier_id: UUID,
) -> list[Ordonnance]:
    result = await session.execute(
        select(Ordonnance)
        .where(Ordonnance.dossier_id == dossier_id)
        .order_by(Ordonnance.date_prescription.desc())
    )
    return list(result.scalars().all())


async def compter_consultations(session: AsyncSession, dossier_id: UUID) -> int:
    result = await session.execute(
        select(func.count(Consultation.id)).where(Consultation.dossier_id == dossier_id)
    )
    return result.scalar() or 0


async def compter_ordonnances(session: AsyncSession, dossier_id: UUID) -> int:
    result = await session.execute(
        select(func.count(Ordonnance.id)).where(Ordonnance.dossier_id == dossier_id)
    )
    return result.scalar() or 0
