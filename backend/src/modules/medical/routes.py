# -*- coding: utf-8 -*-
"""Routes API pour le module médical — réservé aux médecins."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.config.constantes import PREFIXE_API_UTILISATEUR
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.noyau import dechiffrer_donnee
from src.modules.medical.schemas import (
    ConsultationCreate,
    ConsultationResponse,
    DossierMedicalCreate,
    DossierMedicalResponse,
    DossierMedicalUpdate,
    OrdonnanceCreate,
    OrdonnanceResponse,
    VerificationDigiIDResponse,
)
from src.modules.medical import service as medical_service

routeur_medical = APIRouter(prefix=f"{PREFIXE_API_UTILISATEUR}/medical", tags=["Médical"])


@routeur_medical.get("/verifier-patient/{digiid}", response_model=VerificationDigiIDResponse)
async def verifier_patient(
    digiid: str,
    medecin: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Vérifie qu'un DigiID correspond à un citoyen existant."""
    utilisateur = await medical_service.verifier_digiid(session, digiid)
    if utilisateur:
        nom = dechiffrer_donnee(utilisateur.nom_chiffre) if utilisateur.nom_chiffre else None
        prenom = dechiffrer_donnee(utilisateur.prenom_chiffre) if utilisateur.prenom_chiffre else None
        email = dechiffrer_donnee(utilisateur.email_chiffre)
        return VerificationDigiIDResponse(
            trouvé=True,
            digiid=utilisateur.digiid_public,
            nom=nom,
            prenom=prenom,
            email=email,
        )
    return VerificationDigiIDResponse(trouvé=False, digiid=digiid, nom=None, prenom=None, email=None)


@routeur_medical.get("/dossiers", response_model=list[DossierMedicalResponse])
async def lister_dossiers(
    medecin: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    statut: str = Query("tous", description="Filtrer par statut"),
    recherche: str = Query("", description="Recherche par nom ou DigiID"),
):
    dossiers = await medical_service.obtenir_dossiers(session, medecin.id, statut, recherche or None)
    result = []
    for d in dossiers:
        result.append(DossierMedicalResponse(
            id=d.id,
            medecin_id=d.medecin_id,
            patient_nom=d.patient_nom,
            patient_digiid=d.patient_digiid,
            patient_date_naissance=d.patient_date_naissance,
            motif=d.motif,
            diagnostic=d.diagnostic,
            statut=d.statut,
            consultations_count=await medical_service.compter_consultations(session, d.id),
            ordonnances_count=await medical_service.compter_ordonnances(session, d.id),
            date_creation=d.date_creation,
            date_modification=d.date_modification,
        ))
    return result


@routeur_medical.post("/dossiers", response_model=DossierMedicalResponse, status_code=201)
async def creer_dossier(
    data: DossierMedicalCreate,
    medecin: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    dossier = await medical_service.creer_dossier(session, medecin.id, data.model_dump())
    return DossierMedicalResponse(
        id=dossier.id,
        medecin_id=dossier.medecin_id,
        patient_nom=dossier.patient_nom,
        patient_digiid=dossier.patient_digiid,
        patient_date_naissance=dossier.patient_date_naissance,
        motif=dossier.motif,
        diagnostic=dossier.diagnostic,
        statut=dossier.statut,
        consultations_count=0,
        ordonnances_count=0,
        date_creation=dossier.date_creation,
        date_modification=dossier.date_modification,
    )


@routeur_medical.get("/dossiers/{dossier_id}", response_model=DossierMedicalResponse)
async def obtenir_dossier(
    dossier_id: UUID,
    medecin: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    dossier = await medical_service.obtenir_dossier(session, dossier_id, medecin.id)
    consultations = await medical_service.obtenir_consultations(session, dossier_id)
    ordonnances = await medical_service.obtenir_ordonnances(session, dossier_id)
    return DossierMedicalResponse(
        id=dossier.id,
        medecin_id=dossier.medecin_id,
        patient_nom=dossier.patient_nom,
        patient_digiid=dossier.patient_digiid,
        patient_date_naissance=dossier.patient_date_naissance,
        motif=dossier.motif,
        diagnostic=dossier.diagnostic,
        statut=dossier.statut,
        consultations_count=len(consultations),
        ordonnances_count=len(ordonnances),
        date_creation=dossier.date_creation,
        date_modification=dossier.date_modification,
    )


@routeur_medical.patch("/dossiers/{dossier_id}", response_model=DossierMedicalResponse)
async def modifier_dossier(
    dossier_id: UUID,
    data: DossierMedicalUpdate,
    medecin: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    dossier = await medical_service.modifier_dossier(session, dossier_id, medecin.id, data.model_dump(exclude_none=True))
    return DossierMedicalResponse(
        id=dossier.id,
        medecin_id=dossier.medecin_id,
        patient_nom=dossier.patient_nom,
        patient_digiid=dossier.patient_digiid,
        patient_date_naissance=dossier.patient_date_naissance,
        motif=dossier.motif,
        diagnostic=dossier.diagnostic,
        statut=dossier.statut,
        consultations_count=await medical_service.compter_consultations(session, dossier.id),
        ordonnances_count=await medical_service.compter_ordonnances(session, dossier.id),
        date_creation=dossier.date_creation,
        date_modification=dossier.date_modification,
    )


@routeur_medical.get("/dossiers/{dossier_id}/consultations", response_model=list[ConsultationResponse])
async def lister_consultations(
    dossier_id: UUID,
    medecin: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    consultations = await medical_service.obtenir_consultations(session, dossier_id)
    return [
        ConsultationResponse(
            id=c.id,
            dossier_id=c.dossier_id,
            medecin_id=c.medecin_id,
            motif=c.motif,
            observations=c.observations,
            diagnostic=c.diagnostic,
            date_consultation=c.date_consultation,
        )
        for c in consultations
    ]


@routeur_medical.post("/consultations", response_model=ConsultationResponse, status_code=201)
async def ajouter_consultation(
    data: ConsultationCreate,
    medecin: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    consultation = await medical_service.ajouter_consultation(session, medecin.id, data.model_dump())
    return ConsultationResponse(
        id=consultation.id,
        dossier_id=consultation.dossier_id,
        medecin_id=consultation.medecin_id,
        motif=consultation.motif,
        observations=consultation.observations,
        diagnostic=consultation.diagnostic,
        date_consultation=consultation.date_consultation,
    )


@routeur_medical.get("/ordonnances", response_model=list[OrdonnanceResponse])
async def lister_toutes_ordonnances(
    medecin: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Liste toutes les ordonnances du médecin connecté, triées par date."""
    ordonnances = await medical_service.obtenir_toutes_ordonnances(session, medecin.id)
    return [
        OrdonnanceResponse(
            id=o.id,
            dossier_id=o.dossier_id,
            medecin_id=o.medecin_id,
            medicaments=o.medicaments,
            instructions=o.instructions,
            date_prescription=o.date_prescription,
            date_expiration=o.date_expiration,
        )
        for o in ordonnances
    ]


@routeur_medical.get("/dossiers/{dossier_id}/ordonnances", response_model=list[OrdonnanceResponse])
async def lister_ordonnances(
    dossier_id: UUID,
    medecin: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    ordonnances = await medical_service.obtenir_ordonnances(session, dossier_id)
    return [
        OrdonnanceResponse(
            id=o.id,
            dossier_id=o.dossier_id,
            medecin_id=o.medecin_id,
            medicaments=o.medicaments,
            instructions=o.instructions,
            date_prescription=o.date_prescription,
            date_expiration=o.date_expiration,
        )
        for o in ordonnances
    ]


@routeur_medical.post("/ordonnances", response_model=OrdonnanceResponse, status_code=201)
async def creer_ordonnance(
    data: OrdonnanceCreate,
    medecin: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    ordonnance = await medical_service.creer_ordonnance(session, medecin.id, data.model_dump())
    return OrdonnanceResponse(
        id=ordonnance.id,
        dossier_id=ordonnance.dossier_id,
        medecin_id=ordonnance.medecin_id,
        medicaments=ordonnance.medicaments,
        instructions=ordonnance.instructions,
        date_prescription=ordonnance.date_prescription,
        date_expiration=ordonnance.date_expiration,
    )
