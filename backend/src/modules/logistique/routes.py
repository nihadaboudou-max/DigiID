
# -*- coding: utf-8 -*-
"""Routes API du domaine logistique (référentiel + colis de bout en bout)."""
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import (
    Gare, Ligne, Vehicule, Voyage, ActeurLogistique, Utilisateur,
    Ticket, Colis, ColisEvenement,
)
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.logistique import service, schemas
from src.modules.qr_dynamique.service import construire_url_qr_durable
from src.modules.logistique.dependances import (
    obtenir_gare_ou_404, obtenir_ligne_ou_404, obtenir_vehicule_ou_404,
    obtenir_voyage_ou_404, obtenir_acteur_ou_404,
)
from src.noyau import dechiffrer_donnee
from src.noyau.permissions import require_permission


# ─── Enrichissement (noms lisibles) ──────────────────────────────────

async def _nom_gare(session: AsyncSession, gare_id: UUID | None) -> str | None:
    if gare_id is None:
        return None
    gare = await session.get(Gare, gare_id)
    return f"{gare.nom} ({gare.ville})" if gare else None


async def _nom_utilisateur(session: AsyncSession, utilisateur_id: UUID | None) -> str | None:
    if utilisateur_id is None:
        return None
    utilisateur = await session.get(Utilisateur, utilisateur_id)
    if utilisateur is None:
        return None
    prenom = dechiffrer_donnee(utilisateur.prenom_chiffre) if utilisateur.prenom_chiffre else ""
    nom = dechiffrer_donnee(utilisateur.nom_chiffre) if utilisateur.nom_chiffre else ""
    return f"{prenom} {nom}".strip() or utilisateur.digiid_public or "Utilisateur"


async def _enrichir_ligne(session: AsyncSession, ligne: Ligne) -> Ligne:
    ligne.gare_depart_nom = await _nom_gare(session, ligne.gare_depart_id)
    ligne.gare_arrivee_nom = await _nom_gare(session, ligne.gare_arrivee_id)
    return ligne


async def _enrichir_vehicule(session: AsyncSession, vehicule: Vehicule) -> Vehicule:
    vehicule.gare_nom = await _nom_gare(session, vehicule.gare_id)
    return vehicule


async def _enrichir_voyage(session: AsyncSession, voyage: Voyage) -> Voyage:
    vehicule = await session.get(Vehicule, voyage.vehicule_id)
    voyage.vehicule_immatriculation = vehicule.immatriculation if vehicule else None
    voyage.chauffeur_nom = await _nom_utilisateur(session, voyage.chauffeur_id)
    return voyage


async def _enrichir_acteur(session: AsyncSession, acteur: ActeurLogistique) -> ActeurLogistique:
    acteur.utilisateur_nom = await _nom_utilisateur(session, acteur.utilisateur_id)
    acteur.gare_nom = await _nom_gare(session, acteur.gare_id)
    return acteur


async def _enrichir_colis(session: AsyncSession, colis: Colis) -> Colis:
    colis.gare_depart_nom = await _nom_gare(session, colis.gare_depart_id)
    colis.gare_arrivee_nom = await _nom_gare(session, colis.gare_arrivee_id)
    colis.expediteur_nom = await _nom_utilisateur(session, colis.expediteur_id)
    colis.receveur_nom = await _nom_utilisateur(session, colis.receveur_id)
    colis.chauffeur_nom = await _nom_utilisateur(session, colis.chauffeur_id)
    ticket = await service.obtenir_ticket_du_colis(session, colis)
    colis.code_clair = ticket.code_clair if ticket else None
    colis.qr_token = ticket.qr_token if ticket else None
    colis.qr_code_url = construire_url_qr_durable(ticket.qr_token) if ticket else None
    return colis


async def _enrichir_evenement(
    session: AsyncSession, evenement: ColisEvenement
) -> ColisEvenement:
    evenement.acteur_nom = await _nom_utilisateur(session, evenement.acteur_id)
    return evenement


# ─── Gares ───────────────────────────────────────────────────────────

routeur_gares = APIRouter(prefix="/gares", tags=["Logistique — Gares"])


@routeur_gares.post("", response_model=schemas.GareResponse,
                    status_code=status.HTTP_201_CREATED, summary="Créer une gare")
@require_permission("logistique.ecrire")
async def creer_gare(
    donnees: schemas.GareCreate,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    return await service.creer_gare(session, donnees)


@routeur_gares.get("", response_model=schemas.ReponseListe[schemas.GareResponse],
                   summary="Lister les gares")
@require_permission("logistique.lire")
async def lister_gares(
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    page: int = Query(1, ge=1),
    par_page: int = Query(20, ge=1, le=100),
    est_actif: bool | None = Query(None),
    session: AsyncSession = Depends(obtenir_session),
):
    gares, total = await service.lister_gares(session, page, par_page, est_actif)
    return schemas.ReponseListe(elements=gares, total=total, page=page, par_page=par_page)


@routeur_gares.get("/{gare_id}", response_model=schemas.GareResponse,
                   summary="Obtenir une gare")
@require_permission("logistique.lire")
async def obtenir_gare(
    gare: Gare = Depends(obtenir_gare_ou_404),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
):
    return gare


@routeur_gares.patch("/{gare_id}", response_model=schemas.GareResponse,
                     summary="Modifier une gare")
@require_permission("logistique.ecrire")
async def modifier_gare(
    donnees: schemas.GareUpdate,
    gare: Gare = Depends(obtenir_gare_ou_404),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    return await service.modifier_gare(session, gare.id, donnees)


@routeur_gares.delete("/{gare_id}", status_code=status.HTTP_204_NO_CONTENT,
                      summary="Supprimer une gare")
@require_permission("logistique.supprimer")
async def supprimer_gare(
    gare: Gare = Depends(obtenir_gare_ou_404),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    await service.supprimer_gare(session, gare.id)


# ─── Lignes ──────────────────────────────────────────────────────────

routeur_lignes = APIRouter(prefix="/lignes", tags=["Logistique — Lignes"])


@routeur_lignes.post("", response_model=schemas.LigneResponse,
                     status_code=status.HTTP_201_CREATED, summary="Créer une ligne")
@require_permission("logistique.ecrire")
async def creer_ligne(
    donnees: schemas.LigneCreate,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    ligne = await service.creer_ligne(session, donnees)
    return await _enrichir_ligne(session, ligne)


@routeur_lignes.get("", response_model=schemas.ReponseListe[schemas.LigneResponse],
                    summary="Lister les lignes")
@require_permission("logistique.lire")
async def lister_lignes(
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    page: int = Query(1, ge=1),
    par_page: int = Query(20, ge=1, le=100),
    est_actif: bool | None = Query(None),
    session: AsyncSession = Depends(obtenir_session),
):
    lignes, total = await service.lister_lignes(session, page, par_page, est_actif)
    for ligne in lignes:
        await _enrichir_ligne(session, ligne)
    return schemas.ReponseListe(elements=lignes, total=total, page=page, par_page=par_page)


@routeur_lignes.get("/{ligne_id}", response_model=schemas.LigneResponse,
                    summary="Obtenir une ligne")
@require_permission("logistique.lire")
async def obtenir_ligne(
    ligne: Ligne = Depends(obtenir_ligne_ou_404),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    return await _enrichir_ligne(session, ligne)


@routeur_lignes.patch("/{ligne_id}", response_model=schemas.LigneResponse,
                      summary="Modifier une ligne")
@require_permission("logistique.ecrire")
async def modifier_ligne(
    donnees: schemas.LigneUpdate,
    ligne: Ligne = Depends(obtenir_ligne_ou_404),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    ligne = await service.modifier_ligne(session, ligne.id, donnees)
    return await _enrichir_ligne(session, ligne)


@routeur_lignes.delete("/{ligne_id}", status_code=status.HTTP_204_NO_CONTENT,
                       summary="Supprimer une ligne")
@require_permission("logistique.supprimer")
async def supprimer_ligne(
    ligne: Ligne = Depends(obtenir_ligne_ou_404),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    await service.supprimer_ligne(session, ligne.id)


# ─── Véhicules ───────────────────────────────────────────────────────

routeur_vehicules = APIRouter(prefix="/vehicules", tags=["Logistique — Véhicules"])


@routeur_vehicules.post("", response_model=schemas.VehiculeResponse,
                        status_code=status.HTTP_201_CREATED, summary="Créer un véhicule")
@require_permission("logistique.ecrire")
async def creer_vehicule(
    donnees: schemas.VehiculeCreate,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    vehicule = await service.creer_vehicule(session, donnees)
    return await _enrichir_vehicule(session, vehicule)


@routeur_vehicules.get("", response_model=schemas.ReponseListe[schemas.VehiculeResponse],
                       summary="Lister les véhicules")
@require_permission("logistique.lire")
async def lister_vehicules(
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    page: int = Query(1, ge=1),
    par_page: int = Query(20, ge=1, le=100),
    est_actif: bool | None = Query(None),
    session: AsyncSession = Depends(obtenir_session),
):
    vehicules, total = await service.lister_vehicules(session, page, par_page, est_actif)
    for vehicule in vehicules:
        await _enrichir_vehicule(session, vehicule)
    return schemas.ReponseListe(elements=vehicules, total=total, page=page, par_page=par_page)


@routeur_vehicules.get("/{vehicule_id}", response_model=schemas.VehiculeResponse,
                       summary="Obtenir un véhicule")
@require_permission("logistique.lire")
async def obtenir_vehicule(
    vehicule: Vehicule = Depends(obtenir_vehicule_ou_404),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    return await _enrichir_vehicule(session, vehicule)


@routeur_vehicules.patch("/{vehicule_id}", response_model=schemas.VehiculeResponse,
                         summary="Modifier un véhicule")
@require_permission("logistique.ecrire")
async def modifier_vehicule(
    donnees: schemas.VehiculeUpdate,
    vehicule: Vehicule = Depends(obtenir_vehicule_ou_404),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    vehicule = await service.modifier_vehicule(session, vehicule.id, donnees)
    return await _enrichir_vehicule(session, vehicule)


@routeur_vehicules.delete("/{vehicule_id}", status_code=status.HTTP_204_NO_CONTENT,
                          summary="Supprimer un véhicule")
@require_permission("logistique.supprimer")
async def supprimer_vehicule(
    vehicule: Vehicule = Depends(obtenir_vehicule_ou_404),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    await service.supprimer_vehicule(session, vehicule.id)


# ─── Voyages ─────────────────────────────────────────────────────────

routeur_voyages = APIRouter(prefix="/voyages", tags=["Logistique — Voyages"])


@routeur_voyages.post("", response_model=schemas.VoyageResponse,
                      status_code=status.HTTP_201_CREATED, summary="Créer un voyage")
@require_permission("logistique.ecrire")
async def creer_voyage(
    donnees: schemas.VoyageCreate,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    voyage = await service.creer_voyage(session, donnees)
    return await _enrichir_voyage(session, voyage)


@routeur_voyages.get("", response_model=schemas.ReponseListe[schemas.VoyageResponse],
                     summary="Lister les voyages")
@require_permission("logistique.lire")
async def lister_voyages(
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    page: int = Query(1, ge=1),
    par_page: int = Query(20, ge=1, le=100),
    statut: str | None = Query(None),
    session: AsyncSession = Depends(obtenir_session),
):
    voyages, total = await service.lister_voyages(session, page, par_page, statut)
    for voyage in voyages:
        await _enrichir_voyage(session, voyage)
    return schemas.ReponseListe(elements=voyages, total=total, page=page, par_page=par_page)


@routeur_voyages.get("/{voyage_id}", response_model=schemas.VoyageResponse,
                     summary="Obtenir un voyage")
@require_permission("logistique.lire")
async def obtenir_voyage(
    voyage: Voyage = Depends(obtenir_voyage_ou_404),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    return await _enrichir_voyage(session, voyage)


@routeur_voyages.patch("/{voyage_id}", response_model=schemas.VoyageResponse,
                       summary="Modifier un voyage")
@require_permission("logistique.ecrire")
async def modifier_voyage(
    donnees: schemas.VoyageUpdate,
    voyage: Voyage = Depends(obtenir_voyage_ou_404),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    voyage = await service.modifier_voyage(session, voyage.id, donnees)
    return await _enrichir_voyage(session, voyage)


@routeur_voyages.delete("/{voyage_id}", status_code=status.HTTP_204_NO_CONTENT,
                        summary="Supprimer un voyage")
@require_permission("logistique.supprimer")
async def supprimer_voyage(
    voyage: Voyage = Depends(obtenir_voyage_ou_404),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    await service.supprimer_voyage(session, voyage.id)


# ─── Acteurs logistiques ─────────────────────────────────────────────

routeur_acteurs = APIRouter(prefix="/acteurs", tags=["Logistique — Acteurs"])


@routeur_acteurs.post("", response_model=schemas.ActeurResponse,
                      status_code=status.HTTP_201_CREATED, summary="Créer un acteur")
@require_permission("logistique.ecrire")
async def creer_acteur(
    donnees: schemas.ActeurCreate,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    acteur = await service.creer_acteur(session, donnees)
    return await _enrichir_acteur(session, acteur)


@routeur_acteurs.get("", response_model=schemas.ReponseListe[schemas.ActeurResponse],
                     summary="Lister les acteurs")
@require_permission("logistique.lire")
async def lister_acteurs(
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    page: int = Query(1, ge=1),
    par_page: int = Query(20, ge=1, le=100),
    est_actif: bool | None = Query(None),
    gare_id: UUID | None = Query(None),
    session: AsyncSession = Depends(obtenir_session),
):
    acteurs, total = await service.lister_acteurs(session, page, par_page, est_actif, gare_id)
    for acteur in acteurs:
        await _enrichir_acteur(session, acteur)
    return schemas.ReponseListe(elements=acteurs, total=total, page=page, par_page=par_page)


@routeur_acteurs.get("/{acteur_id}", response_model=schemas.ActeurResponse,
                     summary="Obtenir un acteur")
@require_permission("logistique.lire")
async def obtenir_acteur(
    acteur: ActeurLogistique = Depends(obtenir_acteur_ou_404),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    return await _enrichir_acteur(session, acteur)


@routeur_acteurs.patch("/{acteur_id}", response_model=schemas.ActeurResponse,
                       summary="Modifier un acteur")
@require_permission("logistique.ecrire")
async def modifier_acteur(
    donnees: schemas.ActeurUpdate,
    acteur: ActeurLogistique = Depends(obtenir_acteur_ou_404),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    acteur = await service.modifier_acteur(session, acteur.id, donnees)
    return await _enrichir_acteur(session, acteur)


@routeur_acteurs.delete("/{acteur_id}", status_code=status.HTTP_204_NO_CONTENT,
                        summary="Supprimer un acteur")
@require_permission("logistique.supprimer")
async def supprimer_acteur(
    acteur: ActeurLogistique = Depends(obtenir_acteur_ou_404),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    await service.supprimer_acteur(session, acteur.id)


# ─── Colis ──────────────────────────────────────────────────────────

routeur_colis = APIRouter(prefix="/colis", tags=["Logistique — Colis"])


@routeur_colis.post("", response_model=schemas.ColisEnregistre,
                    status_code=status.HTTP_201_CREATED,
                    summary="Enregistrer un colis (génère le ticket QR + numéro en clair)")
@require_permission("logistique.colis.creer")
async def enregistrer_colis(
    donnees: schemas.ColisCreate,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    colis, ticket = await service.creer_colis(session, donnees, utilisateur_courant)
    await _enrichir_colis(session, colis)
    ticket.qr_code_url = construire_url_qr_durable(ticket.qr_token)
    return {"colis": colis, "ticket": ticket}


@routeur_colis.get("", response_model=schemas.ReponseListe[schemas.ColisResponse],
                   summary="Lister les colis")
@require_permission("logistique.lire")
async def lister_colis(
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    page: int = Query(1, ge=1),
    par_page: int = Query(20, ge=1, le=100),
    statut: str | None = Query(None),
    gare_id: UUID | None = Query(None),
    voyage_id: UUID | None = Query(None),
    session: AsyncSession = Depends(obtenir_session),
):
    colis_liste, total = await service.lister_colis(
        session, page, par_page, statut, gare_id, voyage_id
    )
    for colis in colis_liste:
        await _enrichir_colis(session, colis)
    return schemas.ReponseListe(elements=colis_liste, total=total, page=page, par_page=par_page)


@routeur_colis.get("/{colis_id}/evenements",
                   response_model=list[schemas.ColisEvenementResponse],
                   summary="Timeline d'un colis")
@require_permission("logistique.lire")
async def lister_evenements_colis(
    colis_id: UUID,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    evenements = await service.lister_evenements(session, colis_id)
    for evenement in evenements:
        await _enrichir_evenement(session, evenement)
    return evenements


@routeur_colis.get("/{code}", response_model=schemas.ColisResponse,
                   summary="Obtenir un colis par code clair (ou token QR)")
@require_permission("logistique.lire")
async def obtenir_colis(
    code: str,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    colis, _ = await service.obtenir_colis_par_code(session, code)
    return await _enrichir_colis(session, colis)


# ─── Scans ──────────────────────────────────────────────────────────

routeur_scans = APIRouter(tags=["Logistique — Scans"])


@routeur_scans.post("/scans", response_model=schemas.ScanResponse,
                    summary="Scanner un ticket (livraison idempotente, anti-« DÉJÀ LIVRÉ »)")
@routeur_scans.post("/scan", response_model=schemas.ScanResponse, include_in_schema=False)
@require_permission("logistique.scan")
async def scanner_ticket(
    donnees: schemas.ScanCreate,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    resultat = await service.enregistrer_scan(session, donnees, utilisateur_courant)
    colis = resultat.get("colis")
    if colis is not None:
        await _enrichir_colis(session, colis)
    evenement = resultat.get("evenement")
    if evenement is not None:
        await _enrichir_evenement(session, evenement)
    ticket = resultat.get("ticket")
    if ticket is not None:
        ticket.qr_code_url = construire_url_qr_durable(ticket.qr_token)
    return resultat


# ─── Agrégation ──────────────────────────────────────────────────────

routeur_logistique = APIRouter(prefix="/api/v1/logistique")
routeur_logistique.include_router(routeur_gares)
routeur_logistique.include_router(routeur_lignes)
routeur_logistique.include_router(routeur_vehicules)
routeur_logistique.include_router(routeur_voyages)
routeur_logistique.include_router(routeur_acteurs)
routeur_logistique.include_router(routeur_colis)
routeur_logistique.include_router(routeur_scans)
