# -*- coding: utf-8 -*-
"""Service OCR Consulaire — orchestration du scan et de la sauvegarde."""
import re
import time
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Utilisateur
from src.modeles.consulaire import CarteConsulaire
from src.modules.ocr_cni.ocr_engine import analyser_image_cni  # OCR partagé
from src.modules.ocr_consulaire.extraction_consulaire import extraire_donnees_consulaire
from src.modules.ocr_consulaire.schemas import (
    DonneesConsulaireExtraites,
    ListeVerificationsConsulaire,
    ReponseUploadConsulaire,
    ResultatOCRConsulaire,
    VerificationConsulaireDetail,
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


def _compter_champs_extraits(donnees: DonneesConsulaireExtraites) -> int:
    champs = [
        donnees.numero_immatriculation_consulaire, donnees.nom_famille,
        donnees.prenoms, donnees.poste_consulaire, donnees.numero_passeport,
        donnees.date_expiration,
    ]
    return sum(1 for c in champs if c is not None)


async def traiter_upload_consulaire(
    session: AsyncSession,
    utilisateur: Utilisateur,
    fichier: UploadFile,
) -> ReponseUploadConsulaire:
    """Traite l'upload d'une carte consulaire : OCR, extraction, sauvegarde."""
    debut = time.time()
    contenu = await _lire_image(fichier)

    try:
        res = analyser_image_cni(contenu)
        texte_brut = res.get("texte_brut", "")
        confiance = res.get("confiance_moyenne", 0.0)
    except Exception as e:  # pragma: no cover
        journal.error(f"Erreur OCR consulaire: {e}")
        texte_brut, confiance = "", 0.0

    donnees = extraire_donnees_consulaire(texte_brut=texte_brut, confiance=confiance)
    nb_champs = _compter_champs_extraits(donnees)
    temps_ms = int((time.time() - debut) * 1000)

    def _reponse(statut: str, message: str, erreurs: list) -> ReponseUploadConsulaire:
        return ReponseUploadConsulaire(
            id=ZERO_UUID, statut=statut,
            resultat_ocr=ResultatOCRConsulaire(
                succes=False, donnees=donnees, erreurs=erreurs,
                champs_extraits=nb_champs, temps_analyse_ms=temps_ms,
            ),
            message=message,
        )

    # Champ critique : n° d'immatriculation consulaire (colonne NOT NULL).
    if not donnees.numero_immatriculation_consulaire:
        journal.warning(f"REJET CONSULAIRE | n° immat absent | user={utilisateur.id}")
        return _reponse(
            "rejete",
            "L'OCR n'a pas pu extraire le numéro d'immatriculation consulaire. "
            "Reprends une photo nette et bien éclairée.",
            ["Numéro d'immatriculation consulaire non extrait."],
        )

    date_expiration = _parser_date(donnees.date_expiration, est_expiration=True)
    statut = "approuve"
    if date_expiration and date_expiration < date.today():
        statut = "expiree"

    nouvelle = CarteConsulaire(
        utilisateur_id=utilisateur.id,
        numero_immatriculation_consulaire=donnees.numero_immatriculation_consulaire,
        numero_passeport=donnees.numero_passeport,
        nom_famille=donnees.nom_famille,
        prenoms=donnees.prenoms,
        date_naissance=_parser_date(donnees.date_naissance),
        lieu_naissance=donnees.lieu_naissance,
        nationalite=donnees.nationalite,
        profession=donnees.profession,
        situation_matrimoniale=donnees.situation_matrimoniale,
        adresse=donnees.adresse,
        poste_consulaire=donnees.poste_consulaire,
        pays_emetteur=donnees.pays_emetteur,
        personnes_a_charge=donnees.personnes_a_charge,
        date_delivrance=_parser_date(donnees.date_delivrance),
        date_expiration=date_expiration,
        est_valide=(statut == "approuve"),
    )
    session.add(nouvelle)
    await session.commit()
    await session.refresh(nouvelle)

    if date_expiration:
        from src.noyau.rappels_expiration import notifier_expiration_proche
        await notifier_expiration_proche(session, utilisateur, "consulaire", date_expiration)

    journal.info(
        f"Carte consulaire enregistrée | user={utilisateur.id} | "
        f"immat={donnees.numero_immatriculation_consulaire} | temps={temps_ms}ms"
    )

    return ReponseUploadConsulaire(
        id=nouvelle.id,
        statut=statut,
        resultat_ocr=ResultatOCRConsulaire(
            succes=True, donnees=donnees, erreurs=[],
            champs_extraits=nb_champs, temps_analyse_ms=temps_ms,
        ),
        message="Carte consulaire scannée et enregistrée avec succès.",
    )


def _vers_detail(carte: CarteConsulaire) -> VerificationConsulaireDetail:
    return VerificationConsulaireDetail(
        id=carte.id,
        utilisateur_id=carte.utilisateur_id,
        statut="approuve" if carte.est_valide else "expiree",
        nom_fichier=f"consulaire_{carte.numero_immatriculation_consulaire}.jpg",
        numero_immatriculation_consulaire=carte.numero_immatriculation_consulaire,
        numero_passeport=carte.numero_passeport,
        nom_famille=carte.nom_famille,
        prenoms=carte.prenoms,
        nationalite=carte.nationalite,
        poste_consulaire=carte.poste_consulaire,
        date_delivrance=carte.date_delivrance.isoformat() if carte.date_delivrance else None,
        date_expiration=carte.date_expiration.isoformat() if carte.date_expiration else None,
        taux_confiance_ocr=None,
        cree_le=carte.cree_le,
        est_supprime=False,
    )


async def obtenir_historique_consulaire(
    session: AsyncSession,
    utilisateur: Utilisateur,
    limite: int = 20,
) -> ListeVerificationsConsulaire:
    resultat = await session.execute(
        select(CarteConsulaire)
        .where(CarteConsulaire.utilisateur_id == utilisateur.id)
        .order_by(desc(CarteConsulaire.cree_le))
        .limit(limite)
    )
    enregistrements = resultat.scalars().all()
    historique = [_vers_detail(c) for c in enregistrements]
    return ListeVerificationsConsulaire(historique=historique, total=len(historique))
