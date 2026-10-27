# -*- coding: utf-8 -*-
"""Service OCR CIP — orchestration du scan, contrôles QR/visage et sauvegarde."""
import re
import time
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Utilisateur
from src.modeles.cip import CertificatIdentificationPersonnelle
from src.modules.ocr_cip.detection_qr import detecter_qr_code
from src.modules.ocr_cip.extraction_cip import extraire_donnees_cip
from src.modules.ocr_cip.schemas import (
    DonneesCIPExtraites,
    ListeVerificationsCIP,
    ReponseUploadCIP,
    ResultatOCRCIP,
    VerificationCIPDetail,
)
from src.modules.ocr_cni.ocr_engine import analyser_image_cni
from src.noyau import journal
from src.noyau.exceptions import ErreurValidation

TAILLE_MAX_IMAGE = 15 * 1024 * 1024
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


_MOIS_FR_PARSER = {
    "janvier": 1, "fevrier": 2, "février": 2, "mars": 3, "avril": 4,
    "mai": 5, "juin": 6, "juillet": 7, "aout": 8, "août": 8,
    "septembre": 9, "octobre": 10, "ectobre": 10, "novembre": 11, "decembre": 12,
    "décembre": 12,
}


def _parser_date(chaine_date: Optional[str], est_expiration: bool = False) -> Optional[date]:
    if not chaine_date:
        return None
    # Format texte CIP : « 12 octobre 2002 »
    m_fr = re.search(
        r"(\d{1,2})\s*([A-Za-zÉéÈèÊêÀàÙùÔôÎîÛûÇç]{3,12})\s*(\d{4})",
        chaine_date,
        flags=re.IGNORECASE,
    )
    if m_fr:
        jj, mois_nom, aaaa = m_fr.group(1), m_fr.group(2).lower(), m_fr.group(3)
        mois_nom = (
            mois_nom.replace("é", "e").replace("è", "e").replace("ê", "e")
            .replace("à", "a").replace("ù", "u").replace("ô", "o")
            .replace("î", "i").replace("û", "u").replace("ç", "c")
        )
        mois = _MOIS_FR_PARSER.get(mois_nom) or _MOIS_FR_PARSER.get(
            mois_nom.replace("é", "e")
        )
        if mois:
            try:
                return date(int(aaaa), mois, int(jj))
            except ValueError:
                pass

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


def _compter_champs_extraits(donnees: DonneesCIPExtraites) -> int:
    champs = [
        donnees.npi, donnees.nom_famille, donnees.prenoms,
        donnees.date_naissance, donnees.lieu_naissance, donnees.nationalite,
        donnees.date_expiration, donnees.nom_pere, donnees.nom_mere,
    ]
    return sum(1 for c in champs if c is not None)


async def traiter_upload_cip(
    session: AsyncSession,
    utilisateur: Utilisateur,
    fichier: UploadFile,
) -> ReponseUploadCIP:
    """Traite l'upload d'un CIP : OCR, QR, embedding facial, sauvegarde."""
    debut = time.time()
    contenu = await _lire_image(fichier)

    # 1. OCR texte
    try:
        res = analyser_image_cni(contenu)
        texte_brut = res.get("texte_brut", "")
        confiance = res.get("confiance_moyenne", 0.0)
    except Exception as e:  # pragma: no cover
        journal.error(f"Erreur OCR CIP: {e}")
        texte_brut, confiance = "", 0.0

    # 2. QR code (contrôle important)
    qr_detecte, qr_contenu = detecter_qr_code(contenu)

    # 3. Embedding facial (pré-contrôle — l'enregistrement définitif est fait après insert)
    embedding_present = False
    try:
        from src.modules.verification_visuelle.photo_document import extraire_embedding_photo
        embedding_present = extraire_embedding_photo(contenu) is not None
    except Exception as e:
        journal.warning(f"CIP : pré-contrôle embedding échoué ({e})")

    donnees = extraire_donnees_cip(
        texte_brut=texte_brut,
        confiance=confiance,
        qr_detecte=qr_detecte,
        qr_contenu=qr_contenu,
        embedding_present=embedding_present,
    )
    nb_champs = _compter_champs_extraits(donnees)
    temps_ms = int((time.time() - debut) * 1000)

    def _reponse(statut: str, message: str, erreurs: list) -> ReponseUploadCIP:
        return ReponseUploadCIP(
            id=ZERO_UUID,
            statut=statut,
            resultat_ocr=ResultatOCRCIP(
                succes=False,
                donnees=donnees,
                erreurs=erreurs,
                champs_extraits=nb_champs,
                temps_analyse_ms=temps_ms,
            ),
            message=message,
        )

    # Champ critique : NPI
    if not donnees.npi:
        journal.warning(f"REJET CIP | NPI absent | user={utilisateur.id}")
        return _reponse(
            "rejete",
            "L'OCR n'a pas pu extraire le NPI (Numéro Personnel d'Identification). "
            "Reprends une photo nette du CIP.",
            ["NPI non extrait."],
        )

    erreurs: list[str] = []
    if not qr_detecte:
        erreurs.append("QR code absent ou illisible sur le CIP.")
    if not embedding_present:
        erreurs.append("Visage du titulaire non détecté sur la photo du CIP.")

    # Rejet si QR ET visage manquent tous les deux (document probablement invalide / flou)
    if not qr_detecte and not embedding_present:
        journal.warning(
            f"REJET CIP | QR et visage absents | npi={donnees.npi} | user={utilisateur.id}"
        )
        return _reponse(
            "rejete",
            "Le CIP ne présente ni QR code lisible ni photo de visage exploitable. "
            "Reprends une photo nette et complète du document.",
            erreurs,
        )

    date_expiration = _parser_date(donnees.date_expiration, est_expiration=True)
    statut = "approuve"
    if date_expiration and date_expiration < date.today():
        statut = "expiree"
    elif erreurs:
        # QR ou visage manquant seul → partiel via « en_attente » (pas de rejet dur)
        statut = "en_attente"

    # Contenu QR déjà assaini dans extraire_donnees_cip (évite NUL / binaire → échec INSERT).
    qr_contenu_safe = donnees.qr_code_contenu

    nouvelle = CertificatIdentificationPersonnelle(
        utilisateur_id=utilisateur.id,
        type_document="cip",
        face="unique",
        nom_fichier=fichier.filename or "cip.jpg",
        type_mime=fichier.content_type,
        taille_octets=len(contenu),
        npi=donnees.npi,
        numero_document=donnees.npi,
        numero_serie=donnees.numero_serie,
        nom_famille=donnees.nom_famille,
        prenoms=donnees.prenoms,
        date_naissance=_parser_date(donnees.date_naissance),
        lieu_naissance=donnees.lieu_naissance,
        nationalite=donnees.nationalite,
        telephone=donnees.telephone,
        adresse=donnees.adresse,
        commune=donnees.commune,
        arrondissement=donnees.arrondissement,
        quartier=donnees.quartier,
        nom_pere=donnees.nom_pere,
        nom_mere=donnees.nom_mere,
        pays_emetteur=donnees.pays_emetteur or "Bénin",
        date_delivrance=_parser_date(donnees.date_delivrance),
        date_expiration=date_expiration,
        qr_code_detecte=qr_detecte,
        qr_code_contenu=qr_contenu_safe,
        texte_brut=texte_brut[:5000] if texte_brut else None,
        taux_confiance_ocr=confiance,
        statut=statut,
        est_valide=(statut == "approuve"),
        scores_validation={
            "npi": True,
            "qr_code": qr_detecte,
            "embedding_visage": embedding_present,
        },
    )
    try:
        session.add(nouvelle)
        await session.commit()
        await session.refresh(nouvelle)
    except Exception as e:
        await session.rollback()
        journal.error(f"CIP : échec enregistrement BDD | npi={donnees.npi} | {e}")
        raise ErreurValidation(
            f"Échec persistence CIP : {e}",
            message_utilisateur=(
                "Le CIP a été lu mais n'a pas pu être enregistré. "
                "Réessaie avec une photo plus nette, ou contacte le support."
            ),
        ) from e

    # Photo + embedding facial du titulaire
    from src.modules.verification_visuelle.photo_document import enregistrer_photo_document
    embedding_ok = await enregistrer_photo_document(
        session,
        nouvelle,
        contenu,
        "cip",
        type_mime=fichier.content_type,
        prefixe="cip",
    )
    donnees.embedding_visage_present = embedding_ok or embedding_present

    from src.modules.documents_identite.service import marquer_document_fourni
    await marquer_document_fourni(
        session,
        utilisateur,
        type_document="cip",
        numero_document=donnees.npi,
        nom_complet=" ".join(
            v for v in [donnees.prenoms, donnees.nom_famille] if v
        ) or None,
        date_naissance=_parser_date(donnees.date_naissance),
        lieu_naissance=donnees.lieu_naissance,
        nationalite=donnees.nationalite,
        date_delivrance=_parser_date(donnees.date_delivrance),
        date_expiration=date_expiration,
        pays_emetteur=donnees.pays_emetteur or "Bénin",
    )

    if date_expiration:
        from src.noyau.rappels_expiration import notifier_expiration_proche
        await notifier_expiration_proche(session, utilisateur, "cip", date_expiration)

    message = "CIP scanné et enregistré avec succès."
    if statut == "expiree":
        message = "CIP enregistré mais expiré."
    elif statut == "en_attente":
        message = "CIP enregistré avec réserves : " + "; ".join(erreurs)

    journal.info(
        f"CIP enregistré | user={utilisateur.id} | npi={donnees.npi} | "
        f"qr={qr_detecte} | visage={donnees.embedding_visage_present} | temps={temps_ms}ms"
    )

    return ReponseUploadCIP(
        id=nouvelle.id,
        statut=statut,
        resultat_ocr=ResultatOCRCIP(
            succes=True,
            donnees=donnees,
            erreurs=erreurs,
            champs_extraits=nb_champs,
            temps_analyse_ms=temps_ms,
        ),
        message=message,
    )


def _vers_detail(cip: CertificatIdentificationPersonnelle) -> VerificationCIPDetail:
    return VerificationCIPDetail(
        id=cip.id,
        utilisateur_id=cip.utilisateur_id,
        statut=cip.statut or ("approuve" if cip.est_valide else "expiree"),
        nom_fichier=cip.nom_fichier or f"cip_{cip.npi}.jpg",
        npi=cip.npi,
        numero_document=cip.npi,
        nom_famille=cip.nom_famille,
        prenoms=cip.prenoms,
        nationalite=cip.nationalite,
        date_delivrance=cip.date_delivrance.isoformat() if cip.date_delivrance else None,
        date_expiration=cip.date_expiration.isoformat() if cip.date_expiration else None,
        qr_code_detecte=cip.qr_code_detecte,
        taux_confiance_ocr=cip.taux_confiance_ocr,
        cree_le=cip.cree_le,
        est_supprime=bool(cip.est_supprime),
    )


async def obtenir_historique_cip(
    session: AsyncSession,
    utilisateur: Utilisateur,
    limite: int = 20,
) -> ListeVerificationsCIP:
    resultat = await session.execute(
        select(CertificatIdentificationPersonnelle)
        .where(CertificatIdentificationPersonnelle.utilisateur_id == utilisateur.id)
        .order_by(desc(CertificatIdentificationPersonnelle.cree_le))
        .limit(limite)
    )
    enregistrements = resultat.scalars().all()
    historique = [_vers_detail(c) for c in enregistrements]
    return ListeVerificationsCIP(historique=historique, total=len(historique))
