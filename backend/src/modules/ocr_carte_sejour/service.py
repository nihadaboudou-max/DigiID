# -*- coding: utf-8 -*-
"""Service OCR Carte de Séjour — orchestration du scan et de la sauvegarde."""
import re
import time
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Utilisateur
from src.modeles.carte_sejour import CarteSejour
from src.modules.ocr_cni.ocr_engine import analyser_image_cni  # OCR partagé
from src.modules.ocr_carte_sejour.extraction_carte_sejour import extraire_donnees_carte_sejour
from src.modules.ocr_carte_sejour.schemas import (
    DonneesCarteSejourExtraites,
    ListeVerificationsCarteSejour,
    ReponseUploadCarteSejour,
    ResultatOCRCarteSejour,
    VerificationCarteSejourDetail,
)
from src.noyau import journal
from src.noyau.exceptions import ErreurValidation

TAILLE_MAX_IMAGE = 15 * 1024 * 1024  # 15 Mo
TYPES_MIME_AUTORISES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
ZERO_UUID = UUID("00000000-0000-0000-0000-000000000000")


async def _lire_image(fichier: UploadFile) -> bytes:
    if fichier.content_type not in TYPES_MIME_AUTORISES:
        raise ErreurValidation(
            f"Type MIME refusé : {fichier.content_type}",
            message_utilisateur="Format d'image non supporté. Utilise JPG, PNG ou WEBP.",
        )
    contenu = await fichier.read()
    if not contenu:
        raise ErreurValidation("Fichier vide reçu.", message_utilisateur="Le fichier est vide.")
    if len(contenu) > TAILLE_MAX_IMAGE:
        raise ErreurValidation(
            f"Image trop volumineuse : {len(contenu)} octets",
            message_utilisateur=f"L'image dépasse {TAILLE_MAX_IMAGE // 1024 // 1024} Mo.",
        )
    return contenu


def _parser_date(chaine_date: Optional[str], est_expiration: bool = False) -> Optional[date]:
    if not chaine_date:
        return None
    trouves = re.findall(r"\d{1,2}[./-]\d{1,2}[./-]\d{2,4}", chaine_date)
    if not trouves:
        return None
    cible = trouves[-1] if est_expiration else trouves[0]
    for fmt in ["%d.%m.%Y", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%y", "%d/%m/%y", "%d-%m-%y"]:
        try:
            return datetime.strptime(cible, fmt).date()
        except ValueError:
            continue
    return None


def _compter_champs_extraits(donnees: DonneesCarteSejourExtraites) -> int:
    champs = [
        donnees.numero_titre, donnees.nom_famille, donnees.prenoms,
        donnees.date_naissance, donnees.nationalite, donnees.date_expiration,
    ]
    return sum(1 for c in champs if c is not None)


async def traiter_upload_carte_sejour(
    session: AsyncSession,
    utilisateur: Utilisateur,
    fichier: UploadFile,
) -> ReponseUploadCarteSejour:
    """Traite l'upload d'une carte de séjour : OCR, extraction, sauvegarde."""
    debut = time.time()
    contenu = await _lire_image(fichier)

    try:
        res = analyser_image_cni(contenu)
        texte_brut = res.get("texte_brut", "")
        confiance = res.get("confiance_moyenne", 0.0)
        mrz_lignes = res.get("mrz_lignes", (None, None, None))
    except Exception as e:  # pragma: no cover
        journal.error(f"Erreur OCR carte séjour: {e}")
        texte_brut, confiance, mrz_lignes = "", 0.0, (None, None, None)

    donnees = extraire_donnees_carte_sejour(
        texte_brut=texte_brut, confiance=confiance, mrz_lignes=mrz_lignes,
    )
    nb_champs = _compter_champs_extraits(donnees)
    temps_ms = int((time.time() - debut) * 1000)

    def _reponse(statut: str, message: str, erreurs: list) -> ReponseUploadCarteSejour:
        return ReponseUploadCarteSejour(
            id=ZERO_UUID, statut=statut,
            resultat_ocr=ResultatOCRCarteSejour(
                succes=False, donnees=donnees, erreurs=erreurs,
                champs_extraits=nb_champs, temps_analyse_ms=temps_ms,
            ),
            message=message,
        )

    # Champ critique : numéro de titre (colonne NOT NULL).
    if not donnees.numero_titre:
        journal.warning(f"REJET CARTE SEJOUR | n° titre absent | user={utilisateur.id}")
        return _reponse(
            "rejete",
            "L'OCR n'a pas pu extraire le numéro du titre de séjour. Reprends une photo nette.",
            ["Numéro de titre non extrait."],
        )

    date_expiration = _parser_date(donnees.date_expiration, est_expiration=True)

    # 🔴 Rejet : titre expiré (date d'expiration obligatoire sur un titre de séjour).
    if date_expiration and date_expiration < date.today():
        journal.warning(
            f"REJET CARTE SEJOUR | expiré | user={utilisateur.id} | exp={date_expiration}"
        )
        return _reponse(
            "expiree",
            f"Ce titre de séjour est expiré depuis le {date_expiration.strftime('%d/%m/%Y')}. "
            "Renouvelle-le avant de l'utiliser avec DigiID.",
            ["Titre expiré."],
        )

    nouvelle = CarteSejour(
        utilisateur_id=utilisateur.id,
        type_titre=donnees.type_titre,
        numero_titre=donnees.numero_titre,
        categorie=donnees.categorie,
        nom_famille=donnees.nom_famille,
        prenoms=donnees.prenoms,
        sexe=donnees.sexe,
        date_naissance=_parser_date(donnees.date_naissance),
        lieu_naissance=donnees.lieu_naissance,
        nationalite=donnees.nationalite,
        adresse=donnees.adresse,
        autorite_delivrance=donnees.autorite_delivrance,
        pays_emetteur=donnees.pays_emetteur,
        date_delivrance=_parser_date(donnees.date_delivrance),
        date_expiration=date_expiration,
        mrz_ligne_1=donnees.mrz_ligne_1,
        mrz_ligne_2=donnees.mrz_ligne_2,
        mrz_ligne_3=donnees.mrz_ligne_3,
        est_valide=True,
    )
    session.add(nouvelle)
    await session.commit()
    await session.refresh(nouvelle)

    if date_expiration:
        from src.noyau.rappels_expiration import notifier_expiration_proche
        await notifier_expiration_proche(session, utilisateur, "carte_sejour", date_expiration)

    journal.info(
        f"Carte séjour enregistrée | user={utilisateur.id} | "
        f"titre={donnees.numero_titre} | temps={temps_ms}ms"
    )

    return ReponseUploadCarteSejour(
        id=nouvelle.id,
        statut="approuve",
        resultat_ocr=ResultatOCRCarteSejour(
            succes=True, donnees=donnees, erreurs=[],
            champs_extraits=nb_champs, temps_analyse_ms=temps_ms,
        ),
        message="Titre de séjour scanné et enregistré avec succès.",
    )


def _vers_detail(carte: CarteSejour) -> VerificationCarteSejourDetail:
    return VerificationCarteSejourDetail(
        id=carte.id,
        utilisateur_id=carte.utilisateur_id,
        statut="approuve" if carte.est_valide else "expiree",
        nom_fichier=f"carte_sejour_{carte.numero_titre}.jpg",
        type_titre=carte.type_titre,
        numero_titre=carte.numero_titre,
        nom_famille=carte.nom_famille,
        prenoms=carte.prenoms,
        nationalite=carte.nationalite,
        date_naissance=carte.date_naissance.isoformat() if carte.date_naissance else None,
        date_delivrance=carte.date_delivrance.isoformat() if carte.date_delivrance else None,
        date_expiration=carte.date_expiration.isoformat() if carte.date_expiration else None,
        autorite_delivrance=carte.autorite_delivrance,
        taux_confiance_ocr=None,
        cree_le=carte.cree_le,
        est_supprime=False,
    )


async def obtenir_historique_carte_sejour(
    session: AsyncSession,
    utilisateur: Utilisateur,
    limite: int = 20,
) -> ListeVerificationsCarteSejour:
    resultat = await session.execute(
        select(CarteSejour)
        .where(CarteSejour.utilisateur_id == utilisateur.id)
        .order_by(desc(CarteSejour.cree_le))
        .limit(limite)
    )
    enregistrements = resultat.scalars().all()
    historique = [_vers_detail(c) for c in enregistrements]
    return ListeVerificationsCarteSejour(historique=historique, total=len(historique))
