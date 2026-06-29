# -*- coding: utf-8 -*-
"""Routes API pour le module ONG — avec cloisonnement."""
from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.ong.schemas import (
    BeneficiaireCreate, BeneficiaireResponse,
    ProgrammeCreate, ProgrammeResponse,
    MissionCreate, MissionResponse,
    StatsONGResponse,
)
from src.noyau.journal import enregistrer_evenement_audit
from src.modules.ong import service

# Préfixe cohérent avec les autres modules
routeur_ong = APIRouter(prefix="/api/v1/ong", tags=["ONG"])


@routeur_ong.get("/beneficiaires", response_model=list[BeneficiaireResponse])
async def lister_beneficiaires(
    ong: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Liste les bénéficiaires avec cloisonnement."""
    beneficiaires = await service.obtenir_beneficiaires(session, ong)
    return [
        BeneficiaireResponse(
            id=b.id, ong_id=b.ong_id, nom=b.nom, digiid=b.digiid,
            programme=b.programme, zone=b.zone,
            date_inscription=b.date_inscription, statut=b.statut, notes=b.notes,
            domaine_id=b.domaine_id, departement_id=b.departement_id,
        )
        for b in beneficiaires
    ]


@routeur_ong.post("/beneficiaires", response_model=BeneficiaireResponse, status_code=201)
async def creer_beneficiaire(
    data: BeneficiaireCreate,
    ong: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Crée un bénéficiaire avec cloisonnement automatique."""
    b = await service.creer_beneficiaire(session, ong, data.model_dump())
    await enregistrer_evenement_audit(
        session=session,
        type_evenement="ong_beneficiaire_creation",
        description=f"Bénéficiaire {data.nom} créé (programme: {data.programme})",
        utilisateur_id=ong.id,
        role_acteur=ong.role,
    )
    return BeneficiaireResponse(
        id=b.id, ong_id=b.ong_id, nom=b.nom, digiid=b.digiid,
        programme=b.programme, zone=b.zone,
        date_inscription=b.date_inscription, statut=b.statut, notes=b.notes,
        domaine_id=b.domaine_id, departement_id=b.departement_id,
    )


@routeur_ong.get("/programmes", response_model=list[ProgrammeResponse])
async def lister_programmes(
    ong: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Liste les programmes avec cloisonnement."""
    programmes = await service.obtenir_programmes(session, ong)
    return [
        ProgrammeResponse(
            id=p.id, ong_id=p.ong_id, nom=p.nom, description=p.description,
            zone=p.zone, budget=p.budget, date_debut=p.date_debut,
            date_fin=p.date_fin, statut=p.statut,
            domaine_id=p.domaine_id, departement_id=p.departement_id,
        )
        for p in programmes
    ]


@routeur_ong.post("/programmes", response_model=ProgrammeResponse, status_code=201)
async def creer_programme(
    data: ProgrammeCreate,
    ong: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Crée un programme avec cloisonnement automatique."""
    p = await service.creer_programme(session, ong, data.model_dump())
    await enregistrer_evenement_audit(
        session=session,
        type_evenement="ong_programme_creation",
        description=f"Programme {data.nom} créé (zone: {data.zone})",
        utilisateur_id=ong.id,
        role_acteur=ong.role,
    )
    return ProgrammeResponse(
        id=p.id, ong_id=p.ong_id, nom=p.nom, description=p.description,
        zone=p.zone, budget=p.budget, date_debut=p.date_debut,
        date_fin=p.date_fin, statut=p.statut,
        domaine_id=p.domaine_id, departement_id=p.departement_id,
    )


@routeur_ong.get("/missions", response_model=list[MissionResponse])
async def lister_missions(
    ong: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Liste les missions avec cloisonnement."""
    missions = await service.obtenir_missions(session, ong)
    return [
        MissionResponse(
            id=m.id, ong_id=m.ong_id, programme_id=m.programme_id,
            titre=m.titre, zone=m.zone, date_depart=m.date_depart,
            date_retour=m.date_retour, objectifs=m.objectifs, statut=m.statut,
            domaine_id=m.domaine_id, departement_id=m.departement_id,
        )
        for m in missions
    ]


@routeur_ong.post("/missions", response_model=MissionResponse, status_code=201)
async def creer_mission(
    data: MissionCreate,
    ong: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Crée une mission avec cloisonnement automatique."""
    m = await service.creer_mission(session, ong, data.model_dump())
    await enregistrer_evenement_audit(
        session=session,
        type_evenement="ong_mission_creation",
        description=f"Mission {data.titre} créée (zone: {data.zone})",
        utilisateur_id=ong.id,
        role_acteur=ong.role,
    )
    return MissionResponse(
        id=m.id, ong_id=m.ong_id, programme_id=m.programme_id,
        titre=m.titre, zone=m.zone, date_depart=m.date_depart,
        date_retour=m.date_retour, objectifs=m.objectifs, statut=m.statut,
        domaine_id=m.domaine_id, departement_id=m.departement_id,
    )


@routeur_ong.get("/stats", response_model=StatsONGResponse)
async def stats_ong(
    ong: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Statistiques du module ONG avec cloisonnement."""
    nb_beneficiaires = await service.compter_beneficiaires(session, ong)
    programmes = await service.obtenir_programmes(session, ong)
    missions = await service.obtenir_missions(session, ong)
    return StatsONGResponse(
        nb_beneficiaires=nb_beneficiaires,
        nb_programmes=len(programmes),
        nb_missions=len(missions),
        zones=list(set(p.zone for p in programmes if p.zone)),
    )