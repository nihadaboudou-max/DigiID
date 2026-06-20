"""Routes API pour le module Police."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.config.constantes import PREFIXE_API_UTILISATEUR
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.police.schemas import (
    SignalementFraudeCreate,
    SignalementFraudeResponse,
    VerificationPoliceCreate,
    VerificationPoliceResponse,
)
from src.noyau.journal import enregistrer_evenement_audit
from src.modules.police import service

routeur_police = APIRouter(prefix=f"{PREFIXE_API_UTILISATEUR}/police", tags=["Police"])


@routeur_police.post("/verifier", response_model=VerificationPoliceResponse, status_code=201)
async def verifier_identite(
    data: VerificationPoliceCreate,
    officier: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    v = await service.creer_verification(session, officier.id, data.model_dump())
    await enregistrer_evenement_audit(
        session=session,
        type_evenement="police_verification_identite",
        description=f"Vérification identité {data.personne_digiid} — résultat: {data.resultat}",
        utilisateur_id=officier.id,
        role_acteur=officier.role,
    )
    return VerificationPoliceResponse(
        id=v.id, officier_id=v.officier_id, personne_digiid=v.personne_digiid,
        personne_nom=v.personne_nom, type_verification=v.type_verification,
        resultat=v.resultat, notes=v.notes,
        date_verification=v.date_verification, est_signalement_fraude=v.est_signalement_fraude,
    )


@routeur_police.get("/verifications", response_model=list[VerificationPoliceResponse])
async def lister_verifications(
    officier: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    verifications = await service.obtenir_verifications(session, officier.id)
    return [
        VerificationPoliceResponse(
            id=v.id, officier_id=v.officier_id, personne_digiid=v.personne_digiid,
            personne_nom=v.personne_nom, type_verification=v.type_verification,
            resultat=v.resultat, notes=v.notes,
            date_verification=v.date_verification, est_signalement_fraude=v.est_signalement_fraude,
        )
        for v in verifications
    ]


@routeur_police.get("/rechercher/{digiid}")
async def rechercher_personne(
    digiid: str,
    officier: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    return await service.rechercher_personne(session, digiid) or {"detail": "Personne non trouvée"}


@routeur_police.post("/signalements", response_model=SignalementFraudeResponse, status_code=201)
async def creer_signalement(
    data: SignalementFraudeCreate,
    officier: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    s = await service.creer_signalement(session, officier.id, data.model_dump())
    await enregistrer_evenement_audit(
        session=session,
        type_evenement="police_signalement_fraude",
        description=f"Signalement fraude {data.personne_digiid} — motif: {data.motif}",
        utilisateur_id=officier.id,
        role_acteur=officier.role,
    )
    return SignalementFraudeResponse(
        id=s.id, officier_id=s.officier_id, personne_digiid=s.personne_digiid,
        motif=s.motif, description=s.description, statut=s.statut,
        date_signalement=s.date_signalement, date_traitement=s.date_traitement,
    )


@routeur_police.get("/signalements", response_model=list[SignalementFraudeResponse])
async def lister_signalements(
    officier: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    signalements = await service.obtenir_signalements(session, officier.id)
    return [
        SignalementFraudeResponse(
            id=s.id, officier_id=s.officier_id, personne_digiid=s.personne_digiid,
            motif=s.motif, description=s.description, statut=s.statut,
            date_signalement=s.date_signalement, date_traitement=s.date_traitement,
        )
        for s in signalements
    ]
