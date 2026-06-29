# -*- coding: utf-8 -*-
"""Routes API pour le module Police — version complète avec cloisonnement."""
from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.police.schemas import (
    AlerteMarquerLue,
    AlertePoliceCreate,
    AlertePoliceResponse,
    ComparaisonPhotosResponse,
    HistoriqueResponse,
    NoteInterneCreate,
    NoteInterneResponse,
    NoteInterneUpdate,
    PersonneRechercheeResponse,
    PointCarteResponse,
    PointsCarteResponse,
    ProfilPersonneResponse,
    RapportResponse,
    RechercheQuery,
    ScanQRResponse,
    SignalementFraudeCreate,
    SignalementFraudeResponse,
    StatistiquesPoliceResponse,
    TraiterSignalement,
    VerificationPoliceCreate,
    VerificationPoliceResponse,
)
from src.noyau.journal import enregistrer_evenement_audit
from src.modules.police import service

routeur_police = APIRouter(prefix="/api/v1/police", tags=["Police"])


# =============================================================================
# VÉRIFICATIONS D'IDENTITÉ
# =============================================================================

@routeur_police.post("/verifier", response_model=VerificationPoliceResponse, status_code=201)
async def verifier_identite(
    data: VerificationPoliceCreate,
    officier: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Crée une vérification d'identité."""
    v = await service.creer_verification(session, officier, data.model_dump())
    await enregistrer_evenement_audit(
        session=session,
        type_evenement="police_verification_identite",
        description=f"Vérification identité {data.personne_digiid}",
        utilisateur_id=officier.id,
        role_acteur=officier.role,
    )
    return v


@routeur_police.get("/verifications", response_model=list[VerificationPoliceResponse])
async def lister_verifications(
    officier: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    limite: int = Query(50, ge=1, le=200),
    page: int = Query(1, ge=1),
):
    """Liste les vérifications avec pagination et cloisonnement."""
    verifications, total = await service.obtenir_verifications(session, officier, limite, page)
    return verifications


@routeur_police.get("/verifications/{verification_id}", response_model=VerificationPoliceResponse)
async def obtenir_verification(
    verification_id: UUID,
    officier: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Obtient une vérification par son ID."""
    v = await service.obtenir_verification_par_id(session, verification_id)
    if not v:
        raise HTTPException(status_code=404, detail="Vérification introuvable")
    return v


# =============================================================================
# RECHERCHE AVANCÉE
# =============================================================================

@routeur_police.post("/rechercher", response_model=dict)
async def rechercher_personnes(
    data: RechercheQuery,
    officier: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Recherche avancée de personnes avec filtres et cloisonnement."""
    resultats, total, temps = await service.rechercher_personne(
        session, data.query, data.type_recherche,
        data.filtre_statut, data.filtre_score_min, data.filtre_score_max,
        data.filtre_ville, data.limite, data.page, officier,
    )
    return {
        "resultats": resultats,
        "total": total,
        "page": data.page,
        "limite": data.limite,
        "temps_ms": temps,
    }


# =============================================================================
# PROFIL DÉTAILLÉ
# =============================================================================

@routeur_police.get("/profil/{digiid}", response_model=ProfilPersonneResponse)
async def obtenir_profil(
    digiid: str,
    officier: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Obtient le profil détaillé d'une personne avec cloisonnement."""
    return await service.obtenir_profil_personne(session, digiid, officier)


# =============================================================================
# SIGNALEMENTS DE FRAUDE
# =============================================================================

@routeur_police.post("/signalements", response_model=SignalementFraudeResponse, status_code=201)
async def creer_signalement(
    data: SignalementFraudeCreate,
    officier: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Crée un signalement de fraude."""
    s = await service.creer_signalement(session, officier, data.model_dump())
    await enregistrer_evenement_audit(
        session=session,
        type_evenement="police_signalement_fraude",
        description=f"Signalement fraude {data.personne_digiid} — motif: {data.motif}",
        utilisateur_id=officier.id,
        role_acteur=officier.role,
    )
    return s


@routeur_police.get("/signalements", response_model=list[SignalementFraudeResponse])
async def lister_signalements(
    officier: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    statut: str = Query(None),
    limite: int = Query(50, ge=1, le=200),
    page: int = Query(1, ge=1),
):
    """Liste les signalements avec pagination, filtre et cloisonnement."""
    signalements, total = await service.obtenir_signalements(session, officier, statut, limite, page)
    return signalements


@routeur_police.patch("/signalements/{signalement_id}/traiter", response_model=SignalementFraudeResponse)
async def traiter_signalement(
    signalement_id: UUID,
    data: TraiterSignalement,
    officier: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Traite un signalement."""
    return await service.traiter_signalement(session, signalement_id, officier, data.model_dump())


# =============================================================================
# NOTES INTERNES
# =============================================================================

@routeur_police.post("/notes", response_model=NoteInterneResponse, status_code=201)
async def creer_note(
    data: NoteInterneCreate,
    officier: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Crée une note interne."""
    return await service.creer_note(session, officier, data.model_dump())


@routeur_police.get("/notes", response_model=list[NoteInterneResponse])
async def lister_notes(
    officier: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    personne_digiid: str = Query(None),
    categorie: str = Query(None),
    limite: int = Query(50, ge=1, le=200),
):
    """Liste les notes internes avec cloisonnement."""
    notes, total = await service.obtenir_notes(session, officier, personne_digiid, categorie, limite)
    return notes


@routeur_police.patch("/notes/{note_id}", response_model=NoteInterneResponse)
async def modifier_note(
    note_id: UUID,
    data: NoteInterneUpdate,
    officier: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Modifie une note interne."""
    return await service.modifier_note(session, note_id, officier, data.model_dump())


@routeur_police.delete("/notes/{note_id}", status_code=204)
async def supprimer_note(
    note_id: UUID,
    officier: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Supprime une note interne."""
    await service.supprimer_note(session, note_id, officier)


# =============================================================================
# ALERTES
# =============================================================================

@routeur_police.get("/alertes", response_model=dict)
async def lister_alertes(
    officier: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    non_lues_seulement: bool = Query(False),
    limite: int = Query(50, ge=1, le=200),
):
    """Liste les alertes avec cloisonnement."""
    alertes, total, non_lues = await service.obtenir_alertes(session, officier, non_lues_seulement, limite)
    return {"alertes": alertes, "total": total, "non_lues": non_lues}


@routeur_police.patch("/alertes/{alerte_id}/lire", response_model=AlertePoliceResponse)
async def marquer_alerte_lue(
    alerte_id: UUID,
    officier: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Marque une alerte comme lue."""
    return await service.marquer_alerte_lue(session, alerte_id, officier)


# =============================================================================
# STATISTIQUES / DASHBOARD
# =============================================================================

@routeur_police.get("/statistiques", response_model=StatistiquesPoliceResponse)
async def obtenir_statistiques(
    officier: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Obtient les statistiques avec cloisonnement."""
    return await service.obtenir_statistiques(session, officier)


# =============================================================================
# CARTE GÉOGRAPHIQUE
# =============================================================================

@routeur_police.get("/carte", response_model=PointsCarteResponse)
async def obtenir_points_carte(
    officier: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    limite: int = Query(100, ge=1, le=500),
):
    """Obtient les points pour la carte avec cloisonnement."""
    return await service.obtenir_points_carte(session, officier, limite)


# =============================================================================
# SCAN QR
# =============================================================================

@routeur_police.get("/scan-qr/{digiid}", response_model=ScanQRResponse)
async def scanner_qr(
    digiid: str,
    officier: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Traite un scan de QR code avec cloisonnement."""
    return await service.scanner_qr(session, digiid, officier)


# =============================================================================
# HISTORIQUE
# =============================================================================

@routeur_police.get("/historique", response_model=HistoriqueResponse)
async def obtenir_historique(
    officier: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    type_historique: str = Query(None),
    limite: int = Query(50, ge=1, le=200),
):
    """Obtient l'historique avec cloisonnement."""
    return await service.obtenir_historique_complet(session, officier, type_historique, limite)


# =============================================================================
# EXPORT DE RAPPORT
# =============================================================================

@routeur_police.post("/export-rapport", response_model=RapportResponse)
async def generer_rapport(
    officier: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    date_debut: str = Query(None),
    date_fin: str = Query(None),
    format: str = Query("json"),
    type_donnees: list[str] = Query(["verifications", "signalements"]),
):
    """Génère un rapport exportable avec cloisonnement."""
    from datetime import datetime
    debut = datetime.fromisoformat(date_debut) if date_debut else None
    fin = datetime.fromisoformat(date_fin) if date_fin else None
    return await service.generer_rapport(session, officier, debut, fin, format, type_donnees)


# =============================================================================
# COMPARAISON DE PHOTOS
# =============================================================================

@routeur_police.post("/comparer-photos", response_model=ComparaisonPhotosResponse)
async def comparer_photos(
    data: dict,
    officier: Annotated[Utilisateur, Depends(utilisateur_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Compare deux photos pour la reconnaissance faciale."""
    return await service.comparer_photos(
        session,
        data.get("photo_source", ""),
        data.get("photo_cible", ""),
    )