"""Routes API pour le module ONG."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.config.constantes import PREFIXE_API_UTILISATEUR
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.ong.schemas import (
    BeneficiaireCreate, BeneficiaireResponse,
    ProgrammeCreate, ProgrammeResponse,
    MissionCreate, MissionResponse,
)
from src.modules.ong import service

routeur_ong = APIRouter(prefix=f"{PREFIXE_API_UTILISATEUR}/ong", tags=["ONG"])


@routeur_ong.get("/beneficiaires", response_model=list[BeneficiaireResponse])
async def lister_beneficiaires(
    ong: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    beneficiaires = await service.obtenir_beneficiaires(session, ong.id)
    return [
        BeneficiaireResponse(
            id=b.id, ong_id=b.ong_id, nom=b.nom, digiid=b.digiid,
            programme=b.programme, zone=b.zone,
            date_inscription=b.date_inscription, statut=b.statut, notes=b.notes,
        )
        for b in beneficiaires
    ]


@routeur_ong.post("/beneficiaires", response_model=BeneficiaireResponse, status_code=201)
async def creer_beneficiaire(
    data: BeneficiaireCreate,
    ong: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    b = await service.creer_beneficiaire(session, ong.id, data.model_dump())
    return BeneficiaireResponse(
        id=b.id, ong_id=b.ong_id, nom=b.nom, digiid=b.digiid,
        programme=b.programme, zone=b.zone,
        date_inscription=b.date_inscription, statut=b.statut, notes=b.notes,
    )


@routeur_ong.get("/programmes", response_model=list[ProgrammeResponse])
async def lister_programmes(
    ong: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    programmes = await service.obtenir_programmes(session, ong.id)
    return [
        ProgrammeResponse(
            id=p.id, ong_id=p.ong_id, nom=p.nom, description=p.description,
            zone=p.zone, budget=p.budget, date_debut=p.date_debut,
            date_fin=p.date_fin, statut=p.statut,
        )
        for p in programmes
    ]


@routeur_ong.post("/programmes", response_model=ProgrammeResponse, status_code=201)
async def creer_programme(
    data: ProgrammeCreate,
    ong: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    p = await service.creer_programme(session, ong.id, data.model_dump())
    return ProgrammeResponse(
        id=p.id, ong_id=p.ong_id, nom=p.nom, description=p.description,
        zone=p.zone, budget=p.budget, date_debut=p.date_debut,
        date_fin=p.date_fin, statut=p.statut,
    )


@routeur_ong.get("/missions", response_model=list[MissionResponse])
async def lister_missions(
    ong: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    missions = await service.obtenir_missions(session, ong.id)
    return [
        MissionResponse(
            id=m.id, ong_id=m.ong_id, programme_id=m.programme_id,
            titre=m.titre, zone=m.zone, date_depart=m.date_depart,
            date_retour=m.date_retour, objectifs=m.objectifs, statut=m.statut,
        )
        for m in missions
    ]


@routeur_ong.post("/missions", response_model=MissionResponse, status_code=201)
async def creer_mission(
    data: MissionCreate,
    ong: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    m = await service.creer_mission(session, ong.id, data.model_dump())
    return MissionResponse(
        id=m.id, ong_id=m.ong_id, programme_id=m.programme_id,
        titre=m.titre, zone=m.zone, date_depart=m.date_depart,
        date_retour=m.date_retour, objectifs=m.objectifs, statut=m.statut,
    )


@routeur_ong.get("/stats")
async def stats_ong(
    ong: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    nb_beneficiaires = await service.compter_beneficiaires(session, ong.id)
    programmes = await service.obtenir_programmes(session, ong.id)
    missions = await service.obtenir_missions(session, ong.id)
    return {
        "nb_beneficiaires": nb_beneficiaires,
        "nb_programmes": len(programmes),
        "nb_missions": len(missions),
        "zones": list(set(p.zone for p in programmes if p.zone)),
    }
