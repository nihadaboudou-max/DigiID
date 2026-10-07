
# -*- coding: utf-8 -*-
"""Routes API du domaine logistique (référentiel + colis de bout en bout)."""
import unicodedata
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import (
    Gare, Ligne, Vehicule, Voyage, ActeurLogistique, Utilisateur,
    Ticket, Colis, ColisEvenement,
    SuiviFamilial, SuiviFamilialEvenement,
)
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.logistique import service, schemas
from src.modules.paiement.tarification import frais_service_passager
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


def _texte_dechiffre(valeur_chiffree: str | None) -> str:
    """Déchiffre un champ utilisateur (nom, prénom, téléphone) stocké chiffré."""
    return dechiffrer_donnee(valeur_chiffree) if valeur_chiffree else ""


async def _fiche_utilisateur(
    session: AsyncSession, utilisateur_id: UUID | None
) -> Utilisateur | None:
    if utilisateur_id is None:
        return None
    return await session.get(Utilisateur, utilisateur_id)


def _nom_complet(utilisateur: Utilisateur) -> str:
    prenom = _texte_dechiffre(utilisateur.prenom_chiffre)
    nom = _texte_dechiffre(utilisateur.nom_chiffre)
    return f"{prenom} {nom}".strip() or utilisateur.digiid_public or "Utilisateur"


def _apercu_nom(utilisateur: Utilisateur) -> str:
    """« Moussa D. » — identifie le chauffeur sans exposer son nom complet."""
    prenom = _texte_dechiffre(utilisateur.prenom_chiffre)
    nom = _texte_dechiffre(utilisateur.nom_chiffre)
    if prenom and nom:
        return f"{prenom} {nom[0].upper()}."
    return prenom or nom or utilisateur.digiid_public or "Chauffeur"


def _normaliser_recherche(texte: str) -> str:
    """Minuscules sans accents : « Amadou » se trouve en tapant « amad »."""
    sans_accents = "".join(
        c for c in unicodedata.normalize("NFKD", texte) if not unicodedata.combining(c)
    )
    return sans_accents.casefold().strip()


async def _nom_utilisateur(session: AsyncSession, utilisateur_id: UUID | None) -> str | None:
    utilisateur = await _fiche_utilisateur(session, utilisateur_id)
    return _nom_complet(utilisateur) if utilisateur is not None else None


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
    # Trajet lisible directement sur le voyage : « Cotonou → Parakou ».
    ligne = await session.get(Ligne, voyage.ligne_id)
    if ligne is not None:
        voyage.gare_depart_id = ligne.gare_depart_id
        voyage.gare_arrivee_id = ligne.gare_arrivee_id
        depart = await session.get(Gare, ligne.gare_depart_id)
        arrivee = await session.get(Gare, ligne.gare_arrivee_id)
        if depart is not None and arrivee is not None:
            voyage.ligne_libelle = f"{depart.ville} → {arrivee.ville}"
    return voyage


async def _enrichir_acteur(session: AsyncSession, acteur: ActeurLogistique) -> ActeurLogistique:
    acteur.utilisateur_nom = await _nom_utilisateur(session, acteur.utilisateur_id)
    acteur.gare_nom = await _nom_gare(session, acteur.gare_id)
    # Fiche déchiffrée : on doit pouvoir **vérifier qui** on désigne avant de valider.
    utilisateur = await _fiche_utilisateur(session, acteur.utilisateur_id)
    if utilisateur is not None:
        acteur.utilisateur_prenom = _texte_dechiffre(utilisateur.prenom_chiffre) or None
        acteur.utilisateur_nom_famille = _texte_dechiffre(utilisateur.nom_chiffre) or None
        acteur.utilisateur_telephone = _texte_dechiffre(utilisateur.telephone_chiffre) or None
        acteur.utilisateur_digiid_public = utilisateur.digiid_public
    return acteur


async def _fiche_chauffeur(
    session: AsyncSession, acteur: ActeurLogistique
) -> schemas.ChauffeurDisponible | None:
    """Transforme un acteur « chauffeur » en fiche proposable au guichet."""
    utilisateur = await _fiche_utilisateur(session, acteur.utilisateur_id)
    if utilisateur is None:
        return None
    return schemas.ChauffeurDisponible(
        utilisateur_id=utilisateur.id,
        nom_complet=_nom_complet(utilisateur),
        prenom=_texte_dechiffre(utilisateur.prenom_chiffre) or None,
        nom_famille=_texte_dechiffre(utilisateur.nom_chiffre) or None,
        telephone=_texte_dechiffre(utilisateur.telephone_chiffre) or None,
        digiid_public=utilisateur.digiid_public,
        numero_licence=acteur.numero_licence,
        gare_id=acteur.gare_id,
        gare_nom=await _nom_gare(session, acteur.gare_id),
    )


async def _bagages_enrichis(
    session: AsyncSession,
    *,
    suivi_familial_id: UUID | None = None,
    colis_id: UUID | None = None,
) -> list[schemas.BagageResponse]:
    """Étiquettes QR des sacs (une par sac) prêtes pour l'API."""
    bagages = await service.lister_bagages(
        session, suivi_familial_id=suivi_familial_id, colis_id=colis_id
    )
    return [schemas.BagageResponse.model_validate(b) for b in bagages]


async def _enrichir_colis(session: AsyncSession, colis: Colis) -> Colis:
    colis.gare_depart_nom = await _nom_gare(session, colis.gare_depart_id)
    colis.gare_arrivee_nom = await _nom_gare(session, colis.gare_arrivee_id)
    # Nom d'expéditeur saisi au guichet ; repli sur le compte DigiID s'il est vide.
    if not colis.expediteur_nom:
        colis.expediteur_nom = await _nom_utilisateur(session, colis.expediteur_id)
    colis.receveur_nom = await _nom_utilisateur(session, colis.receveur_id)
    colis.chauffeur_nom = await _nom_utilisateur(session, colis.chauffeur_id)
    # Qui a matériellement créé le colis (receveur au guichet OU chauffeur en route).
    colis.enregistre_par_nom = await _nom_utilisateur(session, colis.enregistre_par_id)
    ticket = await service.obtenir_ticket_du_colis(session, colis)
    colis.code_clair = ticket.code_clair if ticket else None
    colis.qr_token = ticket.qr_token if ticket else None
    colis.qr_code_url = construire_url_qr_durable(ticket.qr_token) if ticket else None
    colis.bagages = await _bagages_enrichis(session, colis_id=colis.id)
    return colis


async def _enrichir_evenement(
    session: AsyncSession, evenement: ColisEvenement
) -> ColisEvenement:
    evenement.acteur_nom = await _nom_utilisateur(session, evenement.acteur_id)
    return evenement


async def _enrichir_suivi_familial(
    session: AsyncSession, suivi: SuiviFamilial
) -> SuiviFamilial:
    suivi.gare_depart_nom = await _nom_gare(session, suivi.gare_depart_id)
    suivi.gare_arrivee_nom = await _nom_gare(session, suivi.gare_arrivee_id)
    suivi.enregistre_par_nom = await _nom_utilisateur(session, suivi.enregistre_par_id)
    suivi.chauffeur_nom = await _nom_utilisateur(session, suivi.chauffeur_id)
    ticket = await service.obtenir_ticket_du_suivi(session, suivi)
    suivi.code_clair = ticket.code_clair if ticket else None
    suivi.qr_token = ticket.qr_token if ticket else None
    suivi.qr_code_url = construire_url_qr_durable(ticket.qr_token) if ticket else None
    suivi.nb_evenements = await service._compter_evenements_suivi(session, suivi.id)
    suivi.frais_service_fcfa = frais_service_passager()
    suivi.bagages = await _bagages_enrichis(session, suivi_familial_id=suivi.id)
    return suivi


async def _enrichir_evenement_suivi(
    session: AsyncSession, evenement: SuiviFamilialEvenement
) -> SuiviFamilialEvenement:
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
@require_permission("logistique.ecrire", "logistique.planifier")
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
@require_permission("logistique.ecrire", "logistique.planifier")
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
@require_permission("logistique.ecrire", "logistique.planifier")
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
@require_permission("logistique.ecrire", "logistique.planifier")
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
@require_permission("logistique.ecrire", "logistique.planifier")
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
    chauffeur_id: UUID | None = Query(None, description="Cars d'un chauffeur donné"),
    ligne_id: UUID | None = Query(None, description="Cars d'une ligne (trajet) donnée"),
    a_partir_de: datetime | None = Query(
        None, description="Uniquement les départs à venir (ordre chronologique)"
    ),
    session: AsyncSession = Depends(obtenir_session),
):
    voyages, total = await service.lister_voyages(
        session, page, par_page, statut, chauffeur_id, ligne_id, a_partir_de
    )
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
@require_permission("logistique.ecrire", "logistique.planifier")
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


# ─── Le chauffeur choisit ses voyages (flexibilité multi-lignes) ──────

@routeur_voyages.post("/{voyage_id}/chauffeur",
                      response_model=schemas.VoyageResponse,
                      summary="Se désigner comme chauffeur d'un voyage (volontaire)")
@require_permission("logistique.voyage.rejoindre")
async def rejoindre_voyage(
    voyage_id: UUID,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Un chauffeur indépendant prend un départ encore libre.

    Garde-fou : il doit être **enregistré comme chauffeur** (acteur logistique),
    sinon n'importe quel compte pourrait s'emparer d'un car.
    """
    acteurs = await service.lister_chauffeurs_pour_trajet(
        session, utilisateur_id=utilisateur_courant.id
    )
    if not acteurs:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail=(
                "Votre compte n'est pas enregistré comme chauffeur : demandez au "
                "super-admin (ou au gérant de gare) de créer votre fiche acteur."
            ),
        )
    voyage = await service.rejoindre_voyage(
        session, voyage_id=voyage_id, chauffeur_id=utilisateur_courant.id
    )
    return await _enrichir_voyage(session, voyage)


@routeur_voyages.delete("/{voyage_id}/chauffeur",
                        response_model=schemas.VoyageResponse,
                        summary="Se retirer d'un voyage (avant le départ)")
@require_permission("logistique.voyage.rejoindre")
async def quitter_voyage(
    voyage_id: UUID,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    voyage = await service.quitter_voyage(
        session, voyage_id=voyage_id, chauffeur_id=utilisateur_courant.id
    )
    return await _enrichir_voyage(session, voyage)


# ─── Actions groupées du chauffeur (passagers ET colis) ──────────────

@routeur_voyages.post("/{voyage_id}/depart",
                      response_model=schemas.ActionLotVoyageResponse,
                      summary="Valider le départ (tous les passagers + colis en 1 clic)")
@require_permission("logistique.scan")
async def valider_depart_voyage(
    voyage_id: UUID,
    donnees: schemas.ActionLotVoyageRequest | None = None,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    return await service.valider_depart_voyage(session, voyage_id, utilisateur_courant)


@routeur_voyages.post("/{voyage_id}/arrivee",
                      response_model=schemas.ActionLotVoyageResponse,
                      summary="Marquer arrivés (passagers + colis d'une même gare)")
@require_permission("logistique.scan")
async def marquer_arrivee_voyage(
    voyage_id: UUID,
    donnees: schemas.ActionLotVoyageRequest | None = None,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    donnees = donnees or schemas.ActionLotVoyageRequest()
    return await service.marquer_arrivee_voyage(
        session, voyage_id, utilisateur_courant,
        gare_id=donnees.gare_id, localisation=donnees.localisation,
    )


@routeur_voyages.post("/{voyage_id}/pre-alerte",
                      response_model=schemas.PreAlerteResponse,
                      summary="Prévenir de l'approche (SMS passagers + proches + destinataires)")
@require_permission("logistique.scan")
async def pre_alerte_voyage(
    voyage_id: UUID,
    donnees: schemas.PreAlerteRequest | None = None,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    donnees = donnees or schemas.PreAlerteRequest()
    return await service.envoyer_pre_alerte_voyage(
        session, voyage_id, utilisateur_courant, delai_minutes=donnees.delai_minutes
    )


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


# ─── Chauffeurs (attribution sans identifiant technique) ────────────

routeur_chauffeurs = APIRouter(prefix="/chauffeurs", tags=["Logistique — Chauffeurs"])


@routeur_chauffeurs.get("", response_model=list[schemas.ChauffeurDisponible],
                        summary="Chauffeurs proposables pour un trajet (liste + recherche)")
@require_permission("logistique.lire")
async def lister_chauffeurs(
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    gare_depart_id: UUID | None = Query(None, description="Gare de départ du trajet"),
    ligne_id: UUID | None = Query(None, description="Ligne (trajet) concernée"),
    utilisateur_id: UUID | None = Query(None, description="Retrouver un chauffeur précis"),
    recherche: str | None = Query(None, description="Nom, prénom, téléphone ou licence"),
    session: AsyncSession = Depends(obtenir_session),
):
    """« Qui peut conduire ce trajet ? » — pour l'attribution au guichet.

    Le receveur ne saisit jamais d'identifiant : il voit la liste des chauffeurs
    rattachés à la gare de départ ou ayant déjà un voyage sur la ligne, avec nom,
    prénom et numéro — et il peut **réduire la liste en tapant un nom**.
    """
    acteurs = await service.lister_chauffeurs_pour_trajet(
        session, gare_id=gare_depart_id, ligne_id=ligne_id, utilisateur_id=utilisateur_id
    )
    fiches: list[schemas.ChauffeurDisponible] = []
    for acteur in acteurs:
        fiche = await _fiche_chauffeur(session, acteur)
        if fiche is not None:
            fiches.append(fiche)

    # Les noms sont chiffrés au repos : la recherche se fait après déchiffrement.
    if recherche and recherche.strip():
        terme = _normaliser_recherche(recherche)
        fiches = [
            fiche for fiche in fiches
            if terme in _normaliser_recherche(
                " ".join(
                    filtre for filtre in (
                        fiche.prenom, fiche.nom_famille, fiche.telephone,
                        fiche.numero_licence, fiche.digiid_public, fiche.nom_complet,
                    ) if filtre
                )
            )
        ]

    departs = await service.prochains_departs_par_chauffeur(
        session, [fiche.utilisateur_id for fiche in fiches]
    )
    for fiche in fiches:
        fiche.prochain_depart_le = departs.get(fiche.utilisateur_id)
        fiche.fait_le_trajet = (
            fiche.prochain_depart_le is not None
            or (gare_depart_id is not None and fiche.gare_id == gare_depart_id)
        )
    # Ceux qui font déjà le trajet d'abord, puis ordre alphabétique (annuaire).
    fiches.sort(key=lambda f: (not f.fait_le_trajet, _normaliser_recherche(f.nom_complet)))
    return fiches[:100]


@routeur_chauffeurs.get("/par-code", response_model=schemas.ChauffeurDisponible,
                        summary="Retrouver un chauffeur en scannant sa carte DigiID ou son QR")
@require_permission("logistique.lire")
async def chauffeur_par_code(
    code: str = Query(..., min_length=3, max_length=300,
                      description="DigiID public, code du QR ou URL scannée"),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Le chauffeur présente sa carte (ou dicte son code) → sa fiche s'affiche.

    On réutilise la résolution de carte DigiID du guichet (même source de vérité
    que le pré-remplissage des fiches client), puis on vérifie qu'elle appartient
    bien à un **chauffeur enregistré** avant de laisser continuer.
    """
    # Import local : évite tout couplage d'import entre les deux modules.
    from src.modules.identite_digiid import schemas as schemas_identite
    from src.modules.identite_digiid import service as service_identite

    contact = await service_identite.rechercher_contact(
        session, schemas_identite.RechercheDigiIDRequest(digiid=code)
    )
    acteurs = await service.lister_chauffeurs_pour_trajet(
        session, utilisateur_id=contact.utilisateur_id
    )
    if not acteurs:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail=(
                f"{contact.nom_complet} n'est pas un chauffeur enregistré "
                "(aucun acteur logistique « chauffeur » actif pour ce compte)."
            ),
        )
    fiche = await _fiche_chauffeur(session, acteurs[0])
    if fiche is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Chauffeur introuvable")
    departs = await service.prochains_departs_par_chauffeur(
        session, [fiche.utilisateur_id]
    )
    fiche.prochain_depart_le = departs.get(fiche.utilisateur_id)
    return fiche


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


@routeur_colis.post("/{colis_id}/affectation",
                   response_model=schemas.ColisResponse,
                   summary="Affecter (ou réaffecter) un colis à un voyage / chauffeur")
@require_permission("logistique.colis.creer")
async def affecter_colis(
    colis_id: UUID,
    donnees: schemas.AffectationRequest,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Désigne le car (donc le chauffeur) d'un colis enregistré plus tôt.

    Cas réel : au guichet on enregistre le colis avant de savoir quel car
    partira. Le receveur revient ensuite désigner le voyage — le chauffeur en
    découle automatiquement, et l'affectation est tracée dans la timeline.
    """
    colis = await service.affecter_colis(session, colis_id, donnees, utilisateur_courant)
    await _enrichir_colis(session, colis)
    return colis


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


@routeur_colis.get("/{colis_id}/notifications",
                   response_model=list[schemas.NotificationLogistiqueResponse],
                   summary="SMS envoyés pour un colis (S7)")
@require_permission("logistique.lire")
async def lister_notifications_colis(
    colis_id: UUID,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    await service.obtenir_colis(session, colis_id)
    return await service.lister_notifications(session, "colis", colis_id)


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


# ─── Suivi familial (enfants voyageant seuls) ───────────────────────

routeur_suivi_familial = APIRouter(
    prefix="/suivi-familial", tags=["Logistique — Suivi familial"]
)


@routeur_suivi_familial.post("", response_model=schemas.SuiviFamilialEnregistre,
                             status_code=status.HTTP_201_CREATED,
                             summary="Enregistrer un enfant suivi (ticket ENFANT + SMS parent)")
@require_permission("logistique.colis.creer")
async def enregistrer_suivi_familial(
    donnees: schemas.SuiviFamilialCreate,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    suivi, ticket = await service.creer_suivi_familial(session, donnees, utilisateur_courant)
    await _enrichir_suivi_familial(session, suivi)
    ticket.qr_code_url = construire_url_qr_durable(ticket.qr_token)
    return {"suivi": suivi, "ticket": ticket}


@routeur_suivi_familial.get("",
                            response_model=schemas.ReponseListe[schemas.SuiviFamilialResponse],
                            summary="Lister les suivis familiaux")
@require_permission("logistique.lire")
async def lister_suivi_familial(
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    page: int = Query(1, ge=1),
    par_page: int = Query(20, ge=1, le=100),
    statut: str | None = Query(None),
    voyage_id: UUID | None = Query(None),
    recherche: str | None = Query(None),
    session: AsyncSession = Depends(obtenir_session),
):
    suivis, total = await service.lister_suivi_familial(
        session, page, par_page, statut, voyage_id, recherche
    )
    for suivi in suivis:
        await _enrichir_suivi_familial(session, suivi)
    return schemas.ReponseListe(elements=suivis, total=total, page=page, par_page=par_page)


@routeur_suivi_familial.post("/{suivi_id}/affectation",
                             response_model=schemas.SuiviFamilialResponse,
                             summary="Affecter (ou réaffecter) un passager à un voyage / chauffeur")
@require_permission("logistique.colis.creer")
async def affecter_suivi_familial(
    suivi_id: UUID,
    donnees: schemas.AffectationRequest,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Désigne le car (donc le chauffeur) d'un passager enregistré plus tôt.

    Le guichet enregistre souvent l'enfant avant de savoir quel car partira :
    cette route permet de compléter l'attribution, ou de la corriger.
    """
    suivi = await service.affecter_suivi_familial(
        session, suivi_id, donnees, utilisateur_courant
    )
    return await _enrichir_suivi_familial(session, suivi)


@routeur_suivi_familial.get("/{suivi_id}",
                            response_model=schemas.SuiviFamilialResponse,
                            summary="Obtenir un suivi familial")
@require_permission("logistique.lire")
async def obtenir_suivi_familial(
    suivi_id: UUID,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    suivi = await service.obtenir_suivi_familial(session, suivi_id)
    return await _enrichir_suivi_familial(session, suivi)


@routeur_suivi_familial.get("/{suivi_id}/evenements",
                            response_model=list[schemas.SuiviFamilialEvenementResponse],
                            summary="Timeline d'un suivi familial")
@require_permission("logistique.lire")
async def lister_evenements_suivi(
    suivi_id: UUID,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    evenements = await service.lister_evenements_suivi(session, suivi_id)
    for evenement in evenements:
        await _enrichir_evenement_suivi(session, evenement)
    return evenements


@routeur_suivi_familial.get("/{suivi_id}/notifications",
                            response_model=list[schemas.NotificationLogistiqueResponse],
                            summary="SMS envoyés pour un suivi familial")
@require_permission("logistique.lire")
async def lister_notifications_suivi(
    suivi_id: UUID,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    await service.obtenir_suivi_familial(session, suivi_id)
    return await service.lister_notifications(session, "suivi_familial", suivi_id)


@routeur_suivi_familial.post("/{suivi_id}/evenement",
                             response_model=schemas.SuiviFamilialEvenementResultat,
                             summary="Marquer une étape (départ / arrivée) + SMS au parent")
@require_permission("logistique.scan")
async def enregistrer_evenement_suivi(
    suivi_id: UUID,
    donnees: schemas.SuiviFamilialEvenementCreate,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    resultat = await service.enregistrer_evenement_suivi(
        session, suivi_id, donnees, utilisateur_courant
    )
    suivi = resultat.get("suivi")
    if suivi is not None:
        resultat["suivi"] = await _enrichir_suivi_familial(session, suivi)
    evenement = resultat.get("evenement")
    if evenement is not None:
        resultat["evenement"] = await _enrichir_evenement_suivi(session, evenement)
    return resultat


# ─── Suivi public (sans connexion) ───────────────────────────────────

routeur_public = APIRouter(prefix="/public", tags=["Logistique — Suivi public"])


@routeur_public.get("/suivi/{code}", response_model=schemas.SuiviPublicResponse,
                    summary="Suivi public d'un colis ou d'un enfant (page famille)")
async def suivi_public(
    code: str,
    session: AsyncSession = Depends(obtenir_session),
):
    """Suivi accessible **sans authentification** depuis le code clair (ou le QR)."""
    return await service.construire_suivi_public(session, code)


@routeur_public.get("/horaires", response_model=list[schemas.VoyagePublic],
                    summary="Prochains départs (page citoyens, sans connexion)")
async def horaires_publics(
    gare_depart_id: UUID | None = Query(None),
    gare_arrivee_id: UUID | None = Query(None),
    limite: int = Query(30, ge=1, le=100),
    session: AsyncSession = Depends(obtenir_session),
):
    """Les cars qui partent : trajet, heure, véhicule, chauffeur (aperçu).

    Aucune donnée personnelle : ni client, ni colis, ni téléphone. On tolère
    30 minutes de retard sur le départ pour qu'un car en route reste affiché.
    """
    voyages, _ = await service.lister_voyages(
        session, 1, 100,
        a_partir_de=datetime.now(timezone.utc) - timedelta(minutes=30),
    )
    horaires: list[schemas.VoyagePublic] = []
    for voyage in voyages:
        await _enrichir_voyage(session, voyage)
        if voyage.statut not in service.STATUTS_VOYAGE_ACTIFS:
            continue
        if gare_depart_id is not None and voyage.gare_depart_id != gare_depart_id:
            continue
        if gare_arrivee_id is not None and voyage.gare_arrivee_id != gare_arrivee_id:
            continue
        vehicule = await session.get(Vehicule, voyage.vehicule_id)
        chauffeur_apercu = None
        if voyage.chauffeur_id is not None:
            chauffeur = await _fiche_utilisateur(session, voyage.chauffeur_id)
            if chauffeur is not None:
                chauffeur_apercu = _apercu_nom(chauffeur)
        horaires.append(schemas.VoyagePublic(
            voyage_id=voyage.id,
            trajet=voyage.ligne_libelle or "Trajet à confirmer",
            gare_depart=await _nom_gare(session, voyage.gare_depart_id),
            gare_arrivee=await _nom_gare(session, voyage.gare_arrivee_id),
            date_depart=voyage.date_depart,
            vehicule=voyage.vehicule_immatriculation,
            chauffeur_apercu=chauffeur_apercu,
            statut=voyage.statut,
            capacite=vehicule.capacite if vehicule else None,
        ))
        if len(horaires) >= limite:
            break
    return horaires


# ─── Agrégation ──────────────────────────────────────────────────────

routeur_logistique = APIRouter(prefix="/api/v1/logistique")
routeur_logistique.include_router(routeur_gares)
routeur_logistique.include_router(routeur_lignes)
routeur_logistique.include_router(routeur_vehicules)
routeur_logistique.include_router(routeur_voyages)
routeur_logistique.include_router(routeur_acteurs)
routeur_logistique.include_router(routeur_chauffeurs)
routeur_logistique.include_router(routeur_colis)
routeur_logistique.include_router(routeur_suivi_familial)
routeur_logistique.include_router(routeur_public)
routeur_logistique.include_router(routeur_scans)
