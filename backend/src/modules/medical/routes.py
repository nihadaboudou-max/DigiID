# -*- coding: utf-8 -*-
"""Routes API pour le module médical — avec cloisonnement."""
from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.noyau import dechiffrer_donnee
from src.noyau.journal import journal_audit, enregistrer_evenement_audit
from src.modules.medical.schemas import (
    ConsultationCreate, ConsultationResponse,
    DossierMedicalCreate, DossierMedicalResponse, DossierMedicalUpdate,
    OrdonnanceCreate, OrdonnanceResponse, OrdonnanceUpdate,
    SignalementCreate, VerificationDigiIDResponse, DossierCompletResponse,
)
from src.noyau.exceptions import ErreurAutorisation
from src.modules.medical import service as medical_service

routeur_medical = APIRouter(prefix="/api/v1/medical", tags=["Médical"])
# ✅ CORRECTION : Préfixe /utilisateur pour correspondre au frontend
routeur_patient = APIRouter(prefix="/api/v1/utilisateur", tags=["Patient"])

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
            trouvé=True, digiid=utilisateur.digiid_public,
            nom=nom, prenom=prenom, email=email,
        )
    return VerificationDigiIDResponse(trouvé=False, digiid=digiid, nom=None, prenom=None, email=None)

@routeur_medical.get("/dossiers", response_model=list[DossierMedicalResponse])
async def lister_dossiers(
    medecin: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    statut: str = Query("tous"),
    recherche: str = Query(""),
):
    """Liste les dossiers avec cloisonnement."""
    dossiers = await medical_service.obtenir_dossiers(session, medecin, statut, recherche or None)
    result = []
    for d in dossiers:
        result.append(DossierMedicalResponse(
            id=d.id, medecin_id=d.medecin_id,
            patient_nom=d.patient_nom, patient_prenom=d.patient_prenom,
            patient_digiid=d.patient_digiid, patient_date_naissance=d.patient_date_naissance,
            hopital=d.hopital, motif=d.motif, diagnostic=d.diagnostic, statut=d.statut,
            consultations_count=await medical_service.compter_consultations(session, d.id),
            ordonnances_count=await medical_service.compter_ordonnances(session, d.id),
            date_creation=d.date_creation, date_modification=d.date_modification,
            domaine_id=d.domaine_id, departement_id=d.departement_id,
        ))
    return result

@routeur_medical.post("/dossiers", response_model=DossierMedicalResponse, status_code=201)
async def creer_dossier(
    data: DossierMedicalCreate,
    medecin: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Crée un dossier avec cloisonnement automatique."""
    dossier = await medical_service.creer_dossier(session, medecin, data.model_dump())
    await enregistrer_evenement_audit(
        session=session, type_evenement="dossier_medical_creation",
        description=f"Création dossier pour {data.patient_nom} (DigiID: {data.patient_digiid})",
        utilisateur_id=medecin.id, role_acteur=medecin.role,
    )
    return DossierMedicalResponse(
        id=dossier.id, medecin_id=dossier.medecin_id,
        patient_nom=dossier.patient_nom, patient_prenom=dossier.patient_prenom,
        patient_digiid=dossier.patient_digiid, patient_date_naissance=dossier.patient_date_naissance,
        hopital=dossier.hopital, motif=dossier.motif, diagnostic=dossier.diagnostic, statut=dossier.statut,
        consultations_count=0, ordonnances_count=0,
        date_creation=dossier.date_creation, date_modification=dossier.date_modification,
        domaine_id=dossier.domaine_id, departement_id=dossier.departement_id,
    )

@routeur_medical.get("/dossiers/{dossier_id}", response_model=DossierMedicalResponse)
async def obtenir_dossier(
    dossier_id: UUID,
    medecin: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Récupère un dossier avec vérification de cloisonnement."""
    dossier = await medical_service.obtenir_dossier(session, dossier_id, medecin)
    consultations = await medical_service.obtenir_consultations(session, dossier_id)
    ordonnances = await medical_service.obtenir_ordonnances(session, dossier_id)
    return DossierMedicalResponse(
        id=dossier.id, medecin_id=dossier.medecin_id,
        patient_nom=dossier.patient_nom, patient_prenom=dossier.patient_prenom,
        patient_digiid=dossier.patient_digiid, patient_date_naissance=dossier.patient_date_naissance,
        hopital=dossier.hopital, motif=dossier.motif, diagnostic=dossier.diagnostic, statut=dossier.statut,
        consultations_count=len(consultations), ordonnances_count=len(ordonnances),
        date_creation=dossier.date_creation, date_modification=dossier.date_modification,
        domaine_id=dossier.domaine_id, departement_id=dossier.departement_id,
    )

@routeur_medical.patch("/dossiers/{dossier_id}", response_model=DossierMedicalResponse)
async def modifier_dossier(
    dossier_id: UUID,
    data: DossierMedicalUpdate,
    medecin: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Modifie un dossier."""
    dossier = await medical_service.modifier_dossier(session, dossier_id, medecin, data.model_dump(exclude_none=True))
    return DossierMedicalResponse(
        id=dossier.id, medecin_id=dossier.medecin_id,
        patient_nom=dossier.patient_nom, patient_prenom=dossier.patient_prenom,
        patient_digiid=dossier.patient_digiid, patient_date_naissance=dossier.patient_date_naissance,
        hopital=dossier.hopital, motif=dossier.motif, diagnostic=dossier.diagnostic, statut=dossier.statut,
        consultations_count=await medical_service.compter_consultations(session, dossier.id),
        ordonnances_count=await medical_service.compter_ordonnances(session, dossier.id),
        date_creation=dossier.date_creation, date_modification=dossier.date_modification,
        domaine_id=dossier.domaine_id, departement_id=dossier.departement_id,
    )

@routeur_medical.get("/dossiers/{dossier_id}/consultations", response_model=list[ConsultationResponse])
async def lister_consultations(
    dossier_id: UUID,
    medecin: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Liste les consultations d'un dossier."""
    consultations = await medical_service.obtenir_consultations(session, dossier_id)
    return [
        ConsultationResponse(
            id=c.id, dossier_id=c.dossier_id, medecin_id=c.medecin_id,
            hopital=c.hopital, motif=c.motif, type_consultation=c.type_consultation,
            poids=c.poids, taille=c.taille, temperature=c.temperature,
            pression_arterielle=c.pression_arterielle, observations=c.observations,
            diagnostic=c.diagnostic, conclusion=c.conclusion,
            date_controle=c.date_controle, date_consultation=c.date_consultation,
        )
        for c in consultations
    ]

@routeur_medical.post("/consultations", response_model=ConsultationResponse, status_code=201)
async def ajouter_consultation(
    data: ConsultationCreate,
    medecin: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Ajoute une consultation avec cloisonnement automatique."""
    consultation = await medical_service.ajouter_consultation(session, medecin, data.model_dump())
    await enregistrer_evenement_audit(
        session=session, type_evenement="consultation_ajoutee",
        description=f"Consultation ajoutée au dossier {data.dossier_id} — motif: {data.motif}",
        utilisateur_id=medecin.id, role_acteur=medecin.role,
    )
    return ConsultationResponse(
        id=consultation.id, dossier_id=consultation.dossier_id, medecin_id=consultation.medecin_id,
        hopital=consultation.hopital, motif=consultation.motif, type_consultation=consultation.type_consultation,
        poids=consultation.poids, taille=consultation.taille, temperature=consultation.temperature,
        pression_arterielle=consultation.pression_arterielle, observations=consultation.observations,
        diagnostic=consultation.diagnostic, conclusion=consultation.conclusion,
        date_controle=consultation.date_controle, date_consultation=consultation.date_consultation,
    )

@routeur_medical.get("/ordonnances", response_model=list[OrdonnanceResponse])
async def lister_toutes_ordonnances(
    medecin: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Liste toutes les ordonnances du médecin avec cloisonnement."""
    ordonnances = await medical_service.obtenir_toutes_ordonnances(session, medecin)
    return [
        OrdonnanceResponse(
            id=o.id, dossier_id=o.dossier_id, medecin_id=o.medecin_id,
            numero_ordonnance=o.numero_ordonnance, hopital=o.hopital, medecin_nom=o.medecin_nom,
            medicaments=o.medicaments, instructions=o.instructions, statut=o.statut,
            date_prescription=o.date_prescription, date_expiration=o.date_expiration,
        )
        for o in ordonnances
    ]

@routeur_medical.get("/dossiers/{dossier_id}/ordonnances", response_model=list[OrdonnanceResponse])
async def lister_ordonnances(
    dossier_id: UUID,
    medecin: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Liste les ordonnances d'un dossier."""
    ordonnances = await medical_service.obtenir_ordonnances(session, dossier_id)
    return [
        OrdonnanceResponse(
            id=o.id, dossier_id=o.dossier_id, medecin_id=o.medecin_id,
            numero_ordonnance=o.numero_ordonnance, hopital=o.hopital, medecin_nom=o.medecin_nom,
            medicaments=o.medicaments, instructions=o.instructions, statut=o.statut,
            date_prescription=o.date_prescription, date_expiration=o.date_expiration,
        )
        for o in ordonnances
    ]

@routeur_medical.post("/ordonnances", response_model=OrdonnanceResponse, status_code=201)
async def creer_ordonnance(
    data: OrdonnanceCreate,
    medecin: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Crée une ordonnance avec cloisonnement automatique."""
    nom = dechiffrer_donnee(medecin.nom_chiffre) if medecin.nom_chiffre else ""
    prenom = dechiffrer_donnee(medecin.prenom_chiffre) if medecin.prenom_chiffre else ""
    medecin_nom = f"{prenom} {nom}".strip() or "Médecin"
    ordonnance = await medical_service.creer_ordonnance(session, medecin, data.model_dump(), medecin_nom=medecin_nom)
    await enregistrer_evenement_audit(
        session=session, type_evenement="ordonnance_creation",
        description=f"Ordonnance #{ordonnance.numero_ordonnance} créée pour dossier {ordonnance.dossier_id}",
        utilisateur_id=medecin.id, role_acteur=medecin.role,
    )
    journal_audit(f"ordonnance | cree | numero={ordonnance.numero_ordonnance} | dossier_id={ordonnance.dossier_id}")
    return OrdonnanceResponse(
        id=ordonnance.id, dossier_id=ordonnance.dossier_id, medecin_id=ordonnance.medecin_id,
        numero_ordonnance=ordonnance.numero_ordonnance, hopital=ordonnance.hopital, medecin_nom=ordonnance.medecin_nom,
        medicaments=ordonnance.medicaments, instructions=ordonnance.instructions, statut=ordonnance.statut,
        date_prescription=ordonnance.date_prescription, date_expiration=ordonnance.date_expiration,
    )

@routeur_medical.patch("/ordonnances/{ordonnance_id}", response_model=OrdonnanceResponse)
async def modifier_ordonnance(
    ordonnance_id: UUID,
    data: OrdonnanceUpdate,
    medecin: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Modifie une ordonnance."""
    # ✅ CORRECTION : passer medecin (objet) et non medecin.id
    ordonnance = await medical_service.modifier_ordonnance(session, ordonnance_id, medecin, data.model_dump(exclude_none=True))
    await enregistrer_evenement_audit(
        session=session, type_evenement="ordonnance_modification",
        description=f"Ordonnance #{ordonnance.numero_ordonnance} modifiée",
        utilisateur_id=medecin.id, role_acteur=medecin.role,
    )
    return OrdonnanceResponse(
        id=ordonnance.id, dossier_id=ordonnance.dossier_id, medecin_id=ordonnance.medecin_id,
        numero_ordonnance=ordonnance.numero_ordonnance, hopital=ordonnance.hopital, medecin_nom=ordonnance.medecin_nom,
        medicaments=ordonnance.medicaments, instructions=ordonnance.instructions, statut=ordonnance.statut,
        date_prescription=ordonnance.date_prescription, date_expiration=ordonnance.date_expiration,
    )

@routeur_medical.delete("/ordonnances/{ordonnance_id}", status_code=204)
async def supprimer_ordonnance(
    ordonnance_id: UUID,
    medecin: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Supprime une ordonnance."""
    # ✅ CORRECTION : passer medecin (objet) et non medecin.id
    await medical_service.supprimer_ordonnance(session, ordonnance_id, medecin)
    await enregistrer_evenement_audit(
        session=session, type_evenement="ordonnance_suppression",
        description=f"Ordonnance supprimée — {ordonnance_id}",
        utilisateur_id=medecin.id, role_acteur=medecin.role,
    )

# =============================================================================
# ROUTES PATIENT (citoyen)
# =============================================================================
@routeur_patient.get("/mes-ordonnances", response_model=list[OrdonnanceResponse])
async def lister_mes_ordonnances(
    citoyen: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Liste les ordonnances du citoyen connecté."""
    ordonnances = await medical_service.obtenir_ordonnances_par_digiid(session, citoyen.digiid_public)
    return [
        OrdonnanceResponse(
            id=o.id, dossier_id=o.dossier_id, medecin_id=o.medecin_id,
            numero_ordonnance=o.numero_ordonnance, hopital=o.hopital, medecin_nom=o.medecin_nom,
            medicaments=o.medicaments, instructions=o.instructions, statut=o.statut,
            date_prescription=o.date_prescription, date_expiration=o.date_expiration,
        )
        for o in ordonnances
    ]

@routeur_patient.post("/mes-ordonnances/{ordonnance_id}/signaler", status_code=201)
async def signaler_ordonnance(
    ordonnance_id: UUID,
    donnees: SignalementCreate,
    citoyen: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Signale un problème sur une ordonnance."""
    appartient = await medical_service.verifier_patient_ordonnance(session, ordonnance_id, citoyen.digiid_public)
    if not appartient:
        raise ErreurAutorisation("Cette ordonnance ne vous appartient pas")
    await enregistrer_evenement_audit(
        session=session, type_evenement="ordonnance_signalement",
        description=f"Signalement sur ordonnance {ordonnance_id} — motif: {donnees.motif}",
        utilisateur_id=citoyen.id, role_acteur=citoyen.role,
    )
    return {"succes": True, "message": "Signalement envoyé avec succès"}

@routeur_patient.get("/mon-dossier-medical", response_model=list[DossierCompletResponse])
async def mon_dossier_medical(
    citoyen: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Récupère le dossier médical complet du citoyen connecté."""
    dossiers = await medical_service.obtenir_dossiers_par_digiid(session, citoyen.digiid_public)
    result = []
    for d in dossiers:
        consultations = await medical_service.obtenir_consultations(session, d.id)
        ordonnances = await medical_service.obtenir_ordonnances(session, d.id)
        result.append(DossierCompletResponse(
            dossier=DossierMedicalResponse(
                id=d.id, medecin_id=d.medecin_id,
                patient_nom=d.patient_nom, patient_prenom=d.patient_prenom,
                patient_digiid=d.patient_digiid, patient_date_naissance=d.patient_date_naissance,
                hopital=d.hopital, motif=d.motif, diagnostic=d.diagnostic, statut=d.statut,
                consultations_count=len(consultations), ordonnances_count=len(ordonnances),
                date_creation=d.date_creation, date_modification=d.date_modification,
            ),
            consultations=[
                ConsultationResponse(
                    id=c.id, dossier_id=c.dossier_id, medecin_id=c.medecin_id,
                    hopital=c.hopital, motif=c.motif, type_consultation=c.type_consultation,
                    poids=c.poids, taille=c.taille, temperature=c.temperature,
                    pression_arterielle=c.pression_arterielle, observations=c.observations,
                    diagnostic=c.diagnostic, conclusion=c.conclusion,
                    date_controle=c.date_controle, date_consultation=c.date_consultation,
                )
                for c in consultations
            ],
            ordonnances=[
                OrdonnanceResponse(
                    id=o.id, dossier_id=o.dossier_id, medecin_id=o.medecin_id,
                    numero_ordonnance=o.numero_ordonnance, hopital=o.hopital, medecin_nom=o.medecin_nom,
                    medicaments=o.medicaments, instructions=o.instructions, statut=o.statut,
                    date_prescription=o.date_prescription, date_expiration=o.date_expiration,
                )
                for o in ordonnances
            ],
        ))
    return result