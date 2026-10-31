 # -*- coding: utf-8 -*-
"""Service logistique — logique métier du référentiel + colis de bout en bout."""
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import secrets
from urllib.parse import parse_qs, urlparse
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import (
    Gare, Ligne, ArretLigne, Vehicule, Voyage, ActeurLogistique, Domaine, Utilisateur,
    Ticket, Colis, ColisEvenement, ProfilLogistique,
    SuiviFamilial, SuiviFamilialEvenement, NotificationLogistique, Bagage,
)
from src.modeles.paiement import TransactionPaiement
from src.modules.logistique import schemas
from src.modules.gamification.service_notifications import creer_notification
from src.noyau import dechiffrer_donnee, journal
from src.noyau.constantes_roles import RoleUtilisateur
from src.noyau.telephone import hasher_telephone, normaliser_numero_tiers
from src.modules.qr_dynamique.service import (
    generer_token_durable,
    construire_url_qr_durable,
)
from src.noyau.notification import (
    envoyer_sms,
    construire_message_colis,
    construire_message_suivi_familial,
    construire_message_pre_alerte,
    masquer_telephone,
)
from src.config import parametres
from src.modules.logistique.stockage_colis import chemin_photo_colis
from src.modules.paiement.tarification import frais_service


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


async def _verifier_trajet_du_voyage(
    session: AsyncSession,
    voyage: Voyage,
    gare_depart_id: UUID,
    gare_arrivee_id: UUID,
) -> None:
    """Refuse un voyage dont la ligne ne dessert pas le trajet déclaré.

    Sans ce garde-fou, on pouvait affecter un colis Cotonou → Parakou à un car
    Parakou → Cotonou : le destinataire aurait attendu un colis parti à l'opposé.

    Les **arrêts intermédiaires** sont acceptés : un colis peut monter à Dassa
    et descendre à Parakou, ou monter à Cotonou et descendre à Bohicon. Seul
    l'ordre dans la tournée compte (départ avant arrivée).
    """
    ligne = await session.get(Ligne, voyage.ligne_id)
    if ligne is None:
        return
    try:
        ordre_depart = await _ordre_gare_sur_ligne(session, ligne, gare_depart_id)
        ordre_arrivee = await _ordre_gare_sur_ligne(session, ligne, gare_arrivee_id)
    except HTTPException:
        ordre_depart = ordre_arrivee = None
    if ordre_depart is not None and ordre_arrivee is not None and ordre_depart < ordre_arrivee:
        return
    depart = await session.get(Gare, ligne.gare_depart_id)
    arrivee = await session.get(Gare, ligne.gare_arrivee_id)
    raise HTTPException(
        status.HTTP_400_BAD_REQUEST,
        detail=(
            "Ce voyage ne correspond pas au trajet déclaré "
            f"({depart.nom if depart else '?'} → {arrivee.nom if arrivee else '?'})."
        ),
    )


# ─── Arrêts intermédiaires d'une ligne (tournée du car) ──────────────

# Position conventionnelle de la gare d'arrivée : après tous les arrêts.
ORDRE_TERMINUS = 10_000
# Rôles qui tiennent un guichet (périmètre de leurs enregistrements).
ROLES_GUICHET = (
    RoleUtilisateur.RECEVEUR.value,
    RoleUtilisateur.GERANT_GARE.value,
    RoleUtilisateur.COMMERCANT.value,
)
ROLES_GUICHET_SUIVI = (
    RoleUtilisateur.RECEVEUR.value,
)


async def lister_arrets(session: AsyncSession, ligne_id: UUID) -> list[ArretLigne]:
    """Arrêts d'une ligne, dans l'ordre de la tournée."""
    await _verifier_existe(session, Ligne, ligne_id, "Ligne")
    resultat = await session.execute(
        select(ArretLigne)
        .where(ArretLigne.ligne_id == ligne_id)
        .order_by(ArretLigne.ordre.asc())
    )
    return list(resultat.scalars().all())


async def creer_arret(
    session: AsyncSession, ligne_id: UUID, donnees: schemas.ArretLigneCreate
) -> ArretLigne:
    """Ajoute un arrêt intermédiaire à une ligne.

    On refuse une gare qui est déjà le départ ou le terminus de la ligne : elle
    y figure déjà, l'ajouter créerait deux positions pour le même point.
    """
    ligne = await _verifier_existe(session, Ligne, ligne_id, "Ligne")
    if donnees.gare_id in (ligne.gare_depart_id, ligne.gare_arrivee_id):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Cette gare est déjà le départ ou l'arrivée de la ligne.",
        )
    await _verifier_existe(session, Gare, donnees.gare_id, "Gare")
    if await session.scalar(
        select(ArretLigne.id).where(
            ArretLigne.ligne_id == ligne_id, ArretLigne.gare_id == donnees.gare_id
        )
    ):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Cette gare figure déjà parmi les arrêts de la ligne.",
        )
    if await session.scalar(
        select(ArretLigne.id).where(
            ArretLigne.ligne_id == ligne_id, ArretLigne.ordre == donnees.ordre
        )
    ):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"Un arrêt occupe déjà la position {donnees.ordre} sur cette ligne.",
        )
    arret = ArretLigne(ligne_id=ligne_id, **donnees.model_dump())
    session.add(arret)
    await session.commit()
    await session.refresh(arret)
    return arret


async def modifier_arret(
    session: AsyncSession, arret_id: UUID, donnees: schemas.ArretLigneUpdate
) -> ArretLigne:
    arret = await session.get(ArretLigne, arret_id)
    if arret is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Arrêt introuvable")
    valeurs = donnees.model_dump(exclude_unset=True)
    ligne = await _verifier_existe(session, Ligne, arret.ligne_id, "Ligne")
    if valeurs.get("gare_id") is not None:
        if valeurs["gare_id"] in (ligne.gare_depart_id, ligne.gare_arrivee_id):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="Cette gare est déjà le départ ou l'arrivée de la ligne.",
            )
        await _verifier_existe(session, Gare, valeurs["gare_id"], "Gare")
    ordre = valeurs.get("ordre", arret.ordre)
    if "ordre" in valeurs and await session.scalar(
        select(ArretLigne.id).where(
            ArretLigne.ligne_id == arret.ligne_id,
            ArretLigne.ordre == ordre,
            ArretLigne.id != arret.id,
        )
    ):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"Un arrêt occupe déjà la position {ordre} sur cette ligne.",
        )
    for champ, valeur in valeurs.items():
        setattr(arret, champ, valeur)
    await session.commit()
    await session.refresh(arret)
    return arret


async def supprimer_arret(session: AsyncSession, arret_id: UUID) -> None:
    arret = await session.get(ArretLigne, arret_id)
    if arret is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Arrêt introuvable")
    # Les colis/passagers déjà positionnés sur cet arrêt repassent au terminus
    # (liaison ON DELETE SET NULL), ils ne sont jamais supprimés avec l'arrêt.
    await session.delete(arret)
    await session.commit()


async def _ordre_gare_sur_ligne(
    session: AsyncSession, ligne: Ligne, gare_id: UUID
) -> int:
    """Position d'une gare dans la tournée : 0 = départ, grand = terminus."""
    if gare_id == ligne.gare_depart_id:
        return 0
    if gare_id == ligne.gare_arrivee_id:
        return ORDRE_TERMINUS
    arret = await session.scalar(
        select(ArretLigne).where(
            ArretLigne.ligne_id == ligne.id,
            ArretLigne.gare_id == gare_id,
            ArretLigne.actif.is_(True),
        )
    )
    if arret is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Cette gare ne figure pas sur le trajet de ce voyage.",
        )
    return arret.ordre


async def _verifier_arret_destination(
    session: AsyncSession,
    ligne: Ligne,
    arret_id: UUID,
    gare_depart_id: UUID,
) -> ArretLigne:
    """L'arrêt de descente doit appartenir à la ligne et suivre le départ.

    Un colis chargé à Cotonou ne peut pas « descendre » à Bohicon si le car va
    dans l'autre sens : la position de l'arrêt doit être **après** celle de la
    gare de départ (ou égale au terminus).
    """
    arret = await session.get(ArretLigne, arret_id)
    if arret is None or arret.ligne_id != ligne.id or arret.actif is False:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="L'arrêt de destination ne fait pas partie du trajet de ce voyage.",
        )
    depart = await _ordre_gare_sur_ligne(session, ligne, gare_depart_id)
    if arret.ordre <= depart:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="L'arrêt de destination doit se trouver après la gare de départ.",
        )
    return arret


async def _verifier_arret_du_voyage(
    session: AsyncSession,
    voyage: Voyage,
    arret_destination_id: UUID | None,
    gare_depart_id: UUID,
) -> None:
    """Contrôle l'arrêt de destination à l'affectation à un voyage."""
    if arret_destination_id is None:
        return
    ligne = await session.get(Ligne, voyage.ligne_id)
    if ligne is None:
        return
    await _verifier_arret_destination(
        session, ligne, arret_destination_id, gare_depart_id
    )


async def _gare_de_l_agent(
    session: AsyncSession, utilisateur_id: UUID
) -> UUID | None:
    """Gare de rattachement d'un agent logistique (périmètre du guichet)."""
    return await session.scalar(
        select(ActeurLogistique.gare_id).where(
            ActeurLogistique.utilisateur_id == utilisateur_id,
            ActeurLogistique.actif.is_(True),
        )
    )


def _est_guichet(utilisateur: Utilisateur | None) -> bool:
    return utilisateur is not None and utilisateur.role in ROLES_GUICHET


def exiger_acces_suivi_familial(utilisateur: Utilisateur) -> None:
    if utilisateur.role == RoleUtilisateur.COMMERCANT.value:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="L'espace commerçant ne donne pas accès au suivi des passagers.",
        )


def _exiger_gestion_suivi_familial(utilisateur: Utilisateur) -> None:
    if utilisateur.role not in ROLES_GUICHET_SUIVI and utilisateur.role not in (
        "super_admin",
        "super_administrateur",
    ):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Seul le guichet peut gérer les fiches de suivi des passagers.",
        )


def _est_chauffeur_role(utilisateur: Utilisateur | None) -> bool:
    return utilisateur is not None and utilisateur.role == RoleUtilisateur.CHAUFFEUR.value


def _exiger_fiche_modifiable(objet, utilisateur: Utilisateur) -> None:
    """Garde-fou de correction d'une fiche (colis ou passager).

    Trois verrous, dans l'ordre où le terrain les rencontre :
      * le chauffeur a confirmé la prise en charge → la fiche est figée ;
      * un chauffeur est déjà désigné → seul ce chauffeur (ou le guichet qui a
        enregistré) peut encore ajuster avant le départ ;
      * la fiche a été créée par un autre agent → elle ne se corrige pas à
        distance (chacun son guichet, pour que l'audit garde son sens).
    """
    if getattr(objet, "reception_confirmee_le", None) is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                "Le chauffeur a déjà confirmé la prise en charge : la fiche "
                "ne peut plus être modifiée."
            ),
        )
    statut = getattr(objet, "statut", None)
    if getattr(objet, "remis_guichet_le", None) is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                "Le chauffeur a déjà déposé cet enregistrement au guichet : "
                "la fiche est figée."
            ),
        )
    if statut in ("en_transit", "en_route", "arrive", "livre", "annule"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Cet enregistrement est déjà en route (ou terminé) : il est figé.",
        )
    if (
        _est_guichet(utilisateur)
        and objet.enregistre_par_id is not None
        and objet.enregistre_par_id != utilisateur.id
    ):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail=(
                "Seul l'agent qui a enregistré cette fiche peut la corriger."
            ),
        )
    # Un chauffeur ne corrige pas une fiche qu'il n'a pas lui-même créée : son
    # rôle est de conduire et de constater la prise en charge, pas de réécrire
    # les enregistrements du guichet. La correction d'une erreur qu'il a commise
    # en inscrivant un client en route reste possible tant que la fiche n'est
    # pas figée.
    if (
        _est_chauffeur_role(utilisateur)
        and objet.enregistre_par_id is not None
        and objet.enregistre_par_id != utilisateur.id
    ):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Un chauffeur ne peut pas modifier une fiche enregistrée par le guichet.",
        )


async def _libelle_voyage(session: AsyncSession, voyage: Voyage) -> str:
    """Libellé court d'un voyage pour la timeline (« 12/05 08:00 · DK-1234-AB »)."""
    vehicule = await session.get(Vehicule, voyage.vehicule_id)
    immatriculation = vehicule.immatriculation if vehicule else None
    quand = (
        voyage.date_depart.strftime("%d/%m %H:%M")
        if voyage.date_depart is not None
        else None
    )
    return " · ".join(partie for partie in (quand, immatriculation) if partie)


async def _encaisser_frais_service(
    session: AsyncSession,
    utilisateur: Utilisateur,
    *,
    moyen: str,
    telephone: str | None,
    colis_id: UUID | None = None,
    montant_fcfa: int | None = None,
    idempotency_key: str | None = None,
) -> dict:
    """Encaisse les frais de service **avant** de rendre le QR au client.

    Pour un colis, le barème dépend du nombre d'articles ; pour un passager, le
    frais est fixe. L'appel se fait dans la même transaction SQL que la fiche :
    un échec de paiement annule aussi le ticket (pas de QR gratuit).
    """
    from src.modules.paiement import schemas as schemas_paiement
    from src.modules.paiement import service as service_paiement

    if colis_id is not None:
        demande = schemas_paiement.TransactionCreate(
            type="COLIS",
            colis_id=colis_id,
            moyen=moyen,
            telephone=telephone,
            idempotency_key=f"colis:{colis_id}",
        )
    else:
        demande = schemas_paiement.TransactionCreate(
            type="PASSAGER",
            montant_fcfa=montant_fcfa or 0,
            moyen=moyen,
            telephone=telephone,
            idempotency_key=idempotency_key,
        )
    return await service_paiement.creer_transaction(
        session, demande, utilisateur, commit=False
    )


def _exiger_voyage_ouvert(voyage: Voyage) -> None:
    if voyage.statut in ("termine", "annule"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Impossible d'enregistrer un client sur un voyage terminé ou annulé.",
        )


async def _paginer(session: AsyncSession, requete, page: int, par_page: int):
    """Retourne (éléments, total) pour une requête paginée."""
    total = (await session.execute(
        select(func.count()).select_from(requete.subquery())
    )).scalar() or 0
    resultat = await session.execute(
        requete.offset((page - 1) * par_page).limit(par_page)
    )
    return list(resultat.scalars().all()), total


async def _creer_bagages(
    session: AsyncSession,
    nombre: int,
    gare: Gare,
    *,
    suivi_familial_id: UUID | None = None,
    colis_id: UUID | None = None,
) -> list[Bagage]:
    """Génère une **étiquette QR par sac** (1 à 10) en une seule fois.

    Chaque sac reçoit un ``Ticket`` (``type=BAGAGE``) et un numéro de série
    lisible « Sac i/N ». Le nombre de sacs n'a **aucun impact** sur le prix.
    """
    total = max(1, min(int(nombre), 10))
    bagages: list[Bagage] = []
    for position in range(1, total + 1):
        bagage = Bagage(
            suivi_familial_id=suivi_familial_id,
            colis_id=colis_id,
            numero_serie=f"Sac {position}/{total}",
            position=position,
            nombre_total=total,
            statut="attendu",
        )
        session.add(bagage)
        await session.flush()  # -> bagage.id
        ticket = Ticket(
            code_clair=await _generer_code_clair(session, gare, "SAC-"),
            qr_token=generer_token_durable(str(bagage.id)),
            type="BAGAGE",
            reference_id=bagage.id,
            statut="emis",
        )
        session.add(ticket)
        await session.flush()
        bagage.ticket_id = ticket.id
        bagages.append(bagage)
    return bagages


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
    ligne = Ligne(**donnees.model_dump(exclude={"arrets"}))
    session.add(ligne)
    await session.flush()  # -> ligne.id

    # Arrêts intermédiaires saisis avec le trajet : on refuse un doublon de
    # gare ou de position, comme le feraient les routes dédiées.
    gares_vues: set[UUID] = {ligne.gare_depart_id, ligne.gare_arrivee_id}
    ordres_vus: set[int] = set()
    for arret in donnees.arrets:
        if arret.gare_id in gares_vues:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="Une gare ne peut figurer qu'une fois sur un trajet.",
            )
        if arret.ordre in ordres_vus:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail=f"Deux arrêts ne peuvent pas occuper la position {arret.ordre}.",
            )
        await _verifier_existe(session, Gare, arret.gare_id, "Gare d'arrêt")
        gares_vues.add(arret.gare_id)
        ordres_vus.add(arret.ordre)
        session.add(
            ArretLigne(ligne_id=ligne.id, **arret.model_dump())
        )

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

async def creer_vehicule(session: AsyncSession, donnees: schemas.VehiculeCreate,
                         *, chauffeur_impose: UUID | None = None) -> Vehicule:
    """Enregistre un car (une plaque = un car, l'immatriculation est unique).

    ``chauffeur_impose`` : quand c'est un chauffeur qui enregistre son propre
    car, le serveur décide que le car lui appartient — il ne choisit jamais à
    qui il appartient. Dans ce cas, si la plaque est déjà au référentiel mais
    n'est affectée à personne, elle lui est attribuée (voir
    ``_reclamer_vehicule``).
    """
    if chauffeur_impose is not None:
        donnees = donnees.model_copy(update={"chauffeur_id": chauffeur_impose})
    if donnees.chauffeur_id is not None:
        await _verifier_chauffeur(session, donnees.chauffeur_id)
    if await session.scalar(
        select(Vehicule).where(Vehicule.immatriculation == donnees.immatriculation)
    ):
        if chauffeur_impose is not None:
            return await _reclamer_vehicule(
                session, donnees.immatriculation, chauffeur_impose
            )
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
                           est_actif: bool | None = None,
                           chauffeur_id: UUID | None = None):
    requete = select(Vehicule)
    if est_actif is not None:
        requete = requete.where(Vehicule.actif == est_actif)
    if chauffeur_id is not None:
        requete = requete.where(Vehicule.chauffeur_id == chauffeur_id)
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


# ─── Cars d'un chauffeur : qui voit / utilise quel car ───────────────
# Règle métier : un car appartient à un chauffeur. Quand il planifie un départ,
# il ne doit voir — et ne peut choisir — que les siens ; sinon il engage le car
# d'un autre et les SMS partent sur le mauvais nom. Deux sources d'appartenance :
#   1. l'affectation faite par le guichet (`vehicules.chauffeur_id`) ;
#   2. la plaque déclarée par le chauffeur dans son dossier professionnel
#      (`profils_logistiques.vehicule_immatriculation`).
# Le guichet, lui, garde la vue complète : c'est lui qui affecte.

def normaliser_immatriculation(texte: str | None) -> str:
    """« ab-1234 xx » → « AB1234XX » : deux saisies d'une même plaque se rejoignent."""
    if not texte:
        return ""
    return "".join(caractere for caractere in texte.upper() if caractere.isalnum())


async def _verifier_chauffeur(session: AsyncSession, chauffeur_id: UUID) -> Utilisateur:
    """Le compte destiné à conduire doit exister et être un chauffeur reconnu.

    Deux preuves acceptées (le terrain n'a pas toujours les deux) : la fiche
    d'acteur logistique « chauffeur », ou le dossier professionnel de type
    « chauffeur ». Cela évite d'exiger un identifiant technique au guichet.
    """
    utilisateur = await session.get(Utilisateur, chauffeur_id)
    if utilisateur is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Chauffeur introuvable")
    acteur = await session.scalar(
        select(ActeurLogistique).where(
            ActeurLogistique.utilisateur_id == chauffeur_id,
            ActeurLogistique.role == "chauffeur",
            ActeurLogistique.actif.is_(True),
        )
    )
    profil = await session.scalar(
        select(ProfilLogistique).where(
            ProfilLogistique.utilisateur_id == chauffeur_id,
            ProfilLogistique.type_profil == "chauffeur",
        )
    )
    if acteur is None and profil is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=(
                "Ce compte n'est pas reconnu comme chauffeur : créez d'abord sa "
                "fiche de chauffeur (acteur logistique) ou faites-lui déclarer "
                "son dossier professionnel."
            ),
        )
    return utilisateur


async def vehicules_autorises_pour_chauffeur(
    session: AsyncSession, utilisateur_id: UUID
) -> list[Vehicule]:
    """Les cars qu'un chauffeur peut voir et utiliser (voir règle en tête de bloc)."""
    profil = await session.scalar(
        select(ProfilLogistique).where(ProfilLogistique.utilisateur_id == utilisateur_id)
    )
    plaque_declaree = normaliser_immatriculation(
        profil.vehicule_immatriculation if profil is not None else None
    )

    # Le référentiel roulant est volontairement petit (quelques dizaines de cars) :
    # on filtre en mémoire, la comparaison de plaques restant robuste aux espaces
    # et aux tirets (« AB 1234 XX » = « AB-1234-XX »).
    vehicules = (
        await session.execute(select(Vehicule).order_by(Vehicule.immatriculation))
    ).scalars().all()
    return [
        vehicule
        for vehicule in vehicules
        if vehicule.chauffeur_id == utilisateur_id
        or (
            plaque_declaree
            and normaliser_immatriculation(vehicule.immatriculation) == plaque_declaree
        )
    ]


async def verifier_vehicule_du_chauffeur(
    session: AsyncSession, vehicule_id: UUID, utilisateur_id: UUID
) -> Vehicule:
    """Garde-fou serveur : un chauffeur n'engage que SES cars.

    La liste filtrée côté API ne protège pas d'un appel direct : l'appartenance
    est donc re-vérifiée ici, au moment de l'écriture (planifier ou ajuster un
    départ, modifier un car).
    """
    vehicule = await obtenir_vehicule(session, vehicule_id)
    autorises = await vehicules_autorises_pour_chauffeur(session, utilisateur_id)
    if vehicule.id not in {autorise.id for autorise in autorises}:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail=(
                f"Le car {vehicule.immatriculation} ne vous est pas affecté. "
                "Demandez au gérant de gare (ou au receveur) de l'affecter à "
                "votre compte."
            ),
        )
    return vehicule


async def affecter_vehicule(
    session: AsyncSession, vehicule_id: UUID, chauffeur_id: UUID | None
) -> Vehicule:
    """Affecte un car à un chauffeur (ou le retire : ``chauffeur_id = None``)."""
    vehicule = await obtenir_vehicule(session, vehicule_id)
    if chauffeur_id is not None:
        await _verifier_chauffeur(session, chauffeur_id)
    vehicule.chauffeur_id = chauffeur_id
    await session.commit()
    await session.refresh(vehicule)
    return vehicule


async def _reclamer_vehicule(
    session: AsyncSession, immatriculation: str, chauffeur_id: UUID
) -> Vehicule:
    """Un chauffeur qui redéclare sa plaque récupère son car s'il n'est à personne.

    Cas réel : le super-admin a inscrit la flotte sans savoir qui conduit quoi.
    Le chauffeur enregistre sa plaque → elle devient la sienne (tracé), au lieu
    d'un échec « ce véhicule existe déjà » qui le bloquerait. Si la plaque
    appartient déjà à quelqu'un d'autre, on refuse : un car ne se prend pas.
    """
    vehicule = await session.scalar(
        select(Vehicule).where(Vehicule.immatriculation == immatriculation)
    )
    if vehicule is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Véhicule introuvable")
    if vehicule.chauffeur_id == chauffeur_id:
        return vehicule
    if vehicule.chauffeur_id is not None:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail=(
                f"Le car {vehicule.immatriculation} est déjà affecté à un autre "
                "chauffeur. Voyez le gérant de gare ou le receveur."
            ),
        )
    vehicule.chauffeur_id = chauffeur_id
    await session.commit()
    await session.refresh(vehicule)
    return vehicule


# ─── Voyages ─────────────────────────────────────────────────────────

async def creer_voyage(session: AsyncSession, donnees: schemas.VoyageCreate) -> Voyage:
    await _verifier_existe(session, Ligne, donnees.ligne_id, "Ligne")
    await _verifier_existe(session, Vehicule, donnees.vehicule_id, "Véhicule")
    if donnees.chauffeur_id is not None:
        await _verifier_existe(session, Utilisateur, donnees.chauffeur_id, "Chauffeur")
    _verifier_date_depart(donnees.date_depart)
    await _verifier_doublon_voyage(
        session, donnees.ligne_id, donnees.date_depart
    )
    if donnees.chauffeur_id is not None:
        await _verifier_conflit_chauffeur(
            session,
            donnees.chauffeur_id,
            donnees.date_depart,
            donnees.date_arrivee,
            donnees.ligne_id,
        )
    voyage = Voyage(**donnees.model_dump())
    session.add(voyage)
    await session.commit()
    await session.refresh(voyage)
    return voyage


async def _verifier_doublon_voyage(
    session: AsyncSession, ligne_id: UUID, date_depart: datetime
) -> None:
    """Empêche deux départs actifs identiques sur la même ligne et au même horaire."""
    requete = select(Voyage).where(
        Voyage.ligne_id == ligne_id,
        Voyage.date_depart == date_depart,
        Voyage.statut.in_(("planifie", "en_cours")),
    )
    doublon = (await session.execute(requete)).scalars().first()
    if doublon is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                "Un départ est déjà planifié sur ce trajet à cette heure. "
                "Choisissez un autre horaire."
            ),
        )


async def _duree_prevue_minutes(
    session: AsyncSession, ligne_id: UUID, date_depart: datetime, date_arrivee: datetime | None
) -> int:
    if date_arrivee is not None and date_arrivee > date_depart:
        return int((date_arrivee - date_depart).total_seconds() // 60)
    ligne = await session.get(Ligne, ligne_id)
    if ligne is not None and ligne.duree_min and ligne.duree_min > 0:
        return int(ligne.duree_min)
    return 120  # durée par défaut d'un trajet interurbain


def _en_utc(valeur: datetime) -> datetime:
    return valeur if valeur.tzinfo is not None else valeur.replace(tzinfo=timezone.utc)


async def _verifier_conflit_chauffeur(
    session: AsyncSession,
    chauffeur_id: UUID,
    date_depart: datetime | None,
    date_arrivee: datetime | None,
    ligne_id: UUID,
    *,
    exclure_voyage_id: UUID | None = None,
) -> None:
    """Un chauffeur ne peut pas conduire deux départs en même temps.

    Deux trajets différents à la même heure le même jour sont impossibles : on
    refuse le chevauchement des plages horaires (durée de la ligne, ou 2 h par
    défaut quand elle n'est pas renseignée).
    """
    if date_depart is None:
        return
    debut = _en_utc(date_depart)
    fin = debut + timedelta(
        minutes=await _duree_prevue_minutes(session, ligne_id, debut, date_arrivee)
    )
    requete = select(Voyage).where(
        Voyage.chauffeur_id == chauffeur_id,
        Voyage.statut.in_(("planifie", "en_cours")),
    )
    if exclure_voyage_id is not None:
        requete = requete.where(Voyage.id != exclure_voyage_id)
    for autre in (await session.execute(requete)).scalars().all():
        if autre.date_depart is None:
            continue
        autre_debut = _en_utc(autre.date_depart)
        autre_fin = autre_debut + timedelta(
            minutes=await _duree_prevue_minutes(
                session, autre.ligne_id, autre_debut, autre.date_arrivee
            )
        )
        if debut < autre_fin and autre_debut < fin:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail=(
                    "Ce chauffeur a déjà un départ sur ce créneau "
                    f"({autre_debut.strftime('%d/%m %H:%M')}). "
                    "Choisissez un autre horaire."
                ),
            )


def _verifier_date_depart(date_depart: datetime | None) -> None:
    """Interdit de programmer un départ dans le passé.

    Règle terrain : on ne planifie pas un car qui est déjà parti. On tolère
    quelques minutes de décalage (montre du téléphone, saisie au guichet) pour
    ne pas bloquer un agent qui enregistre « maintenant ».
    """
    if date_depart is None:
        return
    reference = date_depart
    if reference.tzinfo is None:
        reference = reference.replace(tzinfo=timezone.utc)
    if reference < datetime.now(timezone.utc) - timedelta(minutes=5):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="La date de départ ne peut pas être dans le passé.",
        )


async def obtenir_voyage(session: AsyncSession, voyage_id: UUID) -> Voyage:
    voyage = await session.get(Voyage, voyage_id)
    if voyage is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Voyage introuvable")
    return voyage


async def lister_voyages(session: AsyncSession, page: int, par_page: int,
                         statut: str | None = None,
                         chauffeur_id: UUID | None = None,
                         ligne_id: UUID | None = None,
                         a_partir_de: datetime | None = None,
                         utilisateur: Utilisateur | None = None):
    """Liste des voyages, filtrable par chauffeur, ligne et date.

    Ces filtres servent trois usages concrets :
      - le chauffeur : « mes voyages » (il choisit son jour et son trajet) ;
      - le guichet : « les cars de ce chauffeur sur ce trajet » à l'attribution ;
      - le public : « les prochains départs » (page citoyens).
    Avec ``a_partir_de``, on trie du **prochain** départ au plus lointain ;
    sinon du plus récent au plus ancien.

    Un chauffeur ne voit que ses propres départs : le filtre est appliqué côté
    serveur, un appel direct avec un autre ``chauffeur_id`` ne contourne donc
    pas la règle.
    """
    requete = select(Voyage)
    if statut is not None:
        requete = requete.where(Voyage.statut == statut)
    if _est_chauffeur_role(utilisateur):
        requete = requete.where(Voyage.chauffeur_id == utilisateur.id)
    elif chauffeur_id is not None:
        requete = requete.where(Voyage.chauffeur_id == chauffeur_id)
    # Le guichet ne pilote que les départs qui touchent sa gare : inutile (et
    # contraire au cloisonnement) de lui montrer les cars des autres gares.
    if _est_guichet(utilisateur):
        perimetre = await _gare_de_l_agent(session, utilisateur.id)
        if perimetre is not None:
            requete = requete.join(Ligne, Voyage.ligne_id == Ligne.id).where(
                or_(
                    Ligne.gare_depart_id == perimetre,
                    Ligne.gare_arrivee_id == perimetre,
                )
            )
    if ligne_id is not None:
        requete = requete.where(Voyage.ligne_id == ligne_id)
    if a_partir_de is not None:
        requete = requete.where(Voyage.date_depart >= a_partir_de)
        requete = requete.order_by(Voyage.date_depart.asc())
    else:
        requete = requete.order_by(Voyage.date_depart.desc())
    return await _paginer(session, requete, page, par_page)


# Un voyage « actif » peut encore recevoir des colis / passagers.
STATUTS_VOYAGE_ACTIFS = ("planifie", "en_cours")


async def lister_chauffeurs_pour_trajet(
    session: AsyncSession,
    *,
    gare_id: UUID | None = None,
    ligne_id: UUID | None = None,
    utilisateur_id: UUID | None = None,
) -> list[ActeurLogistique]:
    """Chauffeurs proposables pour un trajet (« qui peut conduire ceci ? »).

    Deux populations, réunies : les chauffeurs **rattachés à la gare de départ**
    et ceux qui ont **déjà un voyage sur cette ligne**. Personne n'a à connaître
    un identifiant technique : la liste vient au guichet.
    """
    conditions = []
    if gare_id is not None:
        conditions.append(ActeurLogistique.gare_id == gare_id)
    if ligne_id is not None:
        chauffeurs_de_la_ligne = select(Voyage.chauffeur_id).where(
            Voyage.ligne_id == ligne_id,
            Voyage.chauffeur_id.is_not(None),
            Voyage.statut.in_(STATUTS_VOYAGE_ACTIFS),
        )
        conditions.append(ActeurLogistique.utilisateur_id.in_(chauffeurs_de_la_ligne))

    requete = select(ActeurLogistique).where(
        ActeurLogistique.role == "chauffeur",
        ActeurLogistique.actif.is_(True),
    )
    if utilisateur_id is not None:
        # Recherche ciblée (fiche retrouvée par QR / code) : pas de filtre trajet.
        requete = requete.where(ActeurLogistique.utilisateur_id == utilisateur_id)
    elif conditions:
        requete = requete.where(or_(*conditions))
    return list(await session.scalars(requete.limit(300)))


async def prochains_departs_par_chauffeur(
    session: AsyncSession, chauffeur_ids: list[UUID]
) -> dict[UUID, datetime]:
    """Prochain départ de chaque chauffeur (voyage planifié ou en cours)."""
    if not chauffeur_ids:
        return {}
    resultat = await session.execute(
        select(Voyage.chauffeur_id, func.min(Voyage.date_depart))
        .where(
            Voyage.chauffeur_id.in_(chauffeur_ids),
            Voyage.statut.in_(STATUTS_VOYAGE_ACTIFS),
            Voyage.date_depart >= datetime.now(timezone.utc),
        )
        .group_by(Voyage.chauffeur_id)
    )
    return {ligne[0]: ligne[1] for ligne in resultat.all()}


async def modifier_voyage(session: AsyncSession, voyage_id: UUID,
                          donnees: schemas.VoyageUpdate) -> Voyage:
    voyage = await obtenir_voyage(session, voyage_id)
    valeurs = donnees.model_dump(exclude_unset=True)
    if valeurs.get("vehicule_id") is not None:
        await _verifier_existe(session, Vehicule, valeurs["vehicule_id"], "Véhicule")
    if "chauffeur_id" in valeurs and valeurs["chauffeur_id"] is not None:
        await _verifier_existe(session, Utilisateur, valeurs["chauffeur_id"], "Chauffeur")
    if "date_depart" in valeurs:
        _verifier_date_depart(valeurs["date_depart"])
    # Annulation : uniquement un départ encore « planifié ». Un car en route
    # (ou déjà terminé) ne s'annule pas — les colis/passagers à bord en dépendent.
    if valeurs.get("statut") == "annule" and voyage.statut != "planifie":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                f"Ce voyage est « {voyage.statut} » : on ne peut plus l'annuler. "
                "Terminez le trajet ou contactez le gérant de gare."
            ),
        )
    # Un car déjà parti ne se replanifie pas dans le passé (l'historique de
    # suivi et les SMS déjà envoyés perdraient leur sens).
    if voyage.statut in ("en_cours", "termine", "annule") and "date_depart" in valeurs:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Ce départ a déjà eu lieu (ou est annulé) : sa date est figée.",
        )
    chauffeur_final = valeurs.get("chauffeur_id", voyage.chauffeur_id)
    if (
        chauffeur_final is not None
        and voyage.statut in ("planifie", "en_cours")
        and valeurs.get("statut", voyage.statut) != "annule"
        and any(
            champ in valeurs
            for champ in ("date_depart", "date_arrivee", "chauffeur_id", "ligne_id")
        )
    ):
        await _verifier_conflit_chauffeur(
            session,
            chauffeur_final,
            valeurs.get("date_depart", voyage.date_depart),
            valeurs.get("date_arrivee", voyage.date_arrivee),
            valeurs.get("ligne_id", voyage.ligne_id),
            exclure_voyage_id=voyage.id,
        )
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


async def _compte_par_telephone(
    session: AsyncSession, telephone: str | None
) -> Utilisateur | None:
    if not telephone:
        return None
    try:
        telephone_normalise = normaliser_numero_tiers(telephone)
    except ValueError:
        return None
    if not telephone_normalise or not telephone_normalise.startswith("+229"):
        return None
    return await session.scalar(
        select(Utilisateur).where(
            Utilisateur.telephone_hash == hasher_telephone(telephone_normalise),
            Utilisateur.est_actif.is_(True),
        )
    )


async def _notifier_comptes_colis(
    session: AsyncSession,
    colis: Colis,
    titre: str,
    message: str,
    acteur_id: UUID | None = None,
    code_clair: str | None = None,
) -> None:
    identifiants = {
        identifiant
        for identifiant in (colis.expediteur_id, colis.destinataire_id, acteur_id)
        if identifiant is not None
    }
    if colis.destinataire_id is None:
        destinataire = await _compte_par_telephone(session, colis.destinataire_tel)
        if destinataire is not None:
            identifiants.add(destinataire.id)
            colis.destinataire_id = destinataire.id

    if not identifiants:
        return

    utilisateurs = await session.scalars(
        select(Utilisateur).where(Utilisateur.id.in_(identifiants))
    )
    lien = f"/suivi/{code_clair}" if code_clair else f"/horaires?colis={colis.id}"
    for utilisateur in utilisateurs:
        await creer_notification(
            session,
            utilisateur,
            type_notification="info",
            categorie="logistique_colis",
            titre=titre,
            message=message,
            lien_action=lien,
        )


async def preparer_code_remise(
    session: AsyncSession,
    colis: Colis,
    ticket: Ticket,
    *,
    renouveller: bool = False,
) -> datetime:
    """Génère un code à quatre chiffres et notifie le destinataire."""
    maintenant = datetime.now(timezone.utc)
    if (
        not renouveller
        and colis.code_remise_hash
        and colis.code_remise_expire_le
        and colis.code_remise_expire_le > maintenant
    ):
        return colis.code_remise_expire_le

    code = f"{secrets.randbelow(10000):04d}"
    expire_le = maintenant + timedelta(
        seconds=parametres.duree_validite_code_remise_secondes
    )
    colis.code_remise_hash = hashlib.sha256(code.encode("ascii")).hexdigest()
    colis.code_remise_expire_le = expire_le
    colis.code_remise_tentatives = 0
    session.add(
        ColisEvenement(
            colis_id=colis.id,
            type_evenement="code_remise_genere",
            horodatage=maintenant,
        )
    )
    message = (
        f"Votre code de remise du colis {ticket.code_clair} est {code}. "
        "Ne le communiquez qu'au livreur présent devant vous."
    )
    await _notifier_comptes_colis(
        session,
        colis,
        "Code de remise du colis",
        message,
        code_clair=ticket.code_clair,
    )
    await session.commit()
    await session.refresh(colis)
    return expire_le


async def confirmer_remise_colis(
    session: AsyncSession,
    colis_id: UUID,
    code: str,
    utilisateur: Utilisateur,
) -> Colis:
    """Valide la remise finale uniquement avec le code du destinataire."""
    colis = await obtenir_colis(session, colis_id)
    if colis.statut == "livre":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Ce colis est déjà livré.")
    if colis.statut != "arrive":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Le code ne peut être validé qu'après l'arrivée du colis.",
        )
    if utilisateur.id not in {
        colis.chauffeur_id,
        colis.receveur_id,
        colis.remis_guichet_a_id,
    } and utilisateur.role not in ("gerant_gare", "super_administrateur"):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Vous n'êtes pas autorisé à constater cette remise.",
        )
    maintenant = datetime.now(timezone.utc)
    if not colis.code_remise_hash or not colis.code_remise_expire_le:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Aucun code de remise actif.")
    if colis.code_remise_expire_le <= maintenant:
        raise HTTPException(status.HTTP_410_GONE, detail="Le code de remise a expiré.")
    if colis.code_remise_tentatives >= parametres.nombre_max_tentatives_code_remise:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail="Trop de tentatives.")

    colis.code_remise_tentatives += 1
    hash_code = hashlib.sha256(code.encode("ascii")).hexdigest()
    if not hmac.compare_digest(colis.code_remise_hash, hash_code):
        await session.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Code de remise incorrect.")

    colis.code_remise_confirme_le = maintenant
    colis.code_remise_hash = None
    colis.code_remise_expire_le = None
    colis.statut = "livre"
    colis.livre_le = maintenant
    ticket = await obtenir_ticket_du_colis(session, colis)
    if ticket is not None:
        ticket.statut = "livre"
    session.add(
        ColisEvenement(
            colis_id=colis.id,
            type_evenement="code_remise_confirme",
            acteur_id=utilisateur.id,
            horodatage=maintenant,
        )
    )
    evenement_livraison = ColisEvenement(
        colis_id=colis.id,
        type_evenement="livraison",
        acteur_id=utilisateur.id,
        horodatage=maintenant,
    )
    session.add(evenement_livraison)
    if ticket is not None:
        await _notifier_scan_colis(session, colis, ticket, "livraison", None)
    await _notifier_comptes_colis(
        session,
        colis,
        "Colis livré",
        f"Le colis {ticket.code_clair if ticket else colis.id} a été remis après validation du code.",
    )
    await session.commit()
    await session.refresh(colis)
    return colis


async def creer_colis(
    session: AsyncSession,
    donnees: schemas.ColisCreate,
    utilisateur: Utilisateur,
    id_local: str | None = None,
) -> tuple[Colis, Ticket]:
    """Enregistre un colis et génère son ticket (QR + numéro en clair)."""
    if utilisateur.role == RoleUtilisateur.GERANT_GARE.value:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Le gérant supervise la gare ; l'enregistrement des colis est réservé au receveur ou au commerçant.",
        )
    # L'arrêt de destination, s'il est précisé, **est** la gare d'arrivée du
    # colis : on la dérive du référentiel (le guichet ne la ressaisit pas et ne
    # peut donc pas la contredire).
    arret_destination_id = donnees.arret_destination_id
    gare_arrivee_id = donnees.gare_arrivee_id
    if arret_destination_id is not None:
        arret = await session.get(ArretLigne, arret_destination_id)
        if arret is None or arret.actif is False:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, detail="Arrêt de destination introuvable"
            )
        gare_arrivee_id = arret.gare_id
    if donnees.gare_depart_id == gare_arrivee_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail="Les gares de départ et d'arrivée doivent être différentes")
    gare_depart = await _verifier_existe(session, Gare, donnees.gare_depart_id, "Gare de départ")
    await _verifier_existe(session, Gare, gare_arrivee_id, "Gare d'arrivée")
    # Attribution obligatoire : chauffeur précis + voyage précis.
    # Attribution **souple au guichet** : on enregistre souvent le colis avant de
    # savoir quel car partira. Le voyage (et donc le chauffeur) peut alors être
    # affecté plus tard, depuis la fiche — voir ``affecter_colis``. Un chauffeur
    # qui enregistre « en route », lui, connaît forcément son voyage.
    voyage = None
    if donnees.voyage_id is not None:
        voyage = await _verifier_existe(session, Voyage, donnees.voyage_id, "Voyage")
        _exiger_voyage_ouvert(voyage)
        if arret_destination_id is not None:
            # Le trajet se juge sur l'arrêt (position dans la ligne) et non sur
            # le terminus : un colis peut descendre avant la fin de la ligne.
            ligne = await session.get(Ligne, voyage.ligne_id)
            if ligne is not None:
                # On accepte aussi une montée **à un arrêt intermédiaire** :
                # il suffit que le départ précède la descente dans la tournée.
                await _ordre_gare_sur_ligne(session, ligne, donnees.gare_depart_id)
            await _verifier_arret_du_voyage(
                session, voyage, arret_destination_id, donnees.gare_depart_id
            )
        else:
            await _verifier_trajet_du_voyage(
                session, voyage, donnees.gare_depart_id, gare_arrivee_id
            )

    # ─── Enregistrement direct (le chauffeur inscrit son client en route) ──
    # Sécurité : seul le chauffeur réellement affecté au voyage (ou désigné) peut
    # déclarer un enregistrement « direct » — un receveur ne peut pas se faire
    # passer pour le chauffeur pour s'attribuer un colis.
    if donnees.enregistrement_direct:
        if voyage is None or (
            voyage.chauffeur_id is not None and voyage.chauffeur_id != utilisateur.id
        ):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="Seul le chauffeur du voyage peut enregistrer un client en direct",
            )
        chauffeur_id = utilisateur.id
        mode_enregistrement = "chauffeur_direct"
        statut_initial = "enregistre_direct"
    else:
        # Sans voyage, on peut tout de même désigner le chauffeur à la main ;
        # sinon la fiche reste « à affecter » jusqu'à complétion par un receveur.
        chauffeur_id = donnees.chauffeur_id or (voyage.chauffeur_id if voyage else None)
        mode_enregistrement = "guichet"
        statut_initial = "enregistre"

    chauffeur = (
        await _verifier_existe(session, Utilisateur, chauffeur_id, "Chauffeur")
        if chauffeur_id is not None
        else None
    )
    if (
        voyage is not None
        and chauffeur is not None
        and voyage.chauffeur_id
        and voyage.chauffeur_id != chauffeur.id
    ):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Le chauffeur indiqué ne correspond pas au chauffeur du voyage",
        )
    expediteur = (
        await _verifier_existe(session, Utilisateur, donnees.expediteur_id, "Expéditeur")
        if donnees.expediteur_id is not None
        else await _compte_par_telephone(session, donnees.expediteur_tel)
    )
    destinataire = (
        await _verifier_existe(session, Utilisateur, donnees.destinataire_id, "Destinataire")
        if donnees.destinataire_id is not None
        else await _compte_par_telephone(session, donnees.destinataire_tel)
    )
    mode_commercant = (
        utilisateur.role == RoleUtilisateur.CITOYEN
        and utilisateur.mode_commercant_actif
    )
    transaction_suivi = None
    if mode_commercant:
        if donnees.paiement_reference is None or donnees.payeur_id is None:
            raise HTTPException(
                status.HTTP_402_PAYMENT_REQUIRED,
                detail="Payez les frais de suivi avant de valider le dépôt.",
            )
        transaction_suivi = await session.scalar(
            select(TransactionPaiement).where(
                TransactionPaiement.reference == donnees.paiement_reference
            )
        )
        prefixe_paiement = f"mode-commercant:{utilisateur.id}:"
        if (
            transaction_suivi is not None
            and transaction_suivi.type == "COLIS"
            and transaction_suivi.colis_id is not None
            and (transaction_suivi.idempotency_key or "").startswith(
                prefixe_paiement
            )
        ):
            colis_existant = await session.get(Colis, transaction_suivi.colis_id)
            if (
                colis_existant is not None
                and colis_existant.enregistre_par_id == utilisateur.id
            ):
                ticket_existant = await session.get(Ticket, colis_existant.ticket_id)
                if ticket_existant is not None:
                    return colis_existant, ticket_existant
        montant_attendu = frais_service(donnees.nombre_articles).frais_fcfa
        if (
            transaction_suivi is None
            or transaction_suivi.type != "API"
            or transaction_suivi.statut != "reussi"
            or transaction_suivi.payeur_id != donnees.payeur_id
            or transaction_suivi.montant_fcfa != montant_attendu
            or transaction_suivi.frais_plateforme != montant_attendu
            or transaction_suivi.moyen != donnees.moyen_paiement
            or transaction_suivi.telephone != donnees.telephone_paiement
            or not (transaction_suivi.idempotency_key or "").startswith(
                f"mode-commercant:{utilisateur.id}:"
            )
        ):
            raise HTTPException(
                status.HTTP_402_PAYMENT_REQUIRED,
                detail="Le paiement des frais de suivi doit être confirmé avant validation.",
            )
    if expediteur is not None and donnees.expediteur_tel and (
        expediteur.telephone_hash != hasher_telephone(donnees.expediteur_tel)
    ):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Le DigiID de l'expéditeur ne correspond pas au téléphone saisi.",
        )
    if destinataire is not None and (
        destinataire.telephone_hash != hasher_telephone(donnees.destinataire_tel)
    ):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Le DigiID du destinataire ne correspond pas au téléphone saisi.",
        )
    if donnees.receveur_id is not None:
        await _verifier_existe(session, Utilisateur, donnees.receveur_id, "Receveur")

    receveur_id = None if mode_commercant else (donnees.receveur_id or utilisateur.id)

    colis = Colis(
        # Cle d'idempotence du mode hors-ligne, ecrite dans la MEME transaction
        # que le colis : sinon un colis committe sans id_local peut etre recree
        # en double au rejeu de la file locale.
        id_local=id_local,
        expediteur_id=expediteur.id if expediteur else None,
        expediteur_nom=(donnees.expediteur_nom or "").strip() or None,
        expediteur_tel=(donnees.expediteur_tel or "").strip() or None,
        destinataire_nom=donnees.destinataire_nom.strip(),
        destinataire_tel=donnees.destinataire_tel.strip(),
        destinataire_id=destinataire.id if destinataire else None,
        description=donnees.description,
        poids_kg=donnees.poids_kg,
        valeur_fcfa=donnees.valeur_fcfa,
        nombre_articles=donnees.nombre_articles,
        nombre_bagages=max(1, min(int(donnees.nombre_bagages or 1), 10)),
        gare_depart_id=donnees.gare_depart_id,
        gare_arrivee_id=gare_arrivee_id,
        arret_destination_id=arret_destination_id,
        voyage_id=donnees.voyage_id,
        receveur_id=receveur_id,
        chauffeur_id=chauffeur_id,
        statut=statut_initial,
        mode_enregistrement=mode_enregistrement,
        enregistre_par_id=utilisateur.id,
        frais_fcfa=donnees.frais_fcfa,
        moyen_paiement=donnees.moyen_paiement,
    )
    session.add(colis)
    await session.flush()  # -> colis.id disponible

    # Étiquettes QR : une par sac (traçabilité + anti-fraude à l'arrivée).
    await _creer_bagages(
        session, colis.nombre_bagages, gare_depart, colis_id=colis.id
    )

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

    if transaction_suivi is not None:
        transaction_suivi.type = "COLIS"
        transaction_suivi.colis_id = colis.id
        transaction_suivi.beneficiaire_id = None
        transaction_suivi.commission_receveur = 0
        transaction_suivi.montant_net = 0
    else:
        # Paiement **avant remise du QR** : espèces = encaissé tout de suite ;
        # Mobile money = en attente ; les moyens opérateur restent simulés jusqu'à
        # l'intégration de leurs API.
        await _encaisser_frais_service(
            session,
            utilisateur,
            moyen=donnees.moyen_paiement,
            telephone=donnees.telephone_paiement,
            colis_id=colis.id,
        )

    evenement = ColisEvenement(
        colis_id=colis.id,
        type_evenement="enregistrement",
        acteur_id=utilisateur.id,
        gare_id=donnees.gare_depart_id,
        horodatage=datetime.now(timezone.utc),
    )
    session.add(evenement)
    await _notifier_comptes_colis(
        session,
        colis,
        "Colis enregistré",
        f"Le colis {ticket.code_clair} a été enregistré. Touchez pour consulter le ticket.",
        acteur_id=utilisateur.id,
    )

    await session.commit()
    await session.refresh(colis)
    await session.refresh(ticket)
    return colis, ticket


# ─── Colis : lecture ─────────────────────────────────────────────────

async def affecter_colis(
    session: AsyncSession,
    colis_id: UUID,
    donnees: schemas.AffectationRequest,
    utilisateur: Utilisateur,
) -> Colis:
    """Affecte (ou réaffecte) un colis à un voyage et à son chauffeur.

    Réponse directe au terrain : au guichet, on enregistre un colis **avant** de
    savoir quel car partira. Le receveur revient sur la fiche, désigne le voyage
    — et le chauffeur en découle (c'est celui du voyage).
    """
    colis = await obtenir_colis(session, colis_id)
    if colis.statut in ("livre", "annule"):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Un colis livré ou annulé ne peut plus être réaffecté",
        )
    if colis.reception_confirmee_le is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                "Le chauffeur a déjà confirmé la prise en charge : le colis ne "
                "peut plus changer de voyage."
            ),
        )

    voyage = await _verifier_existe(session, Voyage, donnees.voyage_id, "Voyage")
    if colis.arret_destination_id is not None:
        ligne = await session.get(Ligne, voyage.ligne_id)
        if ligne is not None and ligne.gare_depart_id != colis.gare_depart_id:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="Ce voyage ne part pas de la gare de départ du colis.",
            )
        await _verifier_arret_du_voyage(
            session, voyage, colis.arret_destination_id, colis.gare_depart_id
        )
    else:
        await _verifier_trajet_du_voyage(
            session, voyage, colis.gare_depart_id, colis.gare_arrivee_id
        )

    chauffeur_id = donnees.chauffeur_id or voyage.chauffeur_id
    if chauffeur_id is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=(
                "Ce voyage n'a aucun chauffeur affecté : désignez le chauffeur "
                "ou choisissez un autre voyage"
            ),
        )
    if voyage.chauffeur_id is not None and voyage.chauffeur_id != chauffeur_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Le chauffeur indiqué ne correspond pas à celui du voyage",
        )
    await _verifier_existe(session, Utilisateur, chauffeur_id, "Chauffeur")

    colis.voyage_id = voyage.id
    colis.chauffeur_id = chauffeur_id
    # Le ticket porte aussi le voyage : le scan s'en sert pour vérifier la
    # cohérence (on ne « livre » pas un colis sur un trajet qui n'est pas le sien).
    ticket = await obtenir_ticket_du_colis(session, colis)
    if ticket is not None:
        ticket.voyage_id = voyage.id
        session.add(ticket)

    session.add(
        ColisEvenement(
            colis_id=colis.id,
            type_evenement="affectation",
            acteur_id=utilisateur.id,
            gare_id=colis.gare_depart_id,
            localisation=await _libelle_voyage(session, voyage),
            horodatage=datetime.now(timezone.utc),
        )
    )
    await session.commit()
    await session.refresh(colis)
    return colis


async def obtenir_colis(session: AsyncSession, colis_id: UUID) -> Colis:
    colis = await session.get(Colis, colis_id)
    if colis is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Colis introuvable")
    return colis


async def modifier_colis(
    session: AsyncSession,
    colis_id: UUID,
    donnees: schemas.ColisUpdate,
    utilisateur: Utilisateur,
) -> Colis:
    """Corrige une fiche colis **avant** la prise en charge par le chauffeur.

    Cas terrain : le client s'est trompé de numéro, ou le guichet a inversé deux
    noms. La correction est possible tant que le chauffeur n'a pas confirmé la
    réception (voir ``confirmer_reception_colis``) ; après, la fiche est figée.
    """
    colis = await obtenir_colis(session, colis_id)
    _exiger_fiche_modifiable(colis, utilisateur)
    valeurs = donnees.model_dump(exclude_unset=True)

    if "arret_destination_id" in valeurs:
        arret_id = valeurs["arret_destination_id"]
        if arret_id is not None:
            arret = await session.get(ArretLigne, arret_id)
            if arret is None or arret.actif is False:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    detail="Arrêt de destination introuvable",
                )
            if donnees.arret_destination_id is not None:
                valeurs["gare_arrivee_id"] = arret.gare_id
            if colis.voyage_id is not None:
                voyage = await obtenir_voyage(session, colis.voyage_id)
                await _verifier_arret_du_voyage(
                    session, voyage, arret_id, colis.gare_depart_id
                )

    for champ, valeur in valeurs.items():
        setattr(colis, champ, valeur)
    await session.commit()
    await session.refresh(colis)
    return colis


async def confirmer_reception_colis(
    session: AsyncSession, colis_id: UUID, utilisateur: Utilisateur
) -> Colis:
    """Le chauffeur confirme avoir physiquement pris le colis en charge.

    Ce geste fige la fiche : le guichet ne peut plus la corriger, et le colis ne
    peut plus être réaffecté à un autre car. C'est la réponse au litige « ce
    n'est pas mon colis / je ne l'ai jamais reçu ».
    """
    colis = await obtenir_colis(session, colis_id)
    if colis.chauffeur_id != utilisateur.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Ce colis ne vous est pas affecté : seul son chauffeur peut le réceptionner.",
        )
    if colis.reception_confirmee_le is None:
        colis.reception_confirmee_le = datetime.now(timezone.utc)
        colis.reception_confirmee_par_id = utilisateur.id
        session.add(
            ColisEvenement(
                colis_id=colis.id,
                type_evenement="reception",
                acteur_id=utilisateur.id,
                gare_id=colis.gare_depart_id,
                horodatage=colis.reception_confirmee_le,
            )
        )
        await session.commit()
        await session.refresh(colis)
    return colis


async def _verifier_agent_guichet(
    session: AsyncSession, agent_id: UUID, gare_id: UUID
) -> Utilisateur:
    agent = await session.get(Utilisateur, agent_id)
    if (
        agent is None
        or not agent.est_actif
        or agent.role not in ("receveur", "gerant_gare")
    ):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="La personne choisie n'est pas un receveur ou gérant actif.",
        )
    profil = await session.scalar(
        select(ProfilLogistique).where(
            ProfilLogistique.utilisateur_id == agent_id,
            ProfilLogistique.type_profil == agent.role,
            ProfilLogistique.gare_id == gare_id,
        )
    )
    if profil is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Cette personne n'est pas rattachée à la gare d'arrivée.",
        )
    return agent


async def remettre_colis_au_guichet(
    session: AsyncSession, colis_id: UUID, utilisateur: Utilisateur, agent_id: UUID
) -> Colis:
    """Le chauffeur confie le colis à un agent du guichet de la gare d'arrivée.

    Prérequis : le colis doit être **arrivé** à sa destination (geste « Arrivés »
    sur l'arrêt / la gare). Le receveur ou gérant désigné prend ensuite en charge
    la remise au destinataire (scan « livraison »).
    """
    colis = await obtenir_colis(session, colis_id)
    if colis.chauffeur_id != utilisateur.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Ce colis ne vous est pas affecté : seul son chauffeur peut le déposer.",
        )
    if colis.reception_confirmee_le is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                "Confirmez d'abord la prise en charge du colis avant de le "
                "déposer au guichet."
            ),
        )
    if colis.statut != "arrive":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                "Marquez d'abord l'arrivée à la destination (geste « Arrivés ») "
                "avant de déposer le colis au guichet."
            ),
        )
    await _verifier_agent_guichet(session, agent_id, colis.gare_arrivee_id)
    if colis.remis_guichet_le is None:
        colis.remis_guichet_le = datetime.now(timezone.utc)
        colis.remis_guichet_par_id = utilisateur.id
        colis.remis_guichet_a_id = agent_id
        session.add(
            ColisEvenement(
                colis_id=colis.id,
                type_evenement="remise_guichet",
                acteur_id=utilisateur.id,
                gare_id=colis.gare_arrivee_id,
                horodatage=colis.remis_guichet_le,
            )
        )
        await session.commit()
        await session.refresh(colis)
    elif colis.remis_guichet_a_id is None:
        colis.remis_guichet_a_id = agent_id
        await session.commit()
        await session.refresh(colis)
    elif colis.remis_guichet_a_id != agent_id:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Ce colis a déjà été confié à un autre agent de guichet.",
        )
    return colis


async def obtenir_ticket_du_colis(
    session: AsyncSession, colis: Colis | None
) -> Ticket | None:
    if colis is None:
        return None
    if colis.ticket_id is not None:
        return await session.get(Ticket, colis.ticket_id)
    return await session.scalar(select(Ticket).where(Ticket.reference_id == colis.id))


async def lister_bagages(
    session: AsyncSession,
    *,
    suivi_familial_id: UUID | None = None,
    colis_id: UUID | None = None,
) -> list[Bagage]:
    """Étiquettes QR des sacs d'un passager ou d'un colis (par position)."""
    if suivi_familial_id is None and colis_id is None:
        return []
    requete = select(Bagage)
    if suivi_familial_id is not None:
        requete = requete.where(Bagage.suivi_familial_id == suivi_familial_id)
    if colis_id is not None:
        requete = requete.where(Bagage.colis_id == colis_id)
    requete = requete.order_by(Bagage.position.asc())
    bagages = list((await session.execute(requete)).scalars().all())
    for bagage in bagages:
        ticket = await session.get(Ticket, bagage.ticket_id) if bagage.ticket_id else None
        bagage.code_clair = ticket.code_clair if ticket else None
        bagage.qr_code_url = construire_url_qr_durable(ticket.qr_token) if ticket else None
    return bagages


async def obtenir_bagage_par_ticket(session: AsyncSession, ticket: Ticket) -> Bagage | None:
    """Retrouve le sac porté par un ticket ``BAGAGE`` (pré-alerte / vérif)."""
    if ticket.type != "BAGAGE" or ticket.reference_id is None:
        return None
    return await session.get(Bagage, ticket.reference_id)


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
    utilisateur: Utilisateur | None = None,
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
    # Périmètre du guichet : chacun voit ses propres enregistrements et ceux qui
    # touchent sa gare. On ne laisse pas un agent lire toute la base.
    if utilisateur is not None and (
        utilisateur.role == RoleUtilisateur.COMMERCANT.value
        or (
            utilisateur.role == RoleUtilisateur.CITOYEN
            and utilisateur.mode_commercant_actif
        )
    ):
        requete = requete.where(Colis.enregistre_par_id == utilisateur.id)
    elif _est_guichet(utilisateur):
        conditions = [Colis.enregistre_par_id == utilisateur.id]
        perimetre = await _gare_de_l_agent(session, utilisateur.id)
        if perimetre is not None:
            conditions.append(Colis.gare_depart_id == perimetre)
            conditions.append(Colis.gare_arrivee_id == perimetre)
        requete = requete.where(or_(*conditions))
    elif utilisateur is not None and utilisateur.role == RoleUtilisateur.CITOYEN.value:
        # Un colis peut avoir été enregistré avant la création du compte du
        # destinataire : le téléphone normalisé reste alors la clé de rattachement.
        conditions = [
            Colis.expediteur_id == utilisateur.id,
            Colis.destinataire_id == utilisateur.id,
        ]
        if utilisateur.telephone_chiffre:
            try:
                telephone = normaliser_numero_tiers(
                    dechiffrer_donnee(utilisateur.telephone_chiffre)
                )
            except ValueError:
                telephone = None
            if telephone:
                conditions.extend([
                    Colis.expediteur_tel == telephone,
                    Colis.destinataire_tel == telephone,
                ])
        requete = requete.where(or_(*conditions))
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

async def _verifier_scan_autorise(
    session: AsyncSession,
    colis: Colis,
    donnees: schemas.ScanCreate,
    utilisateur: Utilisateur,
) -> None:
    """Sépare les gestes du chauffeur et ceux du guichet sur un colis.

    Règle terrain : **seul le chauffeur** constate le départ et l'arrivée (il est
    dans le car). Il peut également constater la livraison directement quand il
    remet le colis en main propre au destinataire. Si le chauffeur confie le colis
    à un agent du guichet, c'est alors ce dernier qui constatera la livraison.
    Un chauffeur ne peut scanner que les colis de son car, et un guichet ne peut
    livrer qu'un colis qui lui a été confié (``remis_guichet_le``).
    """
    type_evenement = donnees.type_evenement
    role = utilisateur.role

    if role == RoleUtilisateur.CHAUFFEUR.value:
        if colis.chauffeur_id is not None and colis.chauffeur_id != utilisateur.id:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="Ce colis n'est pas dans votre car : vous ne pouvez pas le scanner.",
            )
        if type_evenement == "depart" and colis.statut not in (
            "enregistre",
            "enregistre_direct",
        ):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="Le départ ne peut être constaté qu'au démarrage du voyage.",
            )
        if type_evenement == "mise_en_transit" and colis.statut not in (
            "enregistre",
            "enregistre_direct",
            "en_transit",
        ):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="La mise en transit ne peut être enregistrée que pour un colis en cours de transport.",
            )
        if type_evenement == "arrivee" and colis.statut != "en_transit":
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="L'arrivée ne peut être constatée que lorsque le colis est déjà en transit.",
            )
        if type_evenement == "livraison":
            if colis.remis_guichet_le is not None:
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN,
                    detail=(
                        "Ce colis a été confié à un agent du guichet : la livraison "
                        "doit être constatée par le guichet."
                    ),
                )
            if colis.statut != "arrive":
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    detail="La livraison directe ne peut être constatée qu'après l'arrivée au destinataire.",
                )
            return
        return

    if role in (
        RoleUtilisateur.COMMERCANT.value,
        RoleUtilisateur.GERANT_GARE.value,
    ):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Ce profil ne réalise pas les scans de transport ou de livraison.",
        )

    if role in ROLES_GUICHET_SUIVI:
        if type_evenement in ("depart", "mise_en_transit", "arrivee"):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail=(
                    "Le départ et l'arrivée sont constatés par le chauffeur "
                    "(« Valider le départ » / « Arrivés »), pas depuis le guichet."
                ),
            )
        if type_evenement == "livraison":
            if colis.remis_guichet_le is None:
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    detail=(
                        "Le chauffeur n'a pas confié ce colis à un agent du guichet : "
                        "la livraison ne peut pas être constatée par le guichet."
                    ),
                )
            if colis.remis_guichet_a_id != utilisateur.id:
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN,
                    detail="Ce colis a été confié à un autre agent du guichet.",
                )
            return
        return


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
    if ticket.type == "ENFANT":
        suivi = await session.get(SuiviFamilial, ticket.reference_id) if ticket.reference_id else None
        if suivi is None:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND,
                detail="Passager associé à ce ticket introuvable.",
            )
        if donnees.type_evenement != "livraison":
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail=(
                    "Ce ticket appartient à un passager. Le guichet peut uniquement "
                    "confirmer sa remise à la famille après réception du chauffeur."
                ),
            )
        donnees_evenement_suivi = schemas.SuiviFamilialEvenementCreate(
            type_evenement="livraison",
            gare_id=donnees.gare_id,
            localisation=donnees.localisation,
            idempotency_key=donnees.idempotency_key,
            horodatage=donnees.horodatage,
        )
        _verifier_evenement_suivi_autorise(
            suivi, donnees_evenement_suivi, utilisateur
        )
        evenement_livraison = await session.scalar(
            select(SuiviFamilialEvenement).where(
                SuiviFamilialEvenement.suivi_familial_id == suivi.id,
                SuiviFamilialEvenement.type_evenement == "livraison",
            )
        )
        if evenement_livraison is not None or ticket.statut == "livre":
            return {
                "succes": True,
                "deja_livre": True,
                "deja_scanne": False,
                "message": f"PASSAGER DÉJÀ REMIS — {suivi.enfant_nom} a déjà été remis à sa famille.",
                "statut_colis": suivi.statut,
                "suivi": suivi,
                "ticket": ticket,
                "evenement": None,
            }
        resultat_suivi = await enregistrer_evenement_suivi(
            session,
            suivi.id,
            donnees_evenement_suivi,
            utilisateur,
        )
        return {
            "succes": True,
            "deja_livre": False,
            "deja_scanne": resultat_suivi["deja_enregistre"],
            "message": resultat_suivi["message"],
            "statut_colis": suivi.statut,
            "suivi": suivi,
            "ticket": ticket,
            "evenement": None,
        }
    colis = await session.get(Colis, ticket.reference_id) if ticket.reference_id else None
    if colis is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND,
                            detail="Colis associé à ce ticket introuvable")

    # 3. Qui a le droit de poser ce geste : chauffeur ou guichet, pas les deux
    #    pour le même événement (départ/arrivée vs livraison).
    await _verifier_scan_autorise(session, colis, donnees, utilisateur)

    # 4. Règle anti-« DÉJÀ LIVRÉ » : pas de nouvel événement.
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

    # 4. Gardes-fous métier : un même colis ne doit pas parcourir le flux dans
    #    le mauvais ordre ni refaire un départ / une arrivée déjà validés.
    if donnees.type_evenement == "depart" and colis.statut not in (
        "enregistre",
        "enregistre_direct",
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Le départ ne peut être constaté qu'au départ du trajet, avant tout transit.",
        )
    if donnees.type_evenement == "mise_en_transit" and colis.statut not in (
        "enregistre",
        "enregistre_direct",
        "en_transit",
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="La mise en transit n'est possible qu'avant ou lors du transit du colis.",
        )
    if donnees.type_evenement == "arrivee" and colis.statut != "en_transit":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="L'arrivée doit être constatée après le départ / le transit du colis.",
        )
    if donnees.type_evenement == "livraison" and colis.statut != "arrive":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="La livraison ne peut être constatée qu'après l'arrivée au destinataire.",
        )

    if donnees.type_evenement == "livraison":
        if not donnees.code_confirmation:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="Le code à quatre chiffres du destinataire est obligatoire.",
            )
        colis_confirme = await confirmer_remise_colis(
            session, colis.id, donnees.code_confirmation, utilisateur
        )
        evenement_confirme = await session.scalar(
            select(ColisEvenement)
            .where(
                ColisEvenement.colis_id == colis_confirme.id,
                ColisEvenement.type_evenement == "livraison",
            )
            .order_by(ColisEvenement.horodatage.desc())
        )
        return {
            "succes": True,
            "deja_livre": False,
            "deja_scanne": False,
            "message": "Colis remis au destinataire avec succès.",
            "statut_colis": colis_confirme.statut,
            "colis": colis_confirme,
            "ticket": await obtenir_ticket_du_colis(session, colis_confirme),
            "evenement": evenement_confirme,
        }

    # 5. Enregistrement de l'événement + mise à jour des statuts
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
        if colis.statut in ("enregistre", "enregistre_direct"):
            colis.statut = "en_transit"
        ticket.statut = "en_transit"
    elif donnees.type_evenement == "arrivee":
        colis.statut = "arrive"
        ticket.statut = "en_transit"
        await preparer_code_remise(session, colis, ticket)

    ticket.nb_scans = (ticket.nb_scans or 0) + 1
    if ticket.premier_scan_le is None:
        ticket.premier_scan_le = maintenant

    # 5. SMS d'information au destinataire / expéditeur (S7) : départ, mise en
    #    transit, arrivée, livraison. Traçé dans ``notifications_logistique``.
    await _notifier_scan_colis(
        session, colis, ticket, donnees.type_evenement, donnees.gare_id
    )
    messages_evenement = {
        "depart": ("Colis en route", "vient de prendre le départ"),
        "mise_en_transit": ("Colis en transit", "est maintenant en transit"),
        "arrivee": ("Colis arrivé", "est arrivé à destination"),
        "livraison": ("Colis livré", "a été remis au destinataire"),
    }
    titre, progression = messages_evenement[donnees.type_evenement]
    await _notifier_comptes_colis(
        session,
        colis,
        titre,
        f"Votre colis {ticket.code_clair} {progression}. Touchez pour consulter le ticket.",
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
        else "Colis remis au destinataire avec succès."
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
    _exiger_gestion_suivi_familial(utilisateur)
    arret_destination_id = donnees.arret_destination_id
    gare_arrivee_id = donnees.gare_arrivee_id
    if arret_destination_id is not None:
        arret = await session.get(ArretLigne, arret_destination_id)
        if arret is None or arret.actif is False:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, detail="Arrêt de destination introuvable"
            )
        gare_arrivee_id = arret.gare_id
    if donnees.gare_depart_id == gare_arrivee_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail="Les gares de départ et d'arrivée doivent être différentes")
    gare_depart = await _verifier_existe(session, Gare, donnees.gare_depart_id, "Gare de départ")
    await _verifier_existe(session, Gare, gare_arrivee_id, "Gare d'arrivée")
    # Attribution obligatoire : chauffeur précis + voyage précis.
    # Attribution **souple au guichet** : on enregistre souvent le colis avant de
    # savoir quel car partira. Le voyage (et donc le chauffeur) peut alors être
    # affecté plus tard, depuis la fiche — voir ``affecter_colis``. Un chauffeur
    # qui enregistre « en route », lui, connaît forcément son voyage.
    voyage = None
    if donnees.voyage_id is not None:
        voyage = await _verifier_existe(session, Voyage, donnees.voyage_id, "Voyage")
        _exiger_voyage_ouvert(voyage)
        if arret_destination_id is not None:
            ligne = await session.get(Ligne, voyage.ligne_id)
            if ligne is not None and ligne.gare_depart_id != donnees.gare_depart_id:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    detail="Ce voyage ne part pas de la gare de départ déclarée.",
                )
            await _verifier_arret_du_voyage(
                session, voyage, arret_destination_id, donnees.gare_depart_id
            )
        else:
            await _verifier_trajet_du_voyage(
                session, voyage, donnees.gare_depart_id, gare_arrivee_id
            )

    # ─── Enregistrement direct (le chauffeur inscrit son client en route) ──
    if donnees.enregistrement_direct:
        if voyage is None or (
            voyage.chauffeur_id is not None and voyage.chauffeur_id != utilisateur.id
        ):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="Seul le chauffeur du voyage peut enregistrer un passager en direct",
            )
        chauffeur_id = utilisateur.id
        mode_enregistrement = "chauffeur_direct"
        statut_initial = "enregistre_direct"
    else:
        # Sans voyage, on peut tout de même désigner le chauffeur à la main ;
        # sinon la fiche reste « à affecter » jusqu'à complétion par un receveur.
        chauffeur_id = donnees.chauffeur_id or (voyage.chauffeur_id if voyage else None)
        mode_enregistrement = "guichet"
        statut_initial = "enregistre"

    chauffeur = (
        await _verifier_existe(session, Utilisateur, chauffeur_id, "Chauffeur")
        if chauffeur_id is not None
        else None
    )
    if (
        voyage is not None
        and chauffeur is not None
        and voyage.chauffeur_id
        and voyage.chauffeur_id != chauffeur.id
    ):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Le chauffeur indiqué ne correspond pas au chauffeur du voyage",
        )
    if donnees.parent_id is not None:
        await _verifier_existe(session, Utilisateur, donnees.parent_id, "Parent")

    suivi = SuiviFamilial(
        enfant_nom=donnees.enfant_nom.strip(),
        enfant_age=donnees.enfant_age,
        enfant_sexe=donnees.enfant_sexe,
        parent_nom=(donnees.parent_nom or "").strip() or None,
        telephone_parent=donnees.telephone_parent.strip(),
        type_passager=donnees.type_passager,
        telephone_passager=(donnees.telephone_passager or "").strip() or None,
        acheteur_nom=(donnees.acheteur_nom or "").strip() or None,
        acheteur_tel=(donnees.acheteur_tel or "").strip() or None,
        proche_nom=(donnees.proche_nom or "").strip() or None,
        proche_telephone=(donnees.proche_telephone or "").strip() or None,
        nombre_bagages=max(1, min(int(donnees.nombre_bagages or 1), 10)),
        parent_id=donnees.parent_id,
        gare_depart_id=donnees.gare_depart_id,
        gare_arrivee_id=gare_arrivee_id,
        arret_destination_id=arret_destination_id,
        voyage_id=donnees.voyage_id,
        chauffeur_id=chauffeur_id,
        statut=statut_initial,
        mode_enregistrement=mode_enregistrement,
        enregistre_par_id=utilisateur.id,
        moyen_paiement=donnees.moyen_paiement,
    )
    session.add(suivi)
    await session.flush()  # -> suivi.id disponible

    # Étiquettes QR : une par sac (traçabilité + anti-fraude à l'arrivée).
    await _creer_bagages(
        session, suivi.nombre_bagages, gare_depart, suivi_familial_id=suivi.id
    )

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

    # Frais de service **fixe** du passager, encaissé avant le QR.
    from src.modules.paiement.tarification import frais_service_passager

    await _encaisser_frais_service(
        session,
        utilisateur,
        moyen=donnees.moyen_paiement,
        telephone=donnees.telephone_paiement,
        montant_fcfa=frais_service_passager(),
        idempotency_key=f"passager:{suivi.id}",
    )

    evenement = SuiviFamilialEvenement(
        suivi_familial_id=suivi.id,
        type_evenement="enregistrement",
        acteur_id=utilisateur.id,
        gare_id=donnees.gare_depart_id,
        horodatage=datetime.now(timezone.utc),
    )
    session.add(evenement)

    # SMS de confirmation : le responsable + le proche de confiance reçoivent le
    # code de suivi public.
    quoi = "l'enfant" if suivi.type_passager == "enfant" else "le passager"
    message = (
        f"DigiID — Suivi activé pour {quoi} {suivi.enfant_nom}. "
        f"Code de suivi : {code_clair}. "
        "Vous recevrez un SMS au départ, avant l'arrivée puis à l'arrivée."
    )
    for role, telephone in (
        ("parent" if suivi.type_passager == "enfant" else "passager", suivi.telephone_parent),
        ("acheteur", suivi.acheteur_tel),
        ("proche", suivi.proche_telephone),
    ):
        if not telephone:
            continue
        _ajouter_notification(
            session,
            type_cible="suivi_familial",
            cible_id=suivi.id,
            type_evenement="enregistrement",
            destinataire_role=role,
            telephone=telephone,
            message=message,
        )

    await session.commit()
    await session.refresh(suivi)
    await session.refresh(ticket)
    return suivi, ticket


async def affecter_suivi_familial(
    session: AsyncSession,
    suivi_id: UUID,
    donnees: schemas.AffectationRequest,
    utilisateur: Utilisateur,
) -> SuiviFamilial:
    """Affecte (ou réaffecte) un passager suivi à un voyage et à son chauffeur.

    Même logique que pour un colis : la famille confie l'enfant au guichet, le
    receveur sait rarement **quel** car partira sur-le-champ.
    """
    _exiger_gestion_suivi_familial(utilisateur)
    suivi = await obtenir_suivi_familial(session, suivi_id)
    if suivi.statut in ("arrive", "annule"):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Un passager arrivé ou annulé ne peut plus être réaffecté",
        )
    if suivi.reception_confirmee_le is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                "Le chauffeur a déjà confirmé la prise en charge : le passager "
                "ne peut plus changer de voyage."
            ),
        )

    voyage = await _verifier_existe(session, Voyage, donnees.voyage_id, "Voyage")
    if suivi.arret_destination_id is not None:
        ligne = await session.get(Ligne, voyage.ligne_id)
        if ligne is not None and ligne.gare_depart_id != suivi.gare_depart_id:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="Ce voyage ne part pas de la gare de départ du passager.",
            )
        await _verifier_arret_du_voyage(
            session, voyage, suivi.arret_destination_id, suivi.gare_depart_id
        )
    else:
        await _verifier_trajet_du_voyage(
            session, voyage, suivi.gare_depart_id, suivi.gare_arrivee_id
        )

    chauffeur_id = donnees.chauffeur_id or voyage.chauffeur_id
    if chauffeur_id is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=(
                "Ce voyage n'a aucun chauffeur affecté : désignez le chauffeur "
                "ou choisissez un autre voyage"
            ),
        )
    if voyage.chauffeur_id is not None and voyage.chauffeur_id != chauffeur_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Le chauffeur indiqué ne correspond pas à celui du voyage",
        )
    await _verifier_existe(session, Utilisateur, chauffeur_id, "Chauffeur")

    suivi.voyage_id = voyage.id
    suivi.chauffeur_id = chauffeur_id
    ticket = await obtenir_ticket_du_suivi(session, suivi)
    if ticket is not None:
        ticket.voyage_id = voyage.id
        session.add(ticket)

    session.add(
        SuiviFamilialEvenement(
            suivi_familial_id=suivi.id,
            type_evenement="affectation",
            acteur_id=utilisateur.id,
            gare_id=suivi.gare_depart_id,
            localisation=await _libelle_voyage(session, voyage),
            horodatage=datetime.now(timezone.utc),
        )
    )
    await session.commit()
    await session.refresh(suivi)
    return suivi


async def obtenir_suivi_familial(
    session: AsyncSession, suivi_id: UUID
) -> SuiviFamilial:
    suivi = await session.get(SuiviFamilial, suivi_id)
    if suivi is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Suivi familial introuvable")
    return suivi


async def modifier_suivi_familial(
    session: AsyncSession,
    suivi_id: UUID,
    donnees: schemas.SuiviFamilialUpdate,
    utilisateur: Utilisateur,
) -> SuiviFamilial:
    _exiger_gestion_suivi_familial(utilisateur)
    """Corrige une fiche passager avant la prise en charge par le chauffeur."""
    suivi = await obtenir_suivi_familial(session, suivi_id)
    _exiger_fiche_modifiable(suivi, utilisateur)
    valeurs = donnees.model_dump(exclude_unset=True)

    if "arret_destination_id" in valeurs:
        arret_id = valeurs["arret_destination_id"]
        if arret_id is not None:
            arret = await session.get(ArretLigne, arret_id)
            if arret is None or arret.actif is False:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    detail="Arrêt de destination introuvable",
                )
            valeurs["gare_arrivee_id"] = arret.gare_id
            if suivi.voyage_id is not None:
                voyage = await obtenir_voyage(session, suivi.voyage_id)
                await _verifier_arret_du_voyage(
                    session, voyage, arret_id, suivi.gare_depart_id
                )

    for champ, valeur in valeurs.items():
        setattr(suivi, champ, valeur)
    await session.commit()
    await session.refresh(suivi)
    return suivi


async def confirmer_reception_suivi(
    session: AsyncSession, suivi_id: UUID, utilisateur: Utilisateur
) -> SuiviFamilial:
    """Le chauffeur confirme avoir pris l'enfant (ou l'adulte) à bord.

    Fige la fiche : plus de correction ni de réaffectation après ce geste.
    """
    suivi = await obtenir_suivi_familial(session, suivi_id)
    if suivi.chauffeur_id != utilisateur.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Ce passager ne vous est pas affecté : seul son chauffeur peut le réceptionner.",
        )
    if suivi.reception_confirmee_le is None:
        suivi.reception_confirmee_le = datetime.now(timezone.utc)
        suivi.reception_confirmee_par_id = utilisateur.id
        session.add(
            SuiviFamilialEvenement(
                suivi_familial_id=suivi.id,
                type_evenement="reception",
                acteur_id=utilisateur.id,
                gare_id=suivi.gare_depart_id,
                horodatage=suivi.reception_confirmee_le,
            )
        )
        await session.commit()
        await session.refresh(suivi)
    return suivi


async def remettre_suivi_au_guichet(
    session: AsyncSession, suivi_id: UUID, utilisateur: Utilisateur, agent_id: UUID
) -> SuiviFamilial:
    """Le chauffeur confie un **enfant** à un agent du guichet d'arrivée.

    Un adulte termine son trajet à l'arrivée : on ne le laisse pas au guichet.
    Un enfant peut y attendre si le responsable n'est pas à l'heure ; la remise
    finale à la famille est alors constatée par le guichet (scan « livraison »).
    Prérequis : statut « arrivé » (geste « Arrivés » sur l'arrêt / la gare).
    """
    suivi = await obtenir_suivi_familial(session, suivi_id)
    if suivi.chauffeur_id != utilisateur.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Ce passager ne vous est pas affecté : seul son chauffeur peut le déposer.",
        )
    if suivi.type_passager != "enfant":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                "Un passager adulte termine son trajet à l'arrivée : "
                "seul un enfant peut être confié au guichet."
            ),
        )
    if suivi.reception_confirmee_le is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                "Confirmez d'abord la prise en charge du passager avant de le "
                "déposer au guichet."
            ),
        )
    if suivi.statut != "arrive":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                "Marquez d'abord l'arrivée à la destination (geste « Arrivés ») "
                "avant de confier l'enfant au guichet."
            ),
        )
    await _verifier_agent_guichet(session, agent_id, suivi.gare_arrivee_id)
    if suivi.remis_guichet_le is None:
        suivi.remis_guichet_le = datetime.now(timezone.utc)
        suivi.remis_guichet_par_id = utilisateur.id
        suivi.remis_guichet_a_id = agent_id
        session.add(
            SuiviFamilialEvenement(
                suivi_familial_id=suivi.id,
                type_evenement="remise_guichet",
                acteur_id=utilisateur.id,
                gare_id=suivi.gare_arrivee_id,
                horodatage=suivi.remis_guichet_le,
            )
        )
        await session.commit()
        await session.refresh(suivi)
    elif suivi.remis_guichet_a_id is None:
        suivi.remis_guichet_a_id = agent_id
        await session.commit()
        await session.refresh(suivi)
    elif suivi.remis_guichet_a_id != agent_id:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Cet enfant a déjà été confié à un autre agent de guichet.",
        )
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
    utilisateur: Utilisateur | None = None,
):
    if utilisateur is not None:
        exiger_acces_suivi_familial(utilisateur)
    requete = select(SuiviFamilial)
    if statut is not None:
        requete = requete.where(SuiviFamilial.statut == statut)
    if voyage_id is not None:
        requete = requete.where(SuiviFamilial.voyage_id == voyage_id)
    if recherche:
        requete = requete.where(SuiviFamilial.enfant_nom.ilike(f"%{recherche.strip()}%"))
    # Même périmètre que les colis : le guichet ne voit pas les fiches des autres.
    if _est_guichet(utilisateur):
        conditions = [SuiviFamilial.enregistre_par_id == utilisateur.id]
        perimetre = await _gare_de_l_agent(session, utilisateur.id)
        if perimetre is not None:
            conditions.append(SuiviFamilial.gare_depart_id == perimetre)
            conditions.append(SuiviFamilial.gare_arrivee_id == perimetre)
        requete = requete.where(or_(*conditions))
    requete = requete.order_by(SuiviFamilial.cree_le.desc())
    return await _paginer(session, requete, page, par_page)


async def _compter_evenements_suivi(session: AsyncSession, suivi_id: UUID) -> int:
    return await session.scalar(
        select(func.count()).select_from(SuiviFamilialEvenement).where(
            SuiviFamilialEvenement.suivi_familial_id == suivi_id
        )
    ) or 0


def _verifier_evenement_suivi_autorise(
    suivi: SuiviFamilial,
    donnees: schemas.SuiviFamilialEvenementCreate,
    utilisateur: Utilisateur,
) -> None:
    """Le chauffeur peut remettre directement ; le guichet ne livre que ce qui lui est confié."""
    exiger_acces_suivi_familial(utilisateur)
    if utilisateur.role == RoleUtilisateur.GERANT_GARE.value:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Le gérant supervise la gare ; les étapes de transport relèvent du chauffeur et la remise au receveur.",
        )
    if utilisateur.role == RoleUtilisateur.CHAUFFEUR.value:
        if donnees.type_evenement == "livraison":
            if suivi.remis_guichet_le is not None:
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN,
                    detail="Cet enfant a été confié à un agent du guichet : la livraison doit être constatée par le guichet.",
                )
            return
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Le chauffeur constate le départ et l'arrivée ; la remise finale se fait directement ou via le guichet.",
        )
    if (
        donnees.type_evenement == "livraison"
        and utilisateur.role not in ROLES_GUICHET_SUIVI
        and utilisateur.role not in ("super_admin", "super_administrateur")
    ):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Seul l'agent de guichet auquel l'enfant a été confié peut le remettre à sa famille.",
        )
    if utilisateur.role not in ROLES_GUICHET_SUIVI:
        return

    if donnees.type_evenement != "livraison":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail=(
                "Le guichet peut uniquement confirmer la remise d'un passager "
                "qui lui a été confié."
            ),
        )

    if suivi.type_passager != "enfant" or suivi.remis_guichet_le is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Le chauffeur doit d'abord confier cet enfant au guichet.",
        )
    if suivi.remis_guichet_a_id != utilisateur.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Cet enfant a été confié à un autre agent du guichet.",
        )


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
    _verifier_evenement_suivi_autorise(suivi, donnees, utilisateur)

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
                "message": (
                    f"La remise de {suivi.enfant_nom} à sa famille a déjà été confirmée."
                    if donnees.type_evenement == "livraison"
                    else "Événement déjà enregistré (idempotent)."
                ),
                "statut_suivi": suivi.statut,
                "suivi": suivi,
                "evenement": existant,
            }

    # Défense en profondeur : le chauffeur peut remettre directement à la
    # famille; seul le guichet garde le droit de délivrer si le colis/enfant a
    # été explicitement confié à son agent.
    if (
        donnees.type_evenement == "livraison"
        and suivi.type_passager == "enfant"
        and suivi.chauffeur_id is not None
        and suivi.remis_guichet_le is not None
        and utilisateur.role in ROLES_GUICHET_SUIVI
    ):
        if suivi.remis_guichet_a_id != utilisateur.id:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="Cet enfant a été confié à un autre agent du guichet.",
            )

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
        elif donnees.type_evenement == "livraison":
            ticket.statut = "livre"
        ticket.nb_scans = (ticket.nb_scans or 0) + 1
        if ticket.premier_scan_le is None:
            ticket.premier_scan_le = maintenant

    await session.commit()
    await session.refresh(suivi)
    await session.refresh(evenement)

    libelles = {
        "depart": "Départ enregistré.",
        "arrivee": "Arrivée enregistrée. Le parent a été prévenu.",
        "livraison": f"Passager {suivi.enfant_nom} remis à sa famille avec succès.",
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


# ─── Actions groupées du chauffeur (passagers ET colis) ─────────────

async def _colis_du_voyage(session: AsyncSession, voyage_id: UUID) -> list[Colis]:
    resultat = await session.execute(select(Colis).where(Colis.voyage_id == voyage_id))
    return list(resultat.scalars().all())


async def _passagers_du_voyage(
    session: AsyncSession, voyage_id: UUID
) -> list[SuiviFamilial]:
    resultat = await session.execute(
        select(SuiviFamilial).where(SuiviFamilial.voyage_id == voyage_id)
    )
    return list(resultat.scalars().all())


def _exiger_charge_a_bord(
    colis: list, passagers: list, *, action: str
) -> None:
    """Refuse une action groupée si le car est vide (aucun passager ni colis)."""
    actifs_colis = [c for c in colis if getattr(c, "statut", None) != "annule"]
    actifs_passagers = [p for p in passagers if getattr(p, "statut", None) != "annule"]
    if not actifs_colis and not actifs_passagers:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                f"Impossible de {action} : aucun passager ni colis à bord. "
                "Attendez le chargement au guichet, ou enregistrez un client monté en route."
            ),
        )


async def valider_depart_voyage(
    session: AsyncSession, voyage_id: UUID, utilisateur: Utilisateur
) -> dict:
    """« Valider le Départ » : marque **tous** les passagers et colis d'un clic.

    Un seul bouton côté chauffeur enregistre le départ de tous les colis du
    voyage **et** fait passer tous les passagers en route (SMS au parent).
    """
    voyage = await obtenir_voyage(session, voyage_id)
    if voyage.statut in ("termine", "annule"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                f"Ce voyage est « {voyage.statut} » : le départ ne peut plus être validé."
            ),
        )
    if voyage.statut == "planifie" and voyage.date_depart is not None:
        depart_prevu = _en_utc(voyage.date_depart)
        if depart_prevu.date() > datetime.now(timezone.utc).date():
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail=(
                    "Le départ ne peut être validé qu'à partir du jour planifié "
                    f"({depart_prevu.strftime('%d/%m/%Y')})."
                ),
            )

    colis_voyage = await _colis_du_voyage(session, voyage_id)
    passagers_voyage = await _passagers_du_voyage(session, voyage_id)
    _exiger_charge_a_bord(
        colis_voyage, passagers_voyage, action="valider le départ"
    )

    maintenant = datetime.now(timezone.utc)

    nb_colis = 0
    for colis in colis_voyage:
        if colis.statut not in ("enregistre", "enregistre_direct"):
            continue
        session.add(ColisEvenement(
            colis_id=colis.id, type_evenement="depart", acteur_id=utilisateur.id,
            gare_id=colis.gare_depart_id, horodatage=maintenant,
        ))
        colis.statut = "en_transit"
        # « Valider le départ » vaut prise en charge de **tous** les colis du
        # car : la fiche de chacun se fige à cet instant (plus de correction
        # guichet, plus de réaffectation). C'est la confirmation de réception
        # groupée du chauffeur.
        if colis.reception_confirmee_le is None:
            colis.reception_confirmee_le = maintenant
            colis.reception_confirmee_par_id = utilisateur.id
        ticket = await obtenir_ticket_du_colis(session, colis)
        if ticket is not None:
            ticket.statut = "en_transit"
            await _notifier_comptes_colis(
                session,
                colis,
                "Colis en route",
                f"Votre colis {ticket.code_clair} vient de prendre le départ. "
                "Touchez pour consulter le ticket.",
            )
        await _notifier_scan_colis(session, colis, ticket, "depart", colis.gare_depart_id)
        nb_colis += 1

    nb_passagers = 0
    for suivi in passagers_voyage:
        if suivi.statut not in ("enregistre", "enregistre_direct"):
            continue
        session.add(SuiviFamilialEvenement(
            suivi_familial_id=suivi.id, type_evenement="depart",
            acteur_id=utilisateur.id, gare_id=suivi.gare_depart_id,
            horodatage=maintenant,
        ))
        suivi.statut = "en_route"
        if suivi.reception_confirmee_le is None:
            suivi.reception_confirmee_le = maintenant
            suivi.reception_confirmee_par_id = utilisateur.id
        await _notifier_suivi(session, suivi, "depart", suivi.gare_depart_id)
        nb_passagers += 1

    if nb_colis == 0 and nb_passagers == 0:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                "Rien de nouveau à faire partir : tous les passagers et colis "
                "sont déjà en route, arrivés, ou annulés."
            ),
        )

    if voyage.statut == "planifie":
        voyage.statut = "en_cours"
    await session.commit()
    return {
        "type_action": "depart",
        "voyage_id": voyage_id,
        "nb_colis": nb_colis,
        "nb_passagers": nb_passagers,
        "statut_voyage": voyage.statut,
        "message": (
            f"Départ validé : {nb_passagers} passager(s) et {nb_colis} colis en route."
        ),
    }


def _destine_a_larret(
    enregistrement,
    *,
    arret_id: UUID | None,
    gare_id: UUID | None,
) -> bool:
    """True si le colis/passager descend à l'arrêt (ou gare) ciblé.

    ``arret_id`` est prioritaire : on ne touche que ceux positionnés sur cet
    arrêt précis. Sinon ``gare_id`` filtre par gare d'arrivée. Sans les deux,
    tout le voyage est concerné.
    """
    if arret_id is not None:
        if enregistrement.arret_destination_id is not None:
            return enregistrement.arret_destination_id == arret_id
        # Anciens enregistrements sans arrêt : on matche sur la gare de l'arrêt.
        return gare_id is not None and enregistrement.gare_arrivee_id == gare_id
    if gare_id is not None:
        return enregistrement.gare_arrivee_id == gare_id
    return True


async def marquer_arrivee_voyage(
    session: AsyncSession,
    voyage_id: UUID,
    utilisateur: Utilisateur,
    gare_id: UUID | None = None,
    arret_id: UUID | None = None,
    localisation: str | None = None,
) -> dict:
    """« Arrivés » en lot : passagers et colis d'un arrêt (ou d'une gare).

    ``arret_id`` prime sur ``gare_id`` : le chauffeur marque arrivés uniquement
    ceux qui descendent à cet arrêt, sans terminer le voyage. Sans filtre, on
    marque arrivés tous les colis et passagers encore en route.
    """
    voyage = await obtenir_voyage(session, voyage_id)
    if voyage.statut in ("termine", "annule"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                f"Ce voyage est « {voyage.statut} » : plus d'arrivée à enregistrer."
            ),
        )
    if voyage.statut == "planifie":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                "Validez d'abord le départ : on ne marque l'arrivée que pour un "
                "car déjà en route."
            ),
        )

    colis_voyage = await _colis_du_voyage(session, voyage_id)
    passagers_voyage = await _passagers_du_voyage(session, voyage_id)
    _exiger_charge_a_bord(
        colis_voyage, passagers_voyage, action="marquer l'arrivée"
    )

    maintenant = datetime.now(timezone.utc)

    gare_effective = gare_id
    if arret_id is not None:
        arret = await session.get(ArretLigne, arret_id)
        if arret is None or arret.actif is False:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, detail="Arrêt introuvable ou inactif."
            )
        if arret.ligne_id != voyage.ligne_id:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="Cet arrêt n'appartient pas au trajet de ce voyage.",
            )
        gare_effective = arret.gare_id

    lieu = await _libelle_gare(session, gare_effective)

    nb_colis = 0
    for colis in colis_voyage:
        if colis.statut not in ("enregistre", "enregistre_direct", "en_transit"):
            continue
        if not _destine_a_larret(colis, arret_id=arret_id, gare_id=gare_effective):
            continue
        gare_evt = gare_effective or colis.gare_arrivee_id
        session.add(ColisEvenement(
            colis_id=colis.id, type_evenement="arrivee", acteur_id=utilisateur.id,
            gare_id=gare_evt, localisation=localisation,
            horodatage=maintenant,
        ))
        colis.statut = "arrive"
        ticket = await obtenir_ticket_du_colis(session, colis)
        await _notifier_scan_colis(session, colis, ticket, "arrivee", gare_evt)
        if ticket is not None:
            await _notifier_comptes_colis(
                session,
                colis,
                "Colis arrivé",
                f"Votre colis {ticket.code_clair} est arrivé à destination. "
                "Touchez pour consulter le ticket.",
            )
        nb_colis += 1

    nb_passagers = 0
    for suivi in passagers_voyage:
        if suivi.statut not in ("enregistre", "enregistre_direct", "en_route"):
            continue
        if not _destine_a_larret(suivi, arret_id=arret_id, gare_id=gare_effective):
            continue
        gare_evt = gare_effective or suivi.gare_arrivee_id
        session.add(SuiviFamilialEvenement(
            suivi_familial_id=suivi.id, type_evenement="arrivee",
            acteur_id=utilisateur.id, gare_id=gare_evt,
            localisation=localisation, horodatage=maintenant,
        ))
        suivi.statut = "arrive"
        await _notifier_suivi(session, suivi, "arrivee", gare_evt)
        nb_passagers += 1

    if nb_colis == 0 and nb_passagers == 0:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                "Aucun passager ni colis à marquer arrivés pour cet arrêt. "
                "Vérifiez la sélection ou le manifeste."
            ),
        )

    # Plus personne / rien en charge (sur les instances déjà chargées) → terminé.
    encore_en_charge = any(
        c.statut not in ("arrive", "livre", "annule") for c in colis_voyage
    ) or any(
        p.statut not in ("arrive", "annule") for p in passagers_voyage
    )
    if not encore_en_charge:
        voyage.statut = "termine"
        if voyage.date_arrivee is None:
            voyage.date_arrivee = maintenant

    await session.commit()
    return {
        "type_action": "arrivee",
        "voyage_id": voyage_id,
        "nb_colis": nb_colis,
        "nb_passagers": nb_passagers,
        "arret_id": arret_id,
        "statut_voyage": voyage.statut,
        "message": (
            f"Arrivée enregistrée : {nb_passagers} passager(s) et {nb_colis} colis."
            f"{' ' + lieu if lieu else ''}"
            + (" Le voyage est terminé." if voyage.statut == "termine" else "")
        ),
    }


async def envoyer_pre_alerte_voyage(
    session: AsyncSession,
    voyage_id: UUID,
    utilisateur: Utilisateur,
    delai_minutes: int | None = None,
) -> dict:
    """« Prévenir de l'approche » : SMS de pré-alerte aux familles et destinataires.

    ~45 min / 1h avant l'arrivée, un seul clic prévient : les passagers, leurs
    proches de confiance (et l'acheteur pour un enfant) **ainsi que** les
    destinataires des colis, pour qu'ils se rendent à la gare à temps.
    """
    voyage = await obtenir_voyage(session, voyage_id)
    if voyage.statut in ("termine", "annule"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                f"Ce voyage est « {voyage.statut} » : plus de pré-alerte à envoyer."
            ),
        )

    colis_voyage = await _colis_du_voyage(session, voyage_id)
    passagers_voyage = await _passagers_du_voyage(session, voyage_id)
    _exiger_charge_a_bord(
        colis_voyage, passagers_voyage, action="envoyer la pré-alerte"
    )

    nb_sms = 0
    nb_passagers = 0
    nb_colis = 0

    for colis in colis_voyage:
        if colis.statut in ("livre", "annule"):
            continue
        ticket = await obtenir_ticket_du_colis(session, colis)
        lieu = await _libelle_gare(session, colis.gare_arrivee_id)
        message = construire_message_pre_alerte(
            "colis", ticket.code_clair if ticket else "", lieu, delai_minutes
        )
        for role, telephone in (
            ("destinataire", colis.destinataire_tel),
            ("expediteur", colis.expediteur_tel),
        ):
            if not telephone:
                continue
            _ajouter_notification(
                session, type_cible="colis", cible_id=colis.id,
                type_evenement="pre_alerte", destinataire_role=role,
                telephone=telephone, message=message,
            )
            nb_sms += 1
        nb_colis += 1

    for suivi in passagers_voyage:
        if suivi.statut in ("arrive", "annule"):
            continue
        ticket = await obtenir_ticket_du_suivi(session, suivi)
        lieu = await _libelle_gare(session, suivi.gare_arrivee_id)
        message = construire_message_pre_alerte(
            "passager", ticket.code_clair if ticket else "", lieu, delai_minutes
        )
        for role, telephone in (
            ("parent" if suivi.type_passager == "enfant" else "passager", suivi.telephone_parent),
            ("acheteur", suivi.acheteur_tel),
            ("proche", suivi.proche_telephone),
        ):
            if not telephone:
                continue
            _ajouter_notification(
                session, type_cible="suivi_familial", cible_id=suivi.id,
                type_evenement="pre_alerte", destinataire_role=role,
                telephone=telephone, message=message,
            )
            nb_sms += 1
        suivi.pre_alerte_envoyee = True
        nb_passagers += 1

    await session.commit()
    return {
        "voyage_id": voyage_id,
        "nb_sms": nb_sms,
        "nb_passagers": nb_passagers,
        "nb_colis": nb_colis,
        "message": (
            f"Pré-alerte envoyée : {nb_sms} SMS ({nb_passagers} passager(s), "
            f"{nb_colis} colis)."
        ),
    }


async def _notifier_suivi(
    session: AsyncSession,
    suivi: SuiviFamilial,
    type_evenement: str,
    gare_id: UUID | None,
) -> None:
    """Prévient par SMS le responsable ET le proche de confiance d'un passager."""
    if type_evenement == "depart" and suivi.sms_depart_envoye:
        return
    if type_evenement == "arrivee" and suivi.sms_arrivee_envoye:
        return
    lieu = await _libelle_gare(session, gare_id)
    message = construire_message_suivi_familial(
        suivi.enfant_nom, type_evenement, lieu, suivi.enfant_age
    )
    for role, telephone in (
        ("parent" if suivi.type_passager == "enfant" else "passager", suivi.telephone_parent),
        ("proche", suivi.proche_telephone),
    ):
        if not telephone:
            continue
        _ajouter_notification(
            session, type_cible="suivi_familial", cible_id=suivi.id,
            type_evenement=type_evenement, destinataire_role=role,
            telephone=telephone, message=message,
        )
    if type_evenement == "depart":
        suivi.sms_depart_envoye = True
    elif type_evenement == "arrivee":
        suivi.sms_arrivee_envoye = True


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
            nombre_bagages=colis.nombre_bagages,
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
            type_passager=suivi.type_passager,
            nombre_bagages=suivi.nombre_bagages,
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
