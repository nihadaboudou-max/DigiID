# -*- coding: utf-8 -*-
"""Service métier pour le module médical."""
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles.dossier_medical import DossierMedical, Consultation, Ordonnance
from src.modeles import Utilisateur
from src.noyau.exceptions import ErreurRessourceIntrouvable, ErreurValidation


async def verifier_digiid(session: AsyncSession, digiid: str) -> Utilisateur | None:
    """Recherche un utilisateur par son DigiID public."""
    result = await session.execute(
        select(Utilisateur).where(
            Utilisateur.digiid_public == digiid,
            Utilisateur.est_supprime == False,
        )
    )
    return result.scalar_one_or_none()


async def _verifier_digiid_existe(session: AsyncSession, digiid: str) -> Utilisateur:
    """Vérifie qu'un DigiID public correspond à un utilisateur existant."""
    utilisateur = await verifier_digiid(session, digiid)
    if not utilisateur:
        raise ErreurValidation(
            f"DigiID '{digiid}' introuvable",
            message_utilisateur=f"Aucun citoyen trouvé avec le DigiID '{digiid}'. Vérifie l'identifiant.",
        )
    return utilisateur


async def creer_dossier(
    session: AsyncSession,
    medecin_id: UUID,
    data: dict,
) -> DossierMedical:
    # Vérifier que le DigiID du patient existe dans le système
    await _verifier_digiid_existe(session, data["patient_digiid"])

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


async def obtenir_toutes_ordonnances(
    session: AsyncSession,
    medecin_id: UUID,
) -> list[Ordonnance]:
    """Liste toutes les ordonnances prescrites par un médecin, triées par date décroissante."""
    result = await session.execute(
        select(Ordonnance)
        .where(Ordonnance.medecin_id == medecin_id)
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
