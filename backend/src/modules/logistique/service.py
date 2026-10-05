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
    SuiviFamilial, SuiviFamilialEvenement, NotificationLogistique,
)
from src.modules.logistique import schemas
from src.modules.qr_dynamique.service import generer_token_durable
from src.noyau.notification import (
    envoyer_sms,
    construire_message_colis,
    construire_message_suivi_familial,
    masquer_telephone,
)


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


async def _debiter_compte_prepaye_agent(
    session: AsyncSession, colis: Colis, agent_id: UUID
):
    """
    Débite le compte prépayé de l'agent pour un scan (règle « Si espèces », S6).

    Import **tardif** du service paiement pour éviter toute dépendance circulaire
    entre les modules logistique et paiement.
    """
    from src.modules.paiement import service as service_paiement

    return await service_paiement.appliquer_frais_scan_agent(
        session, colis, agent_id
    )


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

async def _generer_code_clair(
    session: AsyncSession, gare: Gare, prefixe_extra: str = ""
) -> str:
    """Génère un numéro de ticket lisible, unique : ``<CODE_GARE>-<ANNEE>-NNNNNN``.

    ``prefixe_extra`` permet de distinguer les familles de tickets (ex. ``ENF-``
    pour un suivi familial) tout en gardant un format homogène.
    """
    annee = datetime.now(timezone.utc).year
    prefixe = f"{prefixe_extra}{(gare.code or 'GS').upper()}-{annee}-"
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
        expediteur_nom=(donnees.expediteur_nom or "").strip() or None,
        expediteur_tel=(donnees.expediteur_tel or "").strip() or None,
        destinataire_nom=donnees.destinataire_nom.strip(),
        destinataire_tel=donnees.destinataire_tel.strip(),
        description=donnees.description,
        poids_kg=donnees.poids_kg,
        valeur_fcfa=donnees.valeur_fcfa,
        nombre_articles=donnees.nombre_articles,
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

    # 5. SMS d'information au destinataire / expéditeur (S7) : départ, mise en
    #    transit, arrivée, livraison. Traçé dans ``notifications_logistique``.
    await _notifier_scan_colis(
        session, colis, ticket, donnees.type_evenement, donnees.gare_id
    )

    # 6. Compte prépayé de l'agent : sur un colis réglé **en espèces**, 100 FCFA
    #    sont débités automatiquement à chaque scan réellement enregistré.
    debit_agent = await _debiter_compte_prepaye_agent(session, colis, utilisateur.id)

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
    message = (
        "Scan enregistré."
        if donnees.type_evenement != "livraison"
        else "Colis livré avec succès."
    )
    if debit_agent is not None:
        message += (
            f" Compte prépayé : {debit_agent.montant_fcfa} FCFA débités"
            f" (solde {debit_agent.solde_apres} FCFA)."
        )
    return {
        "succes": True,
        "deja_livre": False,
        "deja_scanne": False,
        "message": message,
        "statut_colis": colis.statut,
        "colis": colis,
        "ticket": ticket,
        "evenement": evenement,
    }


# ─── Notifications SMS (S7) ──────────────────────────────────────────

async def _libelle_gare(session: AsyncSession, gare_id: UUID | None) -> str | None:
    """Nom lisible d'une gare (pour composer le SMS : « a quitté Cotonou »)."""
    if gare_id is None:
        return None
    gare = await session.get(Gare, gare_id)
    if gare is None:
        return None
    return f"{gare.nom} ({gare.ville})" if gare.ville else gare.nom


def _ajouter_notification(
    session: AsyncSession,
    *,
    type_cible: str,
    cible_id: UUID,
    type_evenement: str,
    destinataire_role: str,
    telephone: str,
    message: str,
) -> NotificationLogistique:
    """Envoie (mock) le SMS et journalise la notification dans la transaction."""
    envoye = envoyer_sms(telephone, message)
    notification = NotificationLogistique(
        canal="sms",
        type_cible=type_cible,
        cible_id=cible_id,
        type_evenement=type_evenement,
        destinataire_role=destinataire_role,
        telephone=telephone,
        message=message,
        envoye=envoye,
    )
    session.add(notification)
    return notification


async def _notifier_scan_colis(
    session: AsyncSession,
    colis: Colis,
    ticket: Ticket,
    type_evenement: str,
    gare_id: UUID | None,
) -> None:
    """Alerte par SMS le destinataire (et l'expéditeur) lors d'un scan de colis.

    Seuls les événements porteurs de sens pour la famille déclenchent un SMS
    (départ, mise en transit, arrivée, livraison) — pas l'enregistrement initial
    (le client est au guichet).
    """
    if type_evenement not in ("depart", "mise_en_transit", "arrivee", "livraison"):
        return
    lieu = await _libelle_gare(session, gare_id)
    message = construire_message_colis(ticket.code_clair, type_evenement, lieu)
    destinataires: list[tuple[str, str | None]] = [
        ("destinataire", colis.destinataire_tel),
        ("expediteur", colis.expediteur_tel),
    ]
    vus: set[str] = set()
    for role, telephone in destinataires:
        if not telephone or telephone in vus:
            continue
        vus.add(telephone)
        _ajouter_notification(
            session,
            type_cible="colis",
            cible_id=colis.id,
            type_evenement=type_evenement,
            destinataire_role=role,
            telephone=telephone,
            message=message,
        )


async def lister_notifications(
    session: AsyncSession, type_cible: str, cible_id: UUID
) -> list[NotificationLogistique]:
    """Notifications (SMS) déjà émises pour une cible (colis ou suivi familial)."""
    resultat = await session.execute(
        select(NotificationLogistique)
        .where(
            NotificationLogistique.type_cible == type_cible,
            NotificationLogistique.cible_id == cible_id,
        )
        .order_by(NotificationLogistique.cree_le.asc())
    )
    return list(resultat.scalars().all())


# ─── Suivi familial (enfants voyageant seuls) ───────────────────────

async def creer_suivi_familial(
    session: AsyncSession,
    donnees: schemas.SuiviFamilialCreate,
    utilisateur: Utilisateur,
) -> tuple[SuiviFamilial, Ticket]:
    """Enregistre un enfant suivi et génère son ticket (QR + code ``ENF-…``)."""
    if donnees.gare_depart_id == donnees.gare_arrivee_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail="Les gares de départ et d'arrivée doivent être différentes")
    gare_depart = await _verifier_existe(session, Gare, donnees.gare_depart_id, "Gare de départ")
    await _verifier_existe(session, Gare, donnees.gare_arrivee_id, "Gare d'arrivée")
    if donnees.voyage_id is not None:
        await _verifier_existe(session, Voyage, donnees.voyage_id, "Voyage")
    if donnees.parent_id is not None:
        await _verifier_existe(session, Utilisateur, donnees.parent_id, "Parent")

    suivi = SuiviFamilial(
        enfant_nom=donnees.enfant_nom.strip(),
        enfant_age=donnees.enfant_age,
        enfant_sexe=donnees.enfant_sexe,
        parent_nom=(donnees.parent_nom or "").strip() or None,
        telephone_parent=donnees.telephone_parent.strip(),
        parent_id=donnees.parent_id,
        gare_depart_id=donnees.gare_depart_id,
        gare_arrivee_id=donnees.gare_arrivee_id,
        voyage_id=donnees.voyage_id,
        statut="enregistre",
        enregistre_par_id=utilisateur.id,
    )
    session.add(suivi)
    await session.flush()  # -> suivi.id disponible

    code_clair = await _generer_code_clair(session, gare_depart, "ENF-")
    ticket = Ticket(
        code_clair=code_clair,
        qr_token=generer_token_durable(str(suivi.id)),
        type="ENFANT",
        reference_id=suivi.id,
        voyage_id=donnees.voyage_id,
        statut="emis",
    )
    session.add(ticket)
    await session.flush()  # -> ticket.id disponible
    suivi.ticket_id = ticket.id

    evenement = SuiviFamilialEvenement(
        suivi_familial_id=suivi.id,
        type_evenement="enregistrement",
        acteur_id=utilisateur.id,
        gare_id=donnees.gare_depart_id,
        horodatage=datetime.now(timezone.utc),
    )
    session.add(evenement)

    # SMS de confirmation : le parent reçoit le code de suivi public.
    message = (
        f"DigiID — Suivi activé pour {suivi.enfant_nom}. "
        f"Code de suivi : {code_clair}. "
        "Vous recevrez un SMS au départ puis à l'arrivée."
    )
    _ajouter_notification(
        session,
        type_cible="suivi_familial",
        cible_id=suivi.id,
        type_evenement="enregistrement",
        destinataire_role="parent",
        telephone=suivi.telephone_parent,
        message=message,
    )

    await session.commit()
    await session.refresh(suivi)
    await session.refresh(ticket)
    return suivi, ticket


async def obtenir_suivi_familial(
    session: AsyncSession, suivi_id: UUID
) -> SuiviFamilial:
    suivi = await session.get(SuiviFamilial, suivi_id)
    if suivi is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Suivi familial introuvable")
    return suivi


async def obtenir_ticket_du_suivi(
    session: AsyncSession, suivi: SuiviFamilial | None
) -> Ticket | None:
    if suivi is None:
        return None
    if suivi.ticket_id is not None:
        return await session.get(Ticket, suivi.ticket_id)
    return await session.scalar(
        select(Ticket).where(
            Ticket.reference_id == suivi.id, Ticket.type == "ENFANT"
        )
    )


async def lister_suivi_familial(
    session: AsyncSession,
    page: int,
    par_page: int,
    statut: str | None = None,
    voyage_id: UUID | None = None,
    recherche: str | None = None,
):
    requete = select(SuiviFamilial)
    if statut is not None:
        requete = requete.where(SuiviFamilial.statut == statut)
    if voyage_id is not None:
        requete = requete.where(SuiviFamilial.voyage_id == voyage_id)
    if recherche:
        requete = requete.where(SuiviFamilial.enfant_nom.ilike(f"%{recherche.strip()}%"))
    requete = requete.order_by(SuiviFamilial.cree_le.desc())
    return await _paginer(session, requete, page, par_page)


async def _compter_evenements_suivi(session: AsyncSession, suivi_id: UUID) -> int:
    return await session.scalar(
        select(func.count()).select_from(SuiviFamilialEvenement).where(
            SuiviFamilialEvenement.suivi_familial_id == suivi_id
        )
    ) or 0


async def lister_evenements_suivi(
    session: AsyncSession, suivi_id: UUID
) -> list[SuiviFamilialEvenement]:
    await obtenir_suivi_familial(session, suivi_id)  # 404 si absent
    resultat = await session.execute(
        select(SuiviFamilialEvenement)
        .where(SuiviFamilialEvenement.suivi_familial_id == suivi_id)
        .order_by(
            SuiviFamilialEvenement.horodatage.asc(),
            SuiviFamilialEvenement.cree_le.asc(),
        )
    )
    return list(resultat.scalars().all())


async def enregistrer_evenement_suivi(
    session: AsyncSession,
    suivi_id: UUID,
    donnees: schemas.SuiviFamilialEvenementCreate,
    utilisateur: Utilisateur,
) -> dict:
    """Marque une étape du voyage d'un enfant et prévient le parent par SMS.

    Idempotent (``idempotency_key``) : un même événement n'est jamais dupliqué et
    le SMS de départ / d'arrivée ne part qu'une seule fois (flags ``sms_*_envoye``).
    """
    suivi = await obtenir_suivi_familial(session, suivi_id)

    if donnees.idempotency_key:
        existant = await session.scalar(
            select(SuiviFamilialEvenement).where(
                SuiviFamilialEvenement.idempotency_key == donnees.idempotency_key
            )
        )
        if existant is not None:
            return {
                "succes": True,
                "deja_enregistre": True,
                "message": "Événement déjà enregistré (idempotent).",
                "statut_suivi": suivi.statut,
                "suivi": suivi,
                "evenement": existant,
            }

    maintenant = donnees.horodatage or datetime.now(timezone.utc)
    evenement = SuiviFamilialEvenement(
        suivi_familial_id=suivi.id,
        type_evenement=donnees.type_evenement,
        acteur_id=utilisateur.id,
        gare_id=donnees.gare_id,
        localisation=donnees.localisation,
        horodatage=maintenant,
        idempotency_key=donnees.idempotency_key,
    )
    session.add(evenement)

    gare_id_lieu = donnees.gare_id or (
        suivi.gare_arrivee_id if donnees.type_evenement == "arrivee" else suivi.gare_depart_id
    )
    lieu = await _libelle_gare(session, gare_id_lieu)

    if donnees.type_evenement == "depart":
        if suivi.statut == "enregistre":
            suivi.statut = "en_route"
        if not suivi.sms_depart_envoye:
            _ajouter_notification(
                session,
                type_cible="suivi_familial",
                cible_id=suivi.id,
                type_evenement="depart",
                destinataire_role="parent",
                telephone=suivi.telephone_parent,
                message=construire_message_suivi_familial(
                    suivi.enfant_nom, "depart", lieu, suivi.enfant_age
                ),
            )
            suivi.sms_depart_envoye = True
    elif donnees.type_evenement == "arrivee":
        suivi.statut = "arrive"
        if not suivi.sms_arrivee_envoye:
            _ajouter_notification(
                session,
                type_cible="suivi_familial",
                cible_id=suivi.id,
                type_evenement="arrivee",
                destinataire_role="parent",
                telephone=suivi.telephone_parent,
                message=construire_message_suivi_familial(
                    suivi.enfant_nom, "arrivee", lieu, suivi.enfant_age
                ),
            )
            suivi.sms_arrivee_envoye = True
    elif donnees.type_evenement == "livraison":
        suivi.statut = "arrive"
    # « incident » : on trace sans changer le statut.

    # Le ticket suit le voyage (transit dès le départ).
    ticket = await obtenir_ticket_du_suivi(session, suivi)
    if ticket is not None:
        if donnees.type_evenement in ("depart", "arrivee"):
            ticket.statut = "en_transit"
        ticket.nb_scans = (ticket.nb_scans or 0) + 1
        if ticket.premier_scan_le is None:
            ticket.premier_scan_le = maintenant

    await session.commit()
    await session.refresh(suivi)
    await session.refresh(evenement)

    libelles = {
        "depart": "Départ enregistré.",
        "arrivee": "Arrivée enregistrée. Le parent a été prévenu.",
        "livraison": "Remise de l'enfant enregistrée.",
        "incident": "Incident signalé.",
    }
    return {
        "succes": True,
        "deja_enregistre": False,
        "message": libelles.get(donnees.type_evenement, "Événement enregistré."),
        "statut_suivi": suivi.statut,
        "suivi": suivi,
        "evenement": evenement,
    }


# ─── Suivi public (page /suivi/[code], sans connexion) ───────────────

async def _noms_gares(
    session: AsyncSession, ids: list[UUID | None]
) -> dict[UUID, str]:
    """Table ``{gare_id: « Nom (Ville) »}`` pour enrichir une timeline."""
    uniques = {i for i in ids if i is not None}
    if not uniques:
        return {}
    resultat = await session.execute(
        select(Gare.id, Gare.nom, Gare.ville).where(Gare.id.in_(uniques))
    )
    noms: dict[UUID, str] = {}
    for gare_id, nom, ville in resultat.all():
        noms[gare_id] = f"{nom} ({ville})" if ville else nom
    return noms


def _evenements_publics(evenements, noms: dict[UUID, str]):
    return [
        schemas.EvenementSuiviPublic(
            type_evenement=e.type_evenement,
            horodatage=e.horodatage,
            localisation=e.localisation,
            gare_nom=noms.get(e.gare_id),
        )
        for e in evenements
    ]


def _notifications_publiques(notifications: list[NotificationLogistique]):
    return [
        schemas.NotificationSuiviPublic(
            type_evenement=n.type_evenement,
            destinataire_role=n.destinataire_role,
            telephone_masque=masquer_telephone(n.telephone),
            message=n.message,
            envoye=n.envoye,
            cree_le=n.cree_le,
        )
        for n in notifications
    ]


def _nb_personnes_notifiees(notifications: list[NotificationLogistique]) -> int:
    return len({n.telephone for n in notifications if n.telephone and n.envoye})


async def _suivi_public_colis(
    session: AsyncSession, ticket: Ticket
) -> schemas.SuiviPublicResponse:
    colis = await session.get(Colis, ticket.reference_id) if ticket.reference_id else None
    if colis is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND,
                            detail="Aucun suivi trouvé pour ce code")
    evenements = await lister_evenements(session, colis.id)
    notifications = await lister_notifications(session, "colis", colis.id)
    noms = await _noms_gares(
        session,
        [colis.gare_depart_id, colis.gare_arrivee_id, *[e.gare_id for e in evenements]],
    )
    voyage = await session.get(Voyage, colis.voyage_id) if colis.voyage_id else None
    vehicule = await session.get(Vehicule, voyage.vehicule_id) if voyage else None
    return schemas.SuiviPublicResponse(
        type="colis",
        code=ticket.code_clair,
        statut=colis.statut,
        gare_depart_nom=noms.get(colis.gare_depart_id),
        gare_arrivee_nom=noms.get(colis.gare_arrivee_id),
        date_depart=voyage.date_depart if voyage else None,
        vehicule_immatriculation=vehicule.immatriculation if vehicule else None,
        nb_personnes_notifiees=_nb_personnes_notifiees(notifications),
        colis=schemas.ColisPublicInfo(
            destinataire_nom=colis.destinataire_nom,
            description=colis.description,
            poids_kg=colis.poids_kg,
            nombre_articles=colis.nombre_articles,
        ),
        evenements=_evenements_publics(evenements, noms),
        notifications=_notifications_publiques(notifications),
    )


async def _suivi_public_enfant(
    session: AsyncSession, ticket: Ticket
) -> schemas.SuiviPublicResponse:
    suivi = await session.get(SuiviFamilial, ticket.reference_id) if ticket.reference_id else None
    if suivi is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND,
                            detail="Aucun suivi trouvé pour ce code")
    evenements = await lister_evenements_suivi(session, suivi.id)
    notifications = await lister_notifications(session, "suivi_familial", suivi.id)
    noms = await _noms_gares(
        session,
        [suivi.gare_depart_id, suivi.gare_arrivee_id, *[e.gare_id for e in evenements]],
    )
    voyage = await session.get(Voyage, suivi.voyage_id) if suivi.voyage_id else None
    vehicule = await session.get(Vehicule, voyage.vehicule_id) if voyage else None
    return schemas.SuiviPublicResponse(
        type="enfant",
        code=ticket.code_clair,
        statut=suivi.statut,
        gare_depart_nom=noms.get(suivi.gare_depart_id),
        gare_arrivee_nom=noms.get(suivi.gare_arrivee_id),
        date_depart=voyage.date_depart if voyage else None,
        vehicule_immatriculation=vehicule.immatriculation if vehicule else None,
        nb_personnes_notifiees=_nb_personnes_notifiees(notifications),
        enfant=schemas.EnfantPublicInfo(
            enfant_nom=suivi.enfant_nom,
            enfant_age=suivi.enfant_age,
            enfant_sexe=suivi.enfant_sexe,
            parent_nom=suivi.parent_nom,
        ),
        evenements=_evenements_publics(evenements, noms),
        notifications=_notifications_publiques(notifications),
    )


async def construire_suivi_public(
    session: AsyncSession, code: str
) -> schemas.SuiviPublicResponse:
    """Vue publique d'un suivi (colis **ou** enfant) à partir de son code."""
    valeur = code.strip()
    ticket = await session.scalar(
        select(Ticket).where(Ticket.code_clair == valeur.upper())
    )
    if ticket is None:
        ticket = await session.scalar(select(Ticket).where(Ticket.qr_token == valeur))
    if ticket is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND,
                            detail="Aucun suivi trouvé pour ce code")
    if ticket.type == "ENFANT":
        return await _suivi_public_enfant(session, ticket)
    return await _suivi_public_colis(session, ticket)
