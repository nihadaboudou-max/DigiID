"""Service métier pour le module Police."""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles.verification_police import VerificationPolice, SignalementFraude


async def creer_verification(session: AsyncSession, officier_id: UUID, data: dict) -> VerificationPolice:
    verification = VerificationPolice(officier_id=officier_id, **data)
    session.add(verification)
    await session.commit()
    await session.refresh(verification)
    return verification


async def obtenir_verifications(
    session: AsyncSession, officier_id: UUID
) -> list[VerificationPolice]:
    result = await session.execute(
        select(VerificationPolice)
        .where(VerificationPolice.officier_id == officier_id)
        .order_by(VerificationPolice.date_verification.desc())
    )
    return list(result.scalars().all())


async def creer_signalement(session: AsyncSession, officier_id: UUID, data: dict) -> SignalementFraude:
    signalement = SignalementFraude(officier_id=officier_id, **data)
    session.add(signalement)
    await session.commit()
    await session.refresh(signalement)
    return signalement


async def obtenir_signalements(session: AsyncSession, officier_id: UUID) -> list[SignalementFraude]:
    result = await session.execute(
        select(SignalementFraude)
        .where(SignalementFraude.officier_id == officier_id)
        .order_by(SignalementFraude.date_signalement.desc())
    )
    return list(result.scalars().all())


async def rechercher_personne(session: AsyncSession, digiid: str) -> dict | None:
    """Recherche une personne par DigiID dans la base utilisateurs."""
    from src.modeles import Utilisateur
    result = await session.execute(
        select(Utilisateur).where(Utilisateur.digiid_public == digiid)
    )
    utilisateur = result.scalar_one_or_none()
    if not utilisateur:
        return None
    return {
        "digiid": utilisateur.digiid_public,
        "nom": f"{utilisateur.prenom or ''} {utilisateur.nom or ''}".strip(),
        "email": utilisateur.email,
        "score": utilisateur.score_actuel,
        "est_actif": utilisateur.est_actif,
    }
