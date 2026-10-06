# -*- coding: utf-8 -*-
"""
Routes API du module Identité DigiID.

Trois publics, trois besoins :

  - **Citoyen** : afficher sa carte DigiID (QR durable) et retrouver ses envois
    et les voyages de ses proches (``/carte``, ``/mes-voyages``). Ce sont ses
    propres données : aucune permission métier n'est requise, seulement un
    compte authentifié (et actif).
  - **Guichet** (receveur, commerçant, chauffeur) : scanner la carte d'un client
    pour **pré-remplir la fiche** sans ressaisie (``/guichet/rechercher``).
  - **Acteurs logistiques** : tenir leur dossier professionnel (pièce, permis,
    véhicule) et consulter leur manifeste (``/profil-logistique/*``,
    ``/chauffeur/*``).
"""
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.identite_digiid import service, schemas
from src.noyau.permissions import require_permission

# Routeurs thématiques
routeur_carte = APIRouter(prefix="/carte", tags=["Identité DigiID — Carte citoyenne"])
routeur_guichet = APIRouter(prefix="/guichet", tags=["Identité DigiID — Guichet"])
routeur_profils = APIRouter(
    prefix="/profil-logistique", tags=["Identité DigiID — Profils logistiques"]
)
routeur_chauffeur = APIRouter(
    prefix="/chauffeur", tags=["Identité DigiID — Chauffeur"]
)
routeur_mes_voyages = APIRouter(tags=["Identité DigiID — Mes voyages"])


# ─── Carte citoyenne (QR durable) ────────────────────────────────────

@routeur_carte.get(
    "",
    response_model=schemas.CarteDigiIDResponse,
    summary="Afficher ma carte DigiID (QR durable)",
)
async def ma_carte(
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Carte DigiID du citoyen connecté : nom, téléphone, ville + QR durable.

    Le QR est **persisté** : le guichet peut le scanner autant de fois que
    nécessaire (contrairement au QR dynamique de 30 secondes servant au contrôle
    ponctuel). Aucune donnée sensible (email, documents) n'est exposée.
    """
    return await service.obtenir_ou_creer_carte(session, utilisateur_courant)


@routeur_carte.get(
    "/qr",
    response_model=schemas.CarteDigiIDResponse,
    summary="Obtenir uniquement le QR de ma carte (page d'affichage)",
)
async def ma_carte_qr(
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Même contenu que ``/carte`` — point d'entrée de la page « plein écran QR »."""
    return await service.obtenir_ou_creer_carte(session, utilisateur_courant)


# ─── Guichet : pré-remplir une fiche à partir de la carte ────────────

@routeur_guichet.post(
    "/rechercher",
    response_model=schemas.ContactDigiIDResponse,
    summary="Retrouver un client par sa carte DigiID (pré-remplissage)",
)
@require_permission("logistique.lire")
async def rechercher_contact_guichet(
    donnees: schemas.RechercheDigiIDRequest,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Le client présente sa carte → la fiche colis/passager se pré-remplit.

    Accepte le DigiID public **ou** l'URL complète du QR scannée. La réponse se
    limite à nom / téléphone / ville / adresse : le guichet n'accède à rien
    d'autre.
    """
    return await service.rechercher_contact(session, donnees)


# ─── Profil logistique (dossier professionnel) ───────────────────────

@routeur_profils.get(
    "/mien",
    response_model=schemas.ProfilLogistiqueResponse,
    summary="Consulter mon dossier logistique",
)
async def mon_profil_logistique(
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Dossier professionnel de l'acteur connecté (404 s'il n'existe pas encore)."""
    profil = await service.obtenir_profil_logistique(session, utilisateur_courant.id)
    return await service.enrichir_profil(session, profil)


@routeur_profils.put(
    "/mien",
    response_model=schemas.ProfilLogistiqueResponse,
    summary="Créer / mettre à jour mon dossier logistique (pièce, permis, véhicule)",
)
@require_permission("logistique.profil.ecrire")
async def enregistrer_mon_profil_logistique(
    donnees: schemas.ProfilLogistiqueCreate,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Déclare son identité professionnelle, son permis et son véhicule.

    Toute modification d'un élément contrôlé remet le dossier « en attente » :
    on ne peut pas valider un dossier puis changer l'immatriculation en silence.
    """
    return await service.enregistrer_profil_logistique(
        session, utilisateur_courant, donnees
    )


@routeur_profils.get(
    "/{utilisateur_id}",
    response_model=schemas.ProfilLogistiqueResponse,
    summary="Consulter le dossier logistique d'un acteur (gérant de gare)",
)
@require_permission("logistique.ecrire")
async def consulter_profil_logistique(
    utilisateur_id: UUID,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Permet au gérant de gare de contrôler un dossier **avant** de le valider."""
    profil = await service.obtenir_profil_logistique(session, utilisateur_id)
    return await service.enrichir_profil(session, profil)


@routeur_profils.post(
    "/{utilisateur_id}/verification",
    response_model=schemas.ProfilLogistiqueResponse,
    summary="Valider le dossier d'un acteur (gérant de gare / administrateur)",
)
@require_permission("logistique.ecrire")
async def verifier_profil_logistique(
    utilisateur_id: UUID,
    donnees: schemas.VerificationProfilRequest,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Coche les éléments contrôlés : pièce, photo, et permis + véhicule (chauffeur).

    Le dossier n'est déclaré « vérifié » que si **tous** les éléments exigés sont
    validés — sinon il reste en attente, avec les motifs visibles côté terrain.
    """
    return await service.verifier_profil_logistique(
        session, utilisateur_id, donnees, utilisateur_courant
    )


# ─── Chauffeur : voyages et manifeste ────────────────────────────────

@routeur_chauffeur.get(
    "/voyages",
    response_model=list[schemas.VoyageChauffeurResponse],
    summary="Mes voyages de chauffeur (avec volumes à transporter)",
)
@require_permission("logistique.lire")
async def mes_voyages_chauffeur(
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Voyages affectés au chauffeur connecté, en cours et planifiés en tête."""
    return await service.lister_voyages_chauffeur(session, utilisateur_courant)


@routeur_chauffeur.get(
    "/voyages/{voyage_id}/manifeste",
    response_model=schemas.ManifesteVoyageResponse,
    summary="Manifeste d'un voyage : colis + passagers (un seul écran)",
)
@require_permission("logistique.lire")
async def manifeste_voyage(
    voyage_id: UUID,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Ce que le chauffeur transporte réellement : colis **et** passagers.

    Accès strictement limité au chauffeur affecté au voyage (contrôle serveur) :
    les numéros des destinataires et des familles sont masqués.
    """
    return await service.construire_manifeste(session, voyage_id, utilisateur_courant)


# ─── Citoyen : ses envois et les voyages de ses proches ──────────────

@routeur_mes_voyages.get(
    "/mes-voyages",
    response_model=schemas.MesVoyagesResponse,
    summary="Mes envois et les voyages de mes proches",
)
async def mes_voyages(
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Vue du citoyen : colis dont il est expéditeur/destinataire et passagers
    dont il est responsable, acheteur ou proche de confiance.

    Chaque ligne porte un lien ``/suivi/<code>`` vers la page publique de suivi.
    """
    return await service.mes_voyages(session, utilisateur_courant)


# ─── Assemblage ───────────────────────────────────────────────────────

routeur_identite = APIRouter(prefix="/api/v1/identite")
routeur_identite.include_router(routeur_carte)
routeur_identite.include_router(routeur_guichet)
routeur_identite.include_router(routeur_profils)
routeur_identite.include_router(routeur_chauffeur)
routeur_identite.include_router(routeur_mes_voyages)
