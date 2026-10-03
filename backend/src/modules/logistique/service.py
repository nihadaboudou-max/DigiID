# -*- coding: utf-8 -*-
"""Service logistique — logique métier du référentiel."""
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import (
    Gare, Ligne, Vehicule, Voyage, ActeurLogistique, Domaine, Utilisateur,
)
from src.modules.logistique import schemas


# ─── Utilitaires ─────────────────────────────────────────────────────

async def _verifier_existe(session: AsyncSession, modele, identifiant, libelle: str):
    """Vérifie l'existence d'une entité référencée, sinon 404."""
    obj = await session.get(modele, identifiant)
    if obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{libelle} introuvable",
        )
    return obj


async def _paginer(session: AsyncSession, requete, page: int, par_page: int):
    """Retourne (éléments, total) pour une requête paginée."""
    total = (await session.execute(
        select(func.count()).select_from(requete.subquery())
    )).scalar() or 0
    resultat = await session.execute(
        requete.offset((page - 1) * par_page).limit(par_page)
    )
    return list(resultat.scalars().all()), total


# ─── Gares ───────────────────────────────────────────────────────────

async def creer_gare(session: AsyncSession, donnees: schemas.GareCreate) -> Gare:
    if await session.scalar(select(Gare).where(Gare.code == donnees.code)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail=f"Le code de gare '{donnees.code}' est déjà utilisé")
    if donnees.domain_id is not None:
        await _verifier_existe(session, Domaine, donnees.domain_id, "Domaine")
    gare = Gare(**donnees.model_dump())
    session.add(gare)
    await session.commit()
    await session.refresh(gare)
    return gare


async def obtenir_gare(session: AsyncSession, gare_id: UUID) -> Gare:
    gare = await session.get(Gare, gare_id)
    if gare is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Gare introuvable")
    return gare


async def lister_gares(session: AsyncSession, page: int, par_page: int,
                       est_actif: bool | None = None):
    requete = select(Gare)
    if est_actif is not None:
        requete = requete.where(Gare.actif == est_actif)
    requete = requete.order_by(Gare.ville, Gare.nom)
    return await _paginer(session, requete, page, par_page)


async def modifier_gare(session: AsyncSession, gare_id: UUID,
                        donnees: schemas.GareUpdate) -> Gare:
    gare = await obtenir_gare(session, gare_id)
    if donnees.domain_id is not None:
        await _verifier_existe(session, Domaine, donnees.domain_id, "Domaine")
    for champ, valeur in donnees.model_dump(exclude_unset=True).items():
        setattr(gare, champ, valeur)
    await session.commit()
    await session.refresh(gare)
    return gare


async def supprimer_gare(session: AsyncSession, gare_id: UUID) -> None:
    gare = await obtenir_gare(session, gare_id)
    await session.delete(gare)
    await session.commit()


# ─── Lignes ──────────────────────────────────────────────────────────

async def creer_ligne(session: AsyncSession, donnees: schemas.LigneCreate) -> Ligne:
    if donnees.gare_depart_id == donnees.gare_arrivee_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail="Les gares de départ et d'arrivée doivent être différentes")
    await _verifier_existe(session, Gare, donnees.gare_depart_id, "Gare de départ")
    await _verifier_existe(session, Gare, donnees.gare_arrivee_id, "Gare d'arrivée")
    ligne = Ligne(**donnees.model_dump())
    session.add(ligne)
    await session.commit()
    await session.refresh(ligne)
    return ligne


async def obtenir_ligne(session: AsyncSession, ligne_id: UUID) -> Ligne:
    ligne = await session.get(Ligne, ligne_id)
    if ligne is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ligne introuvable")
    return ligne


async def lister_lignes(session: AsyncSession, page: int, par_page: int,
                        est_actif: bool | None = None):
    requete = select(Ligne)
    if est_actif is not None:
        requete = requete.where(Ligne.actif == est_actif)
    requete = requete.order_by(Ligne.cree_le.desc())
    return await _paginer(session, requete, page, par_page)


async def modifier_ligne(session: AsyncSession, ligne_id: UUID,
                         donnees: schemas.LigneUpdate) -> Ligne:
    ligne = await obtenir_ligne(session, ligne_id)
    valeurs = donnees.model_dump(exclude_unset=True)
    depart = valeurs.get("gare_depart_id", ligne.gare_depart_id)
    arrivee = valeurs.get("gare_arrivee_id", ligne.gare_arrivee_id)
    if depart == arrivee:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail="Les gares de départ et d'arrivée doivent être différentes")
    if "gare_depart_id" in valeurs:
        await _verifier_existe(session, Gare, depart, "Gare de départ")
    if "gare_arrivee_id" in valeurs:
        await _verifier_existe(session, Gare, arrivee, "Gare d'arrivée")
    for champ, valeur in valeurs.items():
        setattr(ligne, champ, valeur)
    await session.commit()
    await session.refresh(ligne)
    return ligne


async def supprimer_ligne(session: AsyncSession, ligne_id: UUID) -> None:
    ligne = await obtenir_ligne(session, ligne_id)
    await session.delete(ligne)
    await session.commit()


# ─── Véhicules ───────────────────────────────────────────────────────

async def creer_vehicule(session: AsyncSession, donnees: schemas.VehiculeCreate) -> Vehicule:
    if await session.scalar(
        select(Vehicule).where(Vehicule.immatriculation == donnees.immatriculation)
    ):
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail=f"Le véhicule '{donnees.immatriculation}' existe déjà")
    if donnees.gare_id is not None:
        await _verifier_existe(session, Gare, donnees.gare_id, "Gare")
    vehicule = Vehicule(**donnees.model_dump())
    session.add(vehicule)
    await session.commit()
    await session.refresh(vehicule)
    return vehicule


async def obtenir_vehicule(session: AsyncSession, vehicule_id: UUID) -> Vehicule:
    vehicule = await session.get(Vehicule, vehicule_id)
    if vehicule is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Véhicule introuvable")
    return vehicule


async def lister_vehicules(session: AsyncSession, page: int, par_page: int,
                           est_actif: bool | None = None):
    requete = select(Vehicule)
    if est_actif is not None:
        requete = requete.where(Vehicule.actif == est_actif)
    requete = requete.order_by(Vehicule.immatriculation)
    return await _paginer(session, requete, page, par_page)


async def modifier_vehicule(session: AsyncSession, vehicule_id: UUID,
                            donnees: schemas.VehiculeUpdate) -> Vehicule:
    vehicule = await obtenir_vehicule(session, vehicule_id)
    valeurs = donnees.model_dump(exclude_unset=True)
    if valeurs.get("gare_id") is not None:
        await _verifier_existe(session, Gare, valeurs["gare_id"], "Gare")
    for champ, valeur in valeurs.items():
        setattr(vehicule, champ, valeur)
    await session.commit()
    await session.refresh(vehicule)
    return vehicule


async def supprimer_vehicule(session: AsyncSession, vehicule_id: UUID) -> None:
    vehicule = await obtenir_vehicule(session, vehicule_id)
    await session.delete(vehicule)
    await session.commit()


# ─── Voyages ─────────────────────────────────────────────────────────

async def creer_voyage(session: AsyncSession, donnees: schemas.VoyageCreate) -> Voyage:
    await _verifier_existe(session, Ligne, donnees.ligne_id, "Ligne")
    await _verifier_existe(session, Vehicule, donnees.vehicule_id, "Véhicule")
    if donnees.chauffeur_id is not None:
        await _verifier_existe(session, Utilisateur, donnees.chauffeur_id, "Chauffeur")
    voyage = Voyage(**donnees.model_dump())
    session.add(voyage)
    await session.commit()
    await session.refresh(voyage)
    return voyage


async def obtenir_voyage(session: AsyncSession, voyage_id: UUID) -> Voyage:
    voyage = await session.get(Voyage, voyage_id)
    if voyage is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Voyage introuvable")
    return voyage


async def lister_voyages(session: AsyncSession, page: int, par_page: int,
                         statut: str | None = None):
    requete = select(Voyage)
    if statut is not None:
        requete = requete.where(Voyage.statut == statut)
    requete = requete.order_by(Voyage.date_depart.desc())
    return await _paginer(session, requete, page, par_page)


async def modifier_voyage(session: AsyncSession, voyage_id: UUID,
                          donnees: schemas.VoyageUpdate) -> Voyage:
    voyage = await obtenir_voyage(session, voyage_id)
    valeurs = donnees.model_dump(exclude_unset=True)
    if valeurs.get("vehicule_id") is not None:
        await _verifier_existe(session, Vehicule, valeurs["vehicule_id"], "Véhicule")
    if "chauffeur_id" in valeurs and valeurs["chauffeur_id"] is not None:
        await _verifier_existe(session, Utilisateur, valeurs["chauffeur_id"], "Chauffeur")
    for champ, valeur in valeurs.items():
        setattr(voyage, champ, valeur)
    await session.commit()
    await session.refresh(voyage)
    return voyage


async def supprimer_voyage(session: AsyncSession, voyage_id: UUID) -> None:
    voyage = await obtenir_voyage(session, voyage_id)
    await session.delete(voyage)
    await session.commit()


# ─── Acteurs logistiques ─────────────────────────────────────────────

async def creer_acteur(session: AsyncSession, donnees: schemas.ActeurCreate) -> ActeurLogistique:
    await _verifier_existe(session, Utilisateur, donnees.utilisateur_id, "Utilisateur")
    await _verifier_existe(session, Gare, donnees.gare_id, "Gare")
    if donnees.numero_licence and await session.scalar(
        select(ActeurLogistique).where(
            ActeurLogistique.numero_licence == donnees.numero_licence
        )
    ):
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail=f"La licence '{donnees.numero_licence}' est déjà utilisée")
    acteur = ActeurLogistique(**donnees.model_dump())
    session.add(acteur)
    await session.commit()
    await session.refresh(acteur)
    return acteur


async def obtenir_acteur(session: AsyncSession, acteur_id: UUID) -> ActeurLogistique:
    acteur = await session.get(ActeurLogistique, acteur_id)
    if acteur is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Acteur introuvable")
    return acteur


async def lister_acteurs(session: AsyncSession, page: int, par_page: int,
                         est_actif: bool | None = None, gare_id: UUID | None = None):
    requete = select(ActeurLogistique)
    if est_actif is not None:
        requete = requete.where(ActeurLogistique.actif == est_actif)
    if gare_id is not None:
        requete = requete.where(ActeurLogistique.gare_id == gare_id)
    requete = requete.order_by(ActeurLogistique.cree_le.desc())
    return await _paginer(session, requete, page, par_page)


async def modifier_acteur(session: AsyncSession, acteur_id: UUID,
                          donnees: schemas.ActeurUpdate) -> ActeurLogistique:
    acteur = await obtenir_acteur(session, acteur_id)
    valeurs = donnees.model_dump(exclude_unset=True)
    if valeurs.get("gare_id") is not None:
        await _verifier_existe(session, Gare, valeurs["gare_id"], "Gare")
    if valeurs.get("numero_licence") and valeurs["numero_licence"] != acteur.numero_licence:
        if await session.scalar(select(ActeurLogistique).where(
            ActeurLogistique.numero_licence == valeurs["numero_licence"]
        )):
            raise HTTPException(status.HTTP_400_BAD_REQUEST,
                                detail=f"La licence '{valeurs['numero_licence']}' est déjà utilisée")
    for champ, valeur in valeurs.items():
        setattr(acteur, champ, valeur)
    await session.commit()
    await session.refresh(acteur)
    return acteur


async def supprimer_acteur(session: AsyncSession, acteur_id: UUID) -> None:
    acteur = await obtenir_acteur(session, acteur_id)
    await session.delete(acteur)
    await session.commit()
