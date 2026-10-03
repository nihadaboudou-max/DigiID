# -*- coding: utf-8 -*-
"""Service logistique — logique métier du référentiel + colis de bout en bout."""
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlparse
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import (
    Gare, Ligne, Vehicule, Voyage, ActeurLogistique, Domaine, Utilisateur,
    Ticket, Colis, ColisEvenement,
)
from src.modules.logistique import schemas
from src.modules.qr_dynamique.service import generer_token_durable


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


# ─── Colis / Ticket : enregistrement ─────────────────────────────────

async def _generer_code_clair(session: AsyncSession, gare: Gare) -> str:
    """Génère un numéro de ticket lisible, unique : ``<CODE_GARE>-<ANNEE>-NNNNNN``."""
    annee = datetime.now(timezone.utc).year
    prefixe = f"{(gare.code or 'GS').upper()}-{annee}-"
    total = await session.scalar(
        select(func.count()).select_from(Ticket).where(
            Ticket.code_clair.like(f"{prefixe}%")
        )
    ) or 0
    n = total + 1
    code = f"{prefixe}{n:06d}"
    # Anti-collision (suppressions, concurrence)
    while await session.scalar(select(Ticket.id).where(Ticket.code_clair == code)):
        n += 1
        code = f"{prefixe}{n:06d}"
    return code


async def creer_colis(
    session: AsyncSession, donnees: schemas.ColisCreate, utilisateur: Utilisateur
) -> tuple[Colis, Ticket]:
    """Enregistre un colis et génère son ticket (QR + numéro en clair)."""
    if donnees.gare_depart_id == donnees.gare_arrivee_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail="Les gares de départ et d'arrivée doivent être différentes")
    gare_depart = await _verifier_existe(session, Gare, donnees.gare_depart_id, "Gare de départ")
    await _verifier_existe(session, Gare, donnees.gare_arrivee_id, "Gare d'arrivée")
    if donnees.voyage_id is not None:
        await _verifier_existe(session, Voyage, donnees.voyage_id, "Voyage")
    if donnees.expediteur_id is not None:
        await _verifier_existe(session, Utilisateur, donnees.expediteur_id, "Expéditeur")
    if donnees.receveur_id is not None:
        await _verifier_existe(session, Utilisateur, donnees.receveur_id, "Receveur")
    if donnees.chauffeur_id is not None:
        await _verifier_existe(session, Utilisateur, donnees.chauffeur_id, "Chauffeur")

    expediteur_id = donnees.expediteur_id or utilisateur.id
    receveur_id = donnees.receveur_id or utilisateur.id

    colis = Colis(
        expediteur_id=expediteur_id,
        destinataire_nom=donnees.destinataire_nom.strip(),
        destinataire_tel=donnees.destinataire_tel.strip(),
        description=donnees.description,
        poids_kg=donnees.poids_kg,
        valeur_fcfa=donnees.valeur_fcfa,
        gare_depart_id=donnees.gare_depart_id,
        gare_arrivee_id=donnees.gare_arrivee_id,
        voyage_id=donnees.voyage_id,
        receveur_id=receveur_id,
        chauffeur_id=donnees.chauffeur_id,
        statut="enregistre",
        frais_fcfa=donnees.frais_fcfa,
    )
    session.add(colis)
    await session.flush()  # -> colis.id disponible

    code_clair = await _generer_code_clair(session, gare_depart)
    ticket = Ticket(
        code_clair=code_clair,
        qr_token=generer_token_durable(str(colis.id)),
        type="COLIS",
        reference_id=colis.id,
        voyage_id=donnees.voyage_id,
        statut="emis",
    )
    session.add(ticket)
    await session.flush()  # -> ticket.id disponible

    colis.ticket_id = ticket.id

    evenement = ColisEvenement(
        colis_id=colis.id,
        type_evenement="enregistrement",
        acteur_id=utilisateur.id,
        gare_id=donnees.gare_depart_id,
        horodatage=datetime.now(timezone.utc),
    )
    session.add(evenement)

    await session.commit()
    await session.refresh(colis)
    await session.refresh(ticket)
    return colis, ticket


# ─── Colis : lecture ─────────────────────────────────────────────────

async def obtenir_colis(session: AsyncSession, colis_id: UUID) -> Colis:
    colis = await session.get(Colis, colis_id)
    if colis is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Colis introuvable")
    return colis


async def obtenir_ticket_du_colis(
    session: AsyncSession, colis: Colis | None
) -> Ticket | None:
    if colis is None:
        return None
    if colis.ticket_id is not None:
        return await session.get(Ticket, colis.ticket_id)
    return await session.scalar(select(Ticket).where(Ticket.reference_id == colis.id))


async def obtenir_colis_par_code(
    session: AsyncSession, code: str
) -> tuple[Colis, Ticket]:
    """Retrouve un colis par code clair OU par token QR (tolérance terrain)."""
    valeur = code.strip()
    ticket = await session.scalar(
        select(Ticket).where(Ticket.code_clair == valeur.upper())
    )
    if ticket is None:
        ticket = await session.scalar(select(Ticket).where(Ticket.qr_token == valeur))
    if ticket is None or ticket.reference_id is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND,
                            detail="Colis introuvable pour ce code")
    colis = await session.get(Colis, ticket.reference_id)
    if colis is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Colis introuvable")
    return colis, ticket


async def lister_colis(
    session: AsyncSession,
    page: int,
    par_page: int,
    statut: str | None = None,
    gare_id: UUID | None = None,
    voyage_id: UUID | None = None,
):
    requete = select(Colis)
    if statut is not None:
        requete = requete.where(Colis.statut == statut)
    if gare_id is not None:
        requete = requete.where(
            (Colis.gare_depart_id == gare_id) | (Colis.gare_arrivee_id == gare_id)
        )
    if voyage_id is not None:
        requete = requete.where(Colis.voyage_id == voyage_id)
    requete = requete.order_by(Colis.cree_le.desc())
    return await _paginer(session, requete, page, par_page)


async def lister_evenements(
    session: AsyncSession, colis_id: UUID
) -> list[ColisEvenement]:
    await obtenir_colis(session, colis_id)  # 404 si le colis n'existe pas
    resultat = await session.execute(
        select(ColisEvenement)
        .where(ColisEvenement.colis_id == colis_id)
        .order_by(ColisEvenement.horodatage.asc(), ColisEvenement.cree_le.asc())
    )
    return list(resultat.scalars().all())


# ─── Scan (idempotent + règle anti-« DÉJÀ LIVRÉ ») ────────────────────

async def _resoudre_ticket(
    session: AsyncSession, donnees: schemas.ScanCreate
) -> Ticket | None:
    if donnees.token:
        token = donnees.token.strip()
        if token.startswith("http"):
            try:
                params = parse_qs(urlparse(token).query)
                token = params.get("token", [token])[0]
            except Exception:
                pass
        return await session.scalar(select(Ticket).where(Ticket.qr_token == token))
    if donnees.code_clair:
        return await session.scalar(
            select(Ticket).where(Ticket.code_clair == donnees.code_clair.strip().upper())
        )
    return None


async def enregistrer_scan(
    session: AsyncSession, donnees: schemas.ScanCreate, utilisateur: Utilisateur
) -> dict:
    """
    Enregistre un scan de façon **idempotente** et applique la règle
    anti-« DÉJÀ LIVRÉ » : un second scan de livraison ne crée aucun événement.
    """
    # 1. Idempotence : même clé -> on renvoie l'événement déjà enregistré.
    if donnees.idempotency_key:
        existant = await session.scalar(
            select(ColisEvenement).where(
                ColisEvenement.idempotency_key == donnees.idempotency_key
            )
        )
        if existant is not None:
            colis = await session.get(Colis, existant.colis_id)
            ticket = await obtenir_ticket_du_colis(session, colis)
            return {
                "succes": True,
                "deja_scanne": True,
                "deja_livre": bool(colis and colis.statut == "livre"),
                "message": "Scan déjà enregistré (idempotent).",
                "statut_colis": colis.statut if colis else None,
                "colis": colis,
                "ticket": ticket,
                "evenement": existant,
            }

    # 2. Résolution de la cible (token QR ou code clair)
    ticket = await _resoudre_ticket(session, donnees)
    if ticket is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND,
                            detail="Ticket introuvable (QR ou code clair invalide)")
    colis = await session.get(Colis, ticket.reference_id) if ticket.reference_id else None
    if colis is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND,
                            detail="Colis associé à ce ticket introuvable")

    # 3. Règle anti-« DÉJÀ LIVRÉ » : pas de nouvel événement.
    if donnees.type_evenement == "livraison" and colis.statut == "livre":
        return {
            "succes": True,
            "deja_livre": True,
            "deja_scanne": False,
            "message": "DÉJÀ LIVRÉ — ce colis a déjà été remis. Scan refusé (anti-fraude).",
            "statut_colis": colis.statut,
            "colis": colis,
            "ticket": ticket,
            "evenement": None,
        }

    # 4. Enregistrement de l'événement + mise à jour des statuts
    maintenant = donnees.horodatage or datetime.now(timezone.utc)
    evenement = ColisEvenement(
        colis_id=colis.id,
        type_evenement=donnees.type_evenement,
        acteur_id=utilisateur.id,
        gare_id=donnees.gare_id,
        localisation=donnees.localisation,
        horodatage=maintenant,
        idempotency_key=donnees.idempotency_key,
    )
    session.add(evenement)

    if donnees.type_evenement == "livraison":
        colis.statut = "livre"
        colis.livre_le = maintenant
        ticket.statut = "livre"
    elif donnees.type_evenement in ("depart", "mise_en_transit"):
        if colis.statut == "enregistre":
            colis.statut = "en_transit"
        ticket.statut = "en_transit"
    elif donnees.type_evenement == "arrivee":
        colis.statut = "arrive"
        ticket.statut = "en_transit"

    ticket.nb_scans = (ticket.nb_scans or 0) + 1
    if ticket.premier_scan_le is None:
        ticket.premier_scan_le = maintenant

    try:
        await session.commit()
    except IntegrityError:
        # Concurrence : même idempotency_key insérée deux fois -> renvoyer l'existant.
        await session.rollback()
        existant = await session.scalar(
            select(ColisEvenement).where(
                ColisEvenement.idempotency_key == donnees.idempotency_key
            )
        ) if donnees.idempotency_key else None
        if existant is not None:
            colis = await session.get(Colis, existant.colis_id)
            ticket = await obtenir_ticket_du_colis(session, colis)
            return {
                "succes": True,
                "deja_scanne": True,
                "deja_livre": bool(colis and colis.statut == "livre"),
                "message": "Scan déjà enregistré (idempotent).",
                "statut_colis": colis.statut if colis else None,
                "colis": colis,
                "ticket": ticket,
                "evenement": existant,
            }
        raise

    await session.refresh(colis)
    await session.refresh(ticket)
    await session.refresh(evenement)
    return {
        "succes": True,
        "deja_livre": False,
        "deja_scanne": False,
        "message": "Scan enregistré." if donnees.type_evenement != "livraison"
                   else "Colis livré avec succès.",
        "statut_colis": colis.statut,
        "colis": colis,
        "ticket": ticket,
        "evenement": evenement,
    }
