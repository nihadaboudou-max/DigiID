# -*- coding: utf-8 -*-
"""
Service Identité DigiID — carte citoyenne, profils logistiques, manifestes.

Règle de sécurité constante : **le guichet n'obtient jamais plus que le strict
nécessaire**. La recherche par carte ne renvoie que nom, téléphone, ville et
adresse — ni email, ni photo, ni documents.
"""
import secrets
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import (
    Gare, Ligne, Vehicule, Voyage, Utilisateur,
    Colis, SuiviFamilial, ProfilLogistique,
)
from src.modules.identite_digiid import schemas
from src.modules.qr_dynamique.service import (
    generer_token_durable,
    construire_url_qr_durable,
)
from src.noyau import dechiffrer_donnee

# Chemin frontend encodé dans le QR de la carte DigiID.
# Il pointe vers la page **guichet** (et non vers la carte du citoyen) : un agent
# qui scanne avec l'appareil photo natif tombe directement sur la fiche du client
# à pré-remplir — et un simple passant sans compte ne voit rien de sensible.
CHEMIN_QR_CARTE = "guichet/carte"

# Préfixes lisibles des identifiants publics de dossier logistique.
PREFIXES_IDENTIFIANT = {"chauffeur": "CHF-", "receveur": "REC-"}


# ─── Utilitaires ─────────────────────────────────────────────────────

def _dechiffrer(valeur: str | None) -> str | None:
    """Déchiffre sans jamais faire échouer la requête (clé absente, données altérées)."""
    if not valeur:
        return None
    try:
        return dechiffrer_donnee(valeur)
    except Exception:
        return None


def nom_complet(utilisateur: Utilisateur) -> str:
    """« Prénom Nom » (repli sur le DigiID public puis « Citoyen »)."""
    prenom = _dechiffrer(utilisateur.prenom_chiffre) or ""
    nom = _dechiffrer(utilisateur.nom_chiffre) or ""
    return f"{prenom} {nom}".strip() or utilisateur.digiid_public or "Citoyen"


def telephone(utilisateur: Utilisateur) -> str | None:
    return _dechiffrer(utilisateur.telephone_chiffre)


async def _nom_gare(session: AsyncSession, gare_id: UUID | None) -> str | None:
    if gare_id is None:
        return None
    gare = await session.get(Gare, gare_id)
    return f"{gare.nom} ({gare.ville})" if gare else None


async def _nom_utilisateur(session: AsyncSession, utilisateur_id: UUID | None) -> str | None:
    if utilisateur_id is None:
        return None
    utilisateur = await session.get(Utilisateur, utilisateur_id)
    return nom_complet(utilisateur) if utilisateur else None


def _masquer_telephone(valeur: str | None) -> str | None:
    """Masque un numéro pour un affichage public (« 77 ** ** 67 »)."""
    if not valeur:
        return None
    chiffres = valeur.replace(" ", "").strip()
    if len(chiffres) <= 4:
        return "*" * len(chiffres)
    return f"{chiffres[:2]} ** ** {chiffres[-2:]}"


# ─── Carte citoyenne (QR durable) ────────────────────────────────────

async def obtenir_ou_creer_carte(
    session: AsyncSession, utilisateur: Utilisateur
) -> schemas.CarteDigiIDResponse:
    """Retourne la carte DigiID du citoyen, en créant le QR durable au besoin.

    Le jeton est **persisté** (``utilisateur.qr_token_digiid``) : la carte reste
    scannable par le guichet et la police sans régénération, contrairement au QR
    dynamique de 30 secondes utilisé pour les contrôles ponctuels.
    """
    deja_genere = bool(utilisateur.qr_token_digiid)
    if not utilisateur.qr_token_digiid:
        utilisateur.qr_token_digiid = generer_token_durable(f"digiid:{utilisateur.id}")
        await session.commit()
        await session.refresh(utilisateur)

    token = utilisateur.qr_token_digiid or ""
    return schemas.CarteDigiIDResponse(
        utilisateur_id=utilisateur.id,
        digiid_public=utilisateur.digiid_public,
        nom_complet=nom_complet(utilisateur),
        telephone=telephone(utilisateur),
        ville=utilisateur.ville,
        adresse=utilisateur.adresse,
        role=utilisateur.role,
        qr_token=token,
        qr_code_url=construire_url_qr_durable(token, chemin=CHEMIN_QR_CARTE),
        deja_genere=deja_genere,
    )


async def rechercher_contact(
    session: AsyncSession, requete: schemas.RechercheDigiIDRequest
) -> schemas.ContactDigiIDResponse:
    """Retrouve un citoyen par DigiID public ou par QR de carte (scan guichet).

    C'est **le** point qui supprime la ressaisie au guichet : le commerçant ou
    l'agent scanne la carte, la fiche se pré-remplit avec des données exactes
    (donc les SMS de suivi partent vers le bon numéro).
    """
    brut = requete.digiid.strip()
    if not brut:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Identifiant DigiID vide")

    utilisateur: Utilisateur | None = None
    correspondance = "digiid"

    if brut.startswith("http://") or brut.startswith("https://"):
        # URL complète du QR scannée par un téléphone : on extrait ?token=…
        from urllib.parse import urlparse, parse_qs

        params = parse_qs(urlparse(brut).query)
        token = (params.get("token") or [""])[0].strip()
        if not token:
            token = brut.rstrip("/").rsplit("/", 1)[-1]
        utilisateur = await session.scalar(
            select(Utilisateur).where(Utilisateur.qr_token_digiid == token)
        )
        correspondance = "qr"
    else:
        candidat = brut.upper()
        utilisateur = await session.scalar(
            select(Utilisateur).where(Utilisateur.digiid_public == candidat)
        )
        if utilisateur is None:
            # Tolérance : jeton QR collé sans URL (copié depuis l'image).
            utilisateur = await session.scalar(
                select(Utilisateur).where(Utilisateur.qr_token_digiid == brut)
            )
            if utilisateur is not None:
                correspondance = "qr"

    if utilisateur is None or utilisateur.est_supprime or not utilisateur.est_actif:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail="Aucun compte DigiID ne correspond à cette carte. "
                   "Vérifiez le code ou créez une fiche manuelle.",
        )

    return schemas.ContactDigiIDResponse(
        utilisateur_id=utilisateur.id,
        digiid_public=utilisateur.digiid_public,
        nom_complet=nom_complet(utilisateur),
        telephone=telephone(utilisateur),
        ville=utilisateur.ville,
        adresse=utilisateur.adresse,
        role=utilisateur.role,
        correspondance=correspondance,
    )


# ─── Profil logistique (dossier professionnel) ───────────────────────

def _champs_manquants(profil: ProfilLogistique) -> list[str]:
    """Liste des éléments encore à fournir/valider (pilotage du terrain)."""
    manquants: list[str] = []
    if not profil.numero_piece:
        manquants.append("numero_piece")
    if not profil.piece_verifiee:
        manquants.append("piece_verifiee")
    if profil.type_profil == "chauffeur":
        if not profil.permis_numero:
            manquants.append("permis_numero")
        if not profil.permis_verifie:
            manquants.append("permis_verifie")
        if not profil.vehicule_immatriculation:
            manquants.append("vehicule_immatriculation")
    if not profil.photo_verifiee:
        manquants.append("photo_verifiee")
    return manquants


async def enrichir_profil(
    session: AsyncSession, profil: ProfilLogistique
) -> ProfilLogistique:
    """Ajoute les libellés lisibles + la liste des éléments restant à valider."""
    profil.utilisateur_nom = await _nom_utilisateur(session, profil.utilisateur_id)
    profil.verifie_par_nom = await _nom_utilisateur(session, profil.verifie_par_id)
    profil.champs_manquants = _champs_manquants(profil)
    return profil


async def _generer_identifiant_public(
    session: AsyncSession, type_profil: str
) -> str:
    """Identifiant lisible et unique du dossier, ex. « CHF-7K2M4P »."""
    prefixe = PREFIXES_IDENTIFIANT.get(type_profil, "LOG-")
    for _ in range(20):
        candidat = f"{prefixe}{secrets.token_hex(3).upper()}"
        existant = await session.scalar(
            select(ProfilLogistique.id).where(
                ProfilLogistique.identifiant_public == candidat
            )
        )
        if existant is None:
            return candidat
    # Repli : garantir l'unicité par un suffixe long.
    return f"{prefixe}{secrets.token_hex(6).upper()}"


async def obtenir_profil_logistique(
    session: AsyncSession, utilisateur_id: UUID
) -> ProfilLogistique:
    profil = await session.scalar(
        select(ProfilLogistique).where(ProfilLogistique.utilisateur_id == utilisateur_id)
    )
    if profil is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail="Aucun dossier logistique pour ce compte. Complétez-le depuis « Ma carte ».",
        )
    return profil


async def enregistrer_profil_logistique(
    session: AsyncSession,
    utilisateur: Utilisateur,
    donnees: schemas.ProfilLogistiqueCreate,
) -> ProfilLogistique:
    """Crée ou met à jour le dossier professionnel de l'acteur connecté.

    Une modification **réinitialise la vérification métier** dès qu'un élément
    contrôlé change (pièce, permis, véhicule) : on ne peut pas valider un dossier
    puis changer l'immatriculation sans repasser par le gérant de gare.
    """
    profil = await session.scalar(
        select(ProfilLogistique).where(ProfilLogistique.utilisateur_id == utilisateur.id)
    )
    if profil is None:
        profil = ProfilLogistique(
            utilisateur_id=utilisateur.id,
            type_profil=donnees.type_profil,
            identifiant_public=await _generer_identifiant_public(
                session, donnees.type_profil
            ),
        )
        session.add(profil)

    elements_controles = (
        "type_profil", "type_piece", "numero_piece",
        "permis_numero", "permis_categorie", "permis_expiration",
        "vehicule_immatriculation", "vehicule_marque", "vehicule_modele",
        "vehicule_capacite",
    )
    valeurs = donnees.model_dump(exclude_unset=True)
    reinitialiser = False
    for champ in elements_controles:
        if champ in valeurs and valeurs[champ] != getattr(profil, champ):
            setattr(profil, champ, valeurs[champ])
            reinitialiser = True

    if reinitialiser and profil.statut_verification != "en_attente":
        profil.statut_verification = "en_attente"
        profil.est_verifie = False
        profil.piece_verifiee = False
        profil.permis_verifie = False
        profil.photo_verifiee = False
        profil.verifie_le = None
        profil.notes = None

    await session.commit()
    await session.refresh(profil)
    return await enrichir_profil(session, profil)


async def verifier_profil_logistique(
    session: AsyncSession,
    utilisateur_id: UUID,
    donnees: schemas.VerificationProfilRequest,
    verificateur: Utilisateur,
) -> ProfilLogistique:
    """Valide (ou refuse) un dossier logistique — réservé au gérant de gare.

    La validation n'est acquise que lorsque **tous** les éléments exigés sont
    cochés : pièce d'identité, photo, et permis + véhicule pour un chauffeur.
    """
    profil = await obtenir_profil_logistique(session, utilisateur_id)
    profil.piece_verifiee = donnees.piece_verifiee
    profil.permis_verifie = donnees.permis_verifie
    profil.photo_verifiee = donnees.photo_verifiee
    if donnees.notes is not None:
        profil.notes = donnees.notes

    exigences_ok = (
        donnees.piece_verifiee
        and donnees.photo_verifiee
        and (donnees.permis_verifie or profil.type_profil != "chauffeur")
    )
    profil.est_verifie = exigences_ok
    profil.statut_verification = "verifie" if exigences_ok else "en_attente"
    if exigences_ok:
        profil.verifie_le = datetime.now(timezone.utc)
        profil.verifie_par_id = verificateur.id
    else:
        profil.verifie_le = None
        profil.verifie_par_id = None

    await session.commit()
    await session.refresh(profil)
    profil = await enrichir_profil(session, profil)
    profil.verifie_par_nom = await _nom_utilisateur(session, verificateur.id)
    return profil


# ─── Manifeste du chauffeur ──────────────────────────────────────────

async def _libelle_ligne(session: AsyncSession, ligne_id: UUID) -> tuple[str | None, str | None]:
    ligne = await session.get(Ligne, ligne_id)
    if ligne is None:
        return None, None
    return (
        await _nom_gare(session, ligne.gare_depart_id),
        await _nom_gare(session, ligne.gare_arrivee_id),
    )


async def _voyage_du_chauffeur(
    session: AsyncSession, voyage_id: UUID, utilisateur: Utilisateur
) -> Voyage:
    voyage = await session.get(Voyage, voyage_id)
    if voyage is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Voyage introuvable")
    if voyage.chauffeur_id != utilisateur.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Ce voyage n'est pas affecté à votre compte.",
        )
    return voyage


async def _codes_colis(session: AsyncSession, colis: Colis) -> str:
    """Code clair du ticket d'un colis (repli : identifiant court)."""
    if colis.ticket_id is not None:
        from src.modeles import Ticket

        ticket = await session.get(Ticket, colis.ticket_id)
        if ticket is not None:
            return ticket.code_clair
    return str(colis.id)[:8].upper()


async def _codes_suivi(session: AsyncSession, suivi: SuiviFamilial) -> str:
    if suivi.ticket_id is not None:
        from src.modeles import Ticket

        ticket = await session.get(Ticket, suivi.ticket_id)
        if ticket is not None:
            return ticket.code_clair
    return str(suivi.id)[:8].upper()


async def _colis_du_voyage(session: AsyncSession, voyage_id: UUID) -> list[Colis]:
    resultat = await session.execute(
        select(Colis).where(Colis.voyage_id == voyage_id).order_by(Colis.cree_le.asc())
    )
    return list(resultat.scalars().all())


async def _passagers_du_voyage(
    session: AsyncSession, voyage_id: UUID
) -> list[SuiviFamilial]:
    resultat = await session.execute(
        select(SuiviFamilial)
        .where(SuiviFamilial.voyage_id == voyage_id)
        .order_by(SuiviFamilial.cree_le.asc())
    )
    return list(resultat.scalars().all())


async def lister_voyages_chauffeur(
    session: AsyncSession, utilisateur: Utilisateur
) -> list[schemas.VoyageChauffeurResponse]:
    """Voyages affectés au chauffeur connecté (avec volumes à transporter).

    Les voyages « en cours » et « planifiés » remontent en premier : c'est ce
    qu'un chauffeur ouvre en montant dans son véhicule.
    """
    resultat = await session.execute(
        select(Voyage)
        .where(Voyage.chauffeur_id == utilisateur.id)
        .order_by(Voyage.date_depart.desc())
    )
    voyages = list(resultat.scalars().all())

    reponses: list[schemas.VoyageChauffeurResponse] = []
    for voyage in voyages:
        vehicule = await session.get(Vehicule, voyage.vehicule_id)
        depart, arrivee = await _libelle_ligne(session, voyage.ligne_id)
        nb_colis = len(await _colis_du_voyage(session, voyage.id))
        nb_passagers = len(await _passagers_du_voyage(session, voyage.id))
        reponses.append(
            schemas.VoyageChauffeurResponse(
                id=voyage.id,
                date_depart=voyage.date_depart,
                date_arrivee=voyage.date_arrivee,
                statut=voyage.statut,
                vehicule_immatriculation=vehicule.immatriculation if vehicule else None,
                gare_depart_nom=depart,
                gare_arrivee_nom=arrivee,
                nb_colis=nb_colis,
                nb_passagers=nb_passagers,
            )
        )

    ordre = {"en_cours": 0, "planifie": 1, "termine": 2, "annule": 3}
    reponses.sort(key=lambda v: (ordre.get(v.statut, 9), -(v.date_depart.timestamp() if v.date_depart else 0)))
    return reponses


async def construire_manifeste(
    session: AsyncSession, voyage_id: UUID, utilisateur: Utilisateur
) -> schemas.ManifesteVoyageResponse:
    """Manifeste complet d'un voyage : colis **et** passagers, sur un écran."""
    voyage = await _voyage_du_chauffeur(session, voyage_id, utilisateur)
    vehicule = await session.get(Vehicule, voyage.vehicule_id)
    depart, arrivee = await _libelle_ligne(session, voyage.ligne_id)

    colis_liste = await _colis_du_voyage(session, voyage.id)
    passagers_liste = await _passagers_du_voyage(session, voyage.id)

    lignes_colis = [
        schemas.LigneManifeste(
            id=colis.id,
            type="colis",
            code=await _codes_colis(session, colis),
            libelle=colis.destinataire_nom,
            contact_masque=_masquer_telephone(colis.destinataire_tel),
            gare_depart_nom=await _nom_gare(session, colis.gare_depart_id),
            gare_arrivee_nom=await _nom_gare(session, colis.gare_arrivee_id),
            statut=colis.statut,
            nombre_bagages=colis.nombre_bagages or 1,
            nombre_articles=colis.nombre_articles or 1,
            mode_enregistrement=colis.mode_enregistrement,
            enregistre_le=colis.cree_le,
        )
        for colis in colis_liste
    ]

    lignes_passagers = [
        schemas.LigneManifeste(
            id=suivi.id,
            type="passager",
            code=await _codes_suivi(session, suivi),
            libelle=suivi.enfant_nom,
            contact_masque=_masquer_telephone(suivi.telephone_parent),
            gare_depart_nom=await _nom_gare(session, suivi.gare_depart_id),
            gare_arrivee_nom=await _nom_gare(session, suivi.gare_arrivee_id),
            statut=suivi.statut,
            nombre_bagages=suivi.nombre_bagages or 1,
            mode_enregistrement=suivi.mode_enregistrement,
            enregistre_le=suivi.cree_le,
        )
        for suivi in passagers_liste
    ]

    return schemas.ManifesteVoyageResponse(
        voyage_id=voyage.id,
        date_depart=voyage.date_depart,
        statut=voyage.statut,
        vehicule_immatriculation=vehicule.immatriculation if vehicule else None,
        gare_depart_nom=depart,
        gare_arrivee_nom=arrivee,
        nb_colis=len(lignes_colis),
        nb_passagers=len(lignes_passagers),
        nb_bagages=sum(l.nombre_bagages for l in lignes_colis)
        + sum(l.nombre_bagages for l in lignes_passagers),
        colis=lignes_colis,
        passagers=lignes_passagers,
    )


# ─── Voyages du citoyen (ses envois + les voyages de ses proches) ────

async def _details_voyage(
    session: AsyncSession, voyage_id: UUID | None
) -> tuple[datetime | None, str | None, str | None]:
    """(date_depart, immatriculation, nom du chauffeur) d'un voyage."""
    if voyage_id is None:
        return None, None, None
    voyage = await session.get(Voyage, voyage_id)
    if voyage is None:
        return None, None, None
    vehicule = await session.get(Vehicule, voyage.vehicule_id)
    chauffeur = await _nom_utilisateur(session, voyage.chauffeur_id)
    return (
        voyage.date_depart,
        vehicule.immatriculation if vehicule else None,
        chauffeur,
    )


async def mes_voyages(
    session: AsyncSession, utilisateur: Utilisateur
) -> schemas.MesVoyagesResponse:
    """Tout ce qui relie le citoyen au transport : ses envois et ses proches.

    Trois filets successifs (et non un seul) pour ne rien manquer :
      - colis dont il est **expéditeur** (compte DigiID) ;
      - colis dont il est **destinataire** (numéro de téléphone identique) ;
      - passagers dont il est le **responsable**, l'**acheteur**, le **proche de
        confiance** ou le parent rattaché à son compte.
    """
    mon_tel = telephone(utilisateur)

    conditions_colis = [Colis.expediteur_id == utilisateur.id]
    if mon_tel:
        conditions_colis.append(Colis.destinataire_tel == mon_tel)

    resultat_colis = await session.execute(
        select(Colis)
        .where(or_(*conditions_colis))
        .order_by(Colis.cree_le.desc())
        .limit(100)
    )
    colis_liste = list(resultat_colis.scalars().all())

    conditions_suivi = [SuiviFamilial.parent_id == utilisateur.id]
    if mon_tel:
        conditions_suivi.extend([
            SuiviFamilial.telephone_parent == mon_tel,
            SuiviFamilial.acheteur_tel == mon_tel,
            SuiviFamilial.proche_telephone == mon_tel,
        ])

    resultat_suivi = await session.execute(
        select(SuiviFamilial)
        .where(or_(*conditions_suivi))
        .order_by(SuiviFamilial.cree_le.desc())
        .limit(100)
    )
    suivis = list(resultat_suivi.scalars().all())

    voyages_colis: list[schemas.VoyageCitoyen] = []
    for colis in colis_liste:
        code = await _codes_colis(session, colis)
        date_depart, immatriculation, chauffeur = await _details_voyage(
            session, colis.voyage_id
        )
        voyages_colis.append(
            schemas.VoyageCitoyen(
                id=colis.id,
                type="colis",
                code=code,
                libelle=colis.destinataire_nom,
                statut=colis.statut,
                gare_depart_nom=await _nom_gare(session, colis.gare_depart_id),
                gare_arrivee_nom=await _nom_gare(session, colis.gare_arrivee_id),
                date_depart=date_depart,
                vehicule_immatriculation=immatriculation,
                chauffeur_nom=chauffeur,
                nombre_bagages=colis.nombre_bagages or 1,
                lien=f"/suivi/{code}",
            )
        )

    voyages_passagers: list[schemas.VoyageCitoyen] = []
    for suivi in suivis:
        code = await _codes_suivi(session, suivi)
        date_depart, immatriculation, chauffeur = await _details_voyage(
            session, suivi.voyage_id
        )
        voyages_passagers.append(
            schemas.VoyageCitoyen(
                id=suivi.id,
                type="passager",
                code=code,
                libelle=suivi.enfant_nom,
                statut=suivi.statut,
                gare_depart_nom=await _nom_gare(session, suivi.gare_depart_id),
                gare_arrivee_nom=await _nom_gare(session, suivi.gare_arrivee_id),
                date_depart=date_depart,
                vehicule_immatriculation=immatriculation,
                chauffeur_nom=chauffeur,
                nombre_bagages=suivi.nombre_bagages or 1,
                lien=f"/suivi/{code}",
            )
        )

    return schemas.MesVoyagesResponse(colis=voyages_colis, passagers=voyages_passagers)
