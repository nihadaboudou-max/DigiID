# -*- coding: utf-8 -*-
"""Service métier pour le module médical."""
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles.dossier_medical import DossierMedical, Consultation, Ordonnance
from src.modeles import Utilisateur
from datetime import datetime

from src.noyau.exceptions import ErreurRessourceIntrouvable, ErreurValidation
from src.noyau import dechiffrer_donnee


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


async def _generer_numero_ordonnance(session: AsyncSession) -> str:
    """Génère un numéro d'ordonnance unique: ORD-2024-000001"""
    result = await session.execute(
        select(func.max(Ordonnance.numero_ordonnance)).where(
            Ordonnance.numero_ordonnance.isnot(None)
        )
    )
    dernier = result.scalar()
    annee = str(datetime.utcnow().year)
    if dernier and dernier.startswith(f"ORD-{annee}-"):
        try:
            dernier_num = int(dernier.split("-")[-1])
            nouveau_num = dernier_num + 1
        except (IndexError, ValueError):
            nouveau_num = 1
    else:
        nouveau_num = 1
    return f"ORD-{annee}-{nouveau_num:06d}"


async def creer_ordonnance(
    session: AsyncSession,
    medecin_id: UUID,
    data: dict,
    medecin_nom: str | None = None,
) -> Ordonnance:
    numero = await _generer_numero_ordonnance(session)
    data["numero_ordonnance"] = numero
    data["medecin_nom"] = medecin_nom or "Médecin"
    data["statut"] = "active"
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


async def obtenir_ordonnance_par_numero(
    session: AsyncSession,
    numero: str,
) -> Ordonnance | None:
    """Recherche une ordonnance par son numéro unique."""
    result = await session.execute(
        select(Ordonnance).where(Ordonnance.numero_ordonnance == numero)
    )
    return result.scalar_one_or_none()


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


async def obtenir_dossiers_par_digiid(
    session: AsyncSession,
    digiid: str,
) -> list[DossierMedical]:
    """Liste tous les dossiers médicaux d'un patient par son DigiID."""
    result = await session.execute(
        select(DossierMedical)
        .where(DossierMedical.patient_digiid == digiid)
        .order_by(DossierMedical.date_creation.desc())
    )
    return list(result.scalars().all())


async def _obtenir_ordonnance(
    session: AsyncSession,
    ordonnance_id: UUID,
    medecin_id: UUID,
) -> Ordonnance:
    """Récupère une ordonnance et vérifie qu'elle appartient au médecin."""
    result = await session.execute(
        select(Ordonnance).where(
            Ordonnance.id == ordonnance_id,
            Ordonnance.medecin_id == medecin_id,
        )
    )
    ordonnance = result.scalar_one_or_none()
    if not ordonnance:
        raise ErreurRessourceIntrouvable(f"Ordonnance {ordonnance_id} introuvable ou ne vous appartient pas")
    return ordonnance


async def modifier_ordonnance(
    session: AsyncSession,
    ordonnance_id: UUID,
    medecin_id: UUID,
    data: dict,
) -> Ordonnance:
    """Modifie une ordonnance existante si elle appartient au médecin."""
    ordonnance = await _obtenir_ordonnance(session, ordonnance_id, medecin_id)
    for key, value in data.items():
        if value is not None:
            setattr(ordonnance, key, value)
    await session.commit()
    await session.refresh(ordonnance)
    return ordonnance


async def supprimer_ordonnance(
    session: AsyncSession,
    ordonnance_id: UUID,
    medecin_id: UUID,
) -> None:
    """Supprime une ordonnance si elle appartient au médecin."""
    ordonnance = await _obtenir_ordonnance(session, ordonnance_id, medecin_id)
    await session.delete(ordonnance)
    await session.commit()


async def obtenir_ordonnances_par_digiid(
    session: AsyncSession,
    digiid: str,
) -> list[Ordonnance]:
    """Liste toutes les ordonnances d'un patient via ses dossiers."""
    dossiers = await obtenir_dossiers_par_digiid(session, digiid)
    if not dossiers:
        return []
    dossier_ids = [d.id for d in dossiers]
    result = await session.execute(
        select(Ordonnance)
        .where(Ordonnance.dossier_id.in_(dossier_ids))
        .order_by(Ordonnance.date_prescription.desc())
    )
    return list(result.scalars().all())


async def obtenir_medecin_ordonnance(
    session: AsyncSession,
    ordonnance_id: UUID,
) -> tuple[Ordonnance, Utilisateur] | None:
    """Récupère une ordonnance avec les infos du médecin."""
    result = await session.execute(
        select(Ordonnance, Utilisateur)
        .join(Utilisateur, Ordonnance.medecin_id == Utilisateur.id)
        .where(Ordonnance.id == ordonnance_id)
    )
    row = result.one_or_none()
    if not row:
        return None
    return row[0], row[1]


async def verifier_patient_ordonnance(
    session: AsyncSession,
    ordonnance_id: UUID,
    patient_digiid: str,
) -> bool:
    """Vérifie qu'une ordonnance appartient bien à un patient via ses dossiers."""
    result = await session.execute(
        select(Ordonnance)
        .join(DossierMedical, Ordonnance.dossier_id == DossierMedical.id)
        .where(
            Ordonnance.id == ordonnance_id,
            DossierMedical.patient_digiid == patient_digiid,
        )
    )
    return result.scalar_one_or_none() is not None
