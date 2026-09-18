
# -*- coding: utf-8 -*-
"""Service OCR Passeport — orchestration du scan et de la sauvegarde."""
import re
import time
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Utilisateur
from src.modeles.passeport import Passeport
from src.modules.ocr_cni.ocr_engine import analyser_image_cni  # OCR partagé
from src.modules.ocr_passeport.extraction_passeport import extraire_donnees_passeport
from src.modules.ocr_passeport.schemas import (
    DonneesPasseportExtraites,
    ListeVerificationsPasseport,
    ReponseUploadPasseport,
    ResultatOCRPasseport,
    VerificationPasseportDetail,
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


def _compter_champs_extraits(donnees: DonneesPasseportExtraites) -> int:
    champs = [
        donnees.numero_passeport, donnees.nom_famille, donnees.prenoms,
        donnees.date_naissance, donnees.date_expiration,
    ]
    return sum(1 for c in champs if c is not None)


async def traiter_upload_passeport(
    session: AsyncSession,
    utilisateur: Utilisateur,
    fichier: UploadFile,
    face: str = "recto",
) -> ReponseUploadPasseport:
    """Traite l'upload d'un passeport : OCR (MRZ TD3), extraction, sauvegarde."""
    debut = time.time()
    contenu = await _lire_image(fichier)

    try:
        res = analyser_image_cni(contenu)
        texte_brut = res.get("texte_brut", "")
        confiance = res.get("confiance_moyenne", 0.0)
        mrz_lignes = res.get("mrz_lignes", (None, None, None))
    except Exception as e:  # pragma: no cover
        journal.error(f"Erreur OCR passeport: {e}")
        texte_brut, confiance, mrz_lignes = "", 0.0, (None, None, None)

    donnees = extraire_donnees_passeport(
        texte_brut=texte_brut, confiance=confiance, mrz_lignes=mrz_lignes,
    )
    nb_champs = _compter_champs_extraits(donnees)
    temps_ms = int((time.time() - debut) * 1000)

    def _reponse(statut: str, message: str, erreurs: list) -> ReponseUploadPasseport:
        return ReponseUploadPasseport(
            id=ZERO_UUID, statut=statut,
            resultat_ocr=ResultatOCRPasseport(
                succes=False, donnees=donnees, erreurs=erreurs,
                champs_extraits=nb_champs, temps_analyse_ms=temps_ms,
            ),
            message=message,
        )

    # Champ critique : n° de passeport (colonne NOT NULL).
    if not donnees.numero_passeport:
        journal.warning(f"REJET PASSEPORT | n° passeport absent | user={utilisateur.id}")
        return _reponse(
            "rejete",
            "L'OCR n'a pas pu extraire le numéro de passeport. "
            "Reprends une photo nette et bien éclairée (page d'identité + MRZ visibles).",
            ["Numéro de passeport non extrait."],
        )

    date_expiration = _parser_date(donnees.date_expiration, est_expiration=True)
    statut = "approuve"
    if date_expiration and date_expiration < date.today():
        statut = "expiree"

    nouveau = Passeport(
        utilisateur_id=utilisateur.id,
        numero_passeport=donnees.numero_passeport,
        type_passeport=donnees.type_passeport,
        nom_famille=donnees.nom_famille,
        prenoms=donnees.prenoms,
        sexe=(None if donnees.sexe in (None, "non_detecte") else donnees.sexe),
        date_naissance=_parser_date(donnees.date_naissance),
        lieu_naissance=donnees.lieu_naissance,
        nationalite=donnees.nationalite,
        autorite_delivrance=donnees.autorite_delivrance,
        pays_emetteur=donnees.pays_emetteur,
        date_delivrance=_parser_date(donnees.date_delivrance),
        date_expiration=date_expiration,
        mrz_ligne_1=donnees.mrz_ligne_1,
        mrz_ligne_2=donnees.mrz_ligne_2,
        mrz_valide=donnees.mrz_valide,
        est_valide=(statut == "approuve"),
    )
    session.add(nouveau)
    await session.commit()
    await session.refresh(nouveau)

    if date_expiration:
        from src.noyau.rappels_expiration import notifier_expiration_proche
        await notifier_expiration_proche(session, utilisateur, "passeport", date_expiration)

    journal.info(
        f"Passeport enregistré | user={utilisateur.id} | "
        f"numero={donnees.numero_passeport} | temps={temps_ms}ms"
    )

    return ReponseUploadPasseport(
        id=nouveau.id,
        statut=statut,
        resultat_ocr=ResultatOCRPasseport(
            succes=True, donnees=donnees, erreurs=[],
            champs_extraits=nb_champs, temps_analyse_ms=temps_ms,
        ),
        message="Passeport scanné et enregistré avec succès.",
    )


def _vers_detail(passeport: Passeport) -> VerificationPasseportDetail:
    return VerificationPasseportDetail(
        id=passeport.id,
        utilisateur_id=passeport.utilisateur_id,
        statut="approuve" if passeport.est_valide else "expiree",
        nom_fichier=f"passeport_{passeport.numero_passeport}.jpg",
        numero_passeport=passeport.numero_passeport,
        type_passeport=passeport.type_passeport,
        nom_famille=passeport.nom_famille,
        prenoms=passeport.prenoms,
        sexe=passeport.sexe,
        nationalite=passeport.nationalite,
        pays_emetteur=passeport.pays_emetteur,
        date_delivrance=passeport.date_delivrance.isoformat() if passeport.date_delivrance else None,
        date_expiration=passeport.date_expiration.isoformat() if passeport.date_expiration else None,
        mrz_valide=bool(passeport.mrz_valide),
        taux_confiance_ocr=None,
        cree_le=passeport.cree_le,
        est_supprime=False,
    )


async def obtenir_historique_passeport(
    session: AsyncSession,
    utilisateur: Utilisateur,
    limite: int = 20,
) -> ListeVerificationsPasseport:
    resultat = await session.execute(
        select(Passeport)
        .where(Passeport.utilisateur_id == utilisateur.id)
        .order_by(desc(Passeport.cree_le))
        .limit(limite)
    )
    enregistrements = resultat.scalars().all()
    historique = [_vers_detail(p) for p in enregistrements]
    return ListeVerificationsPasseport(historique=historique, total=len(historique))
