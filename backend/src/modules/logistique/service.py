 # -*- coding: utf-8 -*-
"""Service logistique — logique métier du référentiel + colis de bout en bout."""
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlparse
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import (
    Gare, Ligne, Vehicule, Voyage, ActeurLogistique, Domaine, Utilisateur,
    Ticket, Colis, ColisEvenement, ProfilLogistique,
    SuiviFamilial, SuiviFamilialEvenement, NotificationLogistique, Bagage,
)
from src.modules.logistique import schemas
from src.noyau import dechiffrer_donnee, journal
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
    """
    ligne = await session.get(Ligne, voyage.ligne_id)
    if ligne is None:
        return
    if ligne.gare_depart_id == gare_depart_id and ligne.gare_arrivee_id == gare_arrivee_id:
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
                         statut: str | None = None,
                         chauffeur_id: UUID | None = None,
                         ligne_id: UUID | None = None,
                         a_partir_de: datetime | None = None):
    """Liste des voyages, filtrable par chauffeur, ligne et date.

    Ces filtres servent trois usages concrets :
      - le chauffeur : « mes voyages » (il choisit son jour et son trajet) ;
      - le guichet : « les cars de ce chauffeur sur ce trajet » à l'attribution ;
      - le public : « les prochains départs » (page citoyens).
    Avec ``a_partir_de``, on trie du **prochain** départ au plus lointain ;
    sinon du plus récent au plus ancien.
    """
    requete = select(Voyage)
    if statut is not None:
        requete = requete.where(Voyage.statut == statut)
    if chauffeur_id is not None:
        requete = requete.where(Voyage.chauffeur_id == chauffeur_id)
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
    for champ, valeur in valeurs.items():
        setattr(voyage, champ, valeur)
    await session.commit()
    await session.refresh(voyage)
    return voyage


async def supprimer_voyage(session: AsyncSession, voyage_id: UUID) -> None:
    voyage = await obtenir_voyage(session, voyage_id)
    await session.delete(voyage)
    await session.commit()


async def rejoindre_voyage(
    session: AsyncSession, *, voyage_id: UUID, chauffeur_id: UUID
) -> Voyage:
    """Un chauffeur indépendant se désigne lui-même sur un voyage **planifié**.

    Flexibilité voulue par le terrain : un chauffeur qui travaille sur une autre
    ligne (ou dont le car a changé) peut prendre un départ encore libre, sans
    passer par le gérant de gare. Garde-fous :
      * voyage pas encore parti (statut `planifie`) ;
      * personne d'autre déjà désigné (sinon on refuse : l'engagement est public,
        le suivi et les SMS partent sur ce nom).
    """
    voyage = await session.get(Voyage, voyage_id)
    if voyage is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="Voyage introuvable"
        )
    if voyage.chauffeur_id == chauffeur_id:
        return voyage  # déjà le mien : idempotent (double clic du téléphone)
    if voyage.statut != "planifie":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                f"Ce voyage est « {voyage.statut} » : on ne peut plus s'y ajouter. "
                "Demandez au gérant de gare de créer un nouveau départ."
            ),
        )
    if voyage.chauffeur_id is not None:
        autre = await session.get(Utilisateur, voyage.chauffeur_id)
        nom = "un autre chauffeur"
        if autre is not None:
            nom = f"{dechiffrer_donnee(autre.prenom_chiffre) if autre.prenom_chiffre else ''} " \
                  f"{dechiffrer_donnee(autre.nom_chiffre) if autre.nom_chiffre else ''}".strip() \
                  or (autre.digiid_public or "un autre chauffeur")
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"{nom} conduit déjà ce voyage (statut « planifie »). Choisissez un autre départ.",
        )

    voyage.chauffeur_id = chauffeur_id
    await session.commit()
    await session.refresh(voyage)
    journal.info(
        f"voyage_rejoint | chauffeur={chauffeur_id} | voyage={voyage_id} "
        f"| ligne={voyage.ligne_id} | depart={voyage.date_depart}"
    )
    return voyage


async def quitter_voyage(
    session: AsyncSession, *, voyage_id: UUID, chauffeur_id: UUID
) -> Voyage:
    """Un chauffeur se retire d'un voyage tant qu'il n'est pas parti.

    Même logique que `rejoindre_voyage` : on ne « débarque » pas un car déjà en
    route (les colis et passagers à bord dépendent de ce chauffeur).
    """
    voyage = await session.get(Voyage, voyage_id)
    if voyage is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="Voyage introuvable"
        )
    if voyage.chauffeur_id != chauffeur_id:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Vous n'êtes pas le chauffeur de ce voyage.",
        )
    if voyage.statut != "planifie":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                "Ce voyage a déjà commencé : vous ne pouvez plus vous en retirer. "
                "Terminez le voyage ou contactez le gérant de gare."
            ),
        )
    voyage.chauffeur_id = None
    await session.commit()
    await session.refresh(voyage)
    journal.info(f"voyage_quitte | chauffeur={chauffeur_id} | voyage={voyage_id}")
    return voyage


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
    # Attribution obligatoire : chauffeur précis + voyage précis.
    # Attribution **souple au guichet** : on enregistre souvent le colis avant de
    # savoir quel car partira. Le voyage (et donc le chauffeur) peut alors être
    # affecté plus tard, depuis la fiche — voir ``affecter_colis``. Un chauffeur
    # qui enregistre « en route », lui, connaît forcément son voyage.
    voyage = None
    if donnees.voyage_id is not None:
        voyage = await _verifier_existe(session, Voyage, donnees.voyage_id, "Voyage")
        await _verifier_trajet_du_voyage(
            session, voyage, donnees.gare_depart_id, donnees.gare_arrivee_id
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
    if donnees.expediteur_id is not None:
        await _verifier_existe(session, Utilisateur, donnees.expediteur_id, "Expéditeur")
    if donnees.receveur_id is not None:
        await _verifier_existe(session, Utilisateur, donnees.receveur_id, "Receveur")

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
        nombre_bagages=max(1, min(int(donnees.nombre_bagages or 1), 10)),
        gare_depart_id=donnees.gare_depart_id,
        gare_arrivee_id=donnees.gare_arrivee_id,
        voyage_id=donnees.voyage_id,
        receveur_id=receveur_id,
        chauffeur_id=chauffeur_id,
        statut=statut_initial,
        mode_enregistrement=mode_enregistrement,
        enregistre_par_id=utilisateur.id,
        frais_fcfa=donnees.frais_fcfa,
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

    voyage = await _verifier_existe(session, Voyage, donnees.voyage_id, "Voyage")
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
        if colis.statut in ("enregistre", "enregistre_direct"):
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
    # Attribution obligatoire : chauffeur précis + voyage précis.
    # Attribution **souple au guichet** : on enregistre souvent le colis avant de
    # savoir quel car partira. Le voyage (et donc le chauffeur) peut alors être
    # affecté plus tard, depuis la fiche — voir ``affecter_colis``. Un chauffeur
    # qui enregistre « en route », lui, connaît forcément son voyage.
    voyage = None
    if donnees.voyage_id is not None:
        voyage = await _verifier_existe(session, Voyage, donnees.voyage_id, "Voyage")
        await _verifier_trajet_du_voyage(
            session, voyage, donnees.gare_depart_id, donnees.gare_arrivee_id
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
        gare_arrivee_id=donnees.gare_arrivee_id,
        voyage_id=donnees.voyage_id,
        chauffeur_id=chauffeur_id,
        statut=statut_initial,
        mode_enregistrement=mode_enregistrement,
        enregistre_par_id=utilisateur.id,
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
    suivi = await obtenir_suivi_familial(session, suivi_id)
    if suivi.statut in ("arrive", "annule"):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Un passager arrivé ou annulé ne peut plus être réaffecté",
        )

    voyage = await _verifier_existe(session, Voyage, donnees.voyage_id, "Voyage")
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


async def valider_depart_voyage(
    session: AsyncSession, voyage_id: UUID, utilisateur: Utilisateur
) -> dict:
    """« Valider le Départ » : marque **tous** les passagers et colis d'un clic.

    Un seul bouton côté chauffeur enregistre le départ de tous les colis du
    voyage **et** fait passer tous les passagers en route (SMS au parent).
    """
    voyage = await obtenir_voyage(session, voyage_id)
    maintenant = datetime.now(timezone.utc)

    nb_colis = 0
    for colis in await _colis_du_voyage(session, voyage_id):
        if colis.statut not in ("enregistre", "enregistre_direct"):
            continue
        session.add(ColisEvenement(
            colis_id=colis.id, type_evenement="depart", acteur_id=utilisateur.id,
            gare_id=colis.gare_depart_id, horodatage=maintenant,
        ))
        colis.statut = "en_transit"
        ticket = await obtenir_ticket_du_colis(session, colis)
        if ticket is not None:
            ticket.statut = "en_transit"
        await _notifier_scan_colis(session, colis, ticket, "depart", colis.gare_depart_id)
        nb_colis += 1

    nb_passagers = 0
    for suivi in await _passagers_du_voyage(session, voyage_id):
        if suivi.statut not in ("enregistre", "enregistre_direct"):
            continue
        session.add(SuiviFamilialEvenement(
            suivi_familial_id=suivi.id, type_evenement="depart",
            acteur_id=utilisateur.id, gare_id=suivi.gare_depart_id,
            horodatage=maintenant,
        ))
        suivi.statut = "en_route"
        await _notifier_suivi(session, suivi, "depart", suivi.gare_depart_id)
        nb_passagers += 1

    if voyage.statut == "planifie":
        voyage.statut = "en_cours"
    await session.commit()
    return {
        "type_action": "depart",
        "voyage_id": voyage_id,
        "nb_colis": nb_colis,
        "nb_passagers": nb_passagers,
        "message": (
            f"Départ validé : {nb_passagers} passager(s) et {nb_colis} colis en route."
        ),
    }


async def marquer_arrivee_voyage(
    session: AsyncSession,
    voyage_id: UUID,
    utilisateur: Utilisateur,
    gare_id: UUID | None = None,
    localisation: str | None = None,
) -> dict:
    """« Arrivés » en lot : tous les passagers et colis d'une même gare d'un clic.

    Sans ``gare_id``, on marque arrivés tous les colis et passagers du voyage.
    """
    await obtenir_voyage(session, voyage_id)
    maintenant = datetime.now(timezone.utc)
    lieu = await _libelle_gare(session, gare_id)

    nb_colis = 0
    for colis in await _colis_du_voyage(session, voyage_id):
        if colis.statut not in ("enregistre", "enregistre_direct", "en_transit"):
            continue
        if gare_id is not None and colis.gare_arrivee_id != gare_id:
            continue
        session.add(ColisEvenement(
            colis_id=colis.id, type_evenement="arrivee", acteur_id=utilisateur.id,
            gare_id=gare_id or colis.gare_arrivee_id, localisation=localisation,
            horodatage=maintenant,
        ))
        colis.statut = "arrive"
        ticket = await obtenir_ticket_du_colis(session, colis)
        await _notifier_scan_colis(
            session, colis, ticket, "arrivee", gare_id or colis.gare_arrivee_id
        )
        nb_colis += 1

    nb_passagers = 0
    for suivi in await _passagers_du_voyage(session, voyage_id):
        if suivi.statut not in ("enregistre", "enregistre_direct", "en_route"):
            continue
        if gare_id is not None and suivi.gare_arrivee_id != gare_id:
            continue
        session.add(SuiviFamilialEvenement(
            suivi_familial_id=suivi.id, type_evenement="arrivee",
            acteur_id=utilisateur.id, gare_id=gare_id or suivi.gare_arrivee_id,
            localisation=localisation, horodatage=maintenant,
        ))
        suivi.statut = "arrive"
        await _notifier_suivi(
            session, suivi, "arrivee", gare_id or suivi.gare_arrivee_id
        )
        nb_passagers += 1

    await session.commit()
    return {
        "type_action": "arrivee",
        "voyage_id": voyage_id,
        "nb_colis": nb_colis,
        "nb_passagers": nb_passagers,
        "message": (
            f"Arrivée enregistrée : {nb_passagers} passager(s) et {nb_colis} colis.{lieu and ' ' + lieu or ''}"
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
    await obtenir_voyage(session, voyage_id)
    nb_sms = 0
    nb_passagers = 0
    nb_colis = 0

    for colis in await _colis_du_voyage(session, voyage_id):
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

    for suivi in await _passagers_du_voyage(session, voyage_id):
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
