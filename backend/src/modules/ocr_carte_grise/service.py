# -*- coding: utf-8 -*-
"""
Service OCR Carte Grise — orchestration du scan et de la sauvegarde.
"""
import re
import time
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Utilisateur
from src.modeles.carte_grise import CarteGrise
from src.modules.ocr_cni.ocr_engine import analyser_image_cni  # OCR partagé
from src.modules.ocr_carte_grise.extraction_carte_grise import extraire_donnees_carte_grise
from src.modules.ocr_carte_grise.schemas import (
    DonneesCarteGriseExtraites,
    ListeVerificationsCarteGrise,
    ReponseUploadCarteGrise,
    ResultatOCRCarteGrise,
    VerificationCarteGriseDetail,
)
from src.noyau import journal
from src.noyau.exceptions import ErreurValidation

TAILLE_MAX_IMAGE = 15 * 1024 * 1024  # 15 Mo
TYPES_MIME_AUTORISES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
ZERO_UUID = UUID("00000000-0000-0000-0000-000000000000")


async def _lire_image(fichier: UploadFile) -> bytes:
    """Lit et valide le fichier image uploadé."""
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
    """Convertit une chaîne de date brute (JJ.MM.AAAA…) en datetime.date."""
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


def _compter_champs_extraits(donnees: DonneesCarteGriseExtraites) -> int:
    """Compte le nombre de champs non-nuls extraits."""
    champs = [
        donnees.numero_immatriculation, donnees.numero_chassis, donnees.marque,
        donnees.modele, donnees.date_premiere_mise_circulation,
        donnees.puissance_fiscale_cv, donnees.energie,
    ]
    return sum(1 for c in champs if c is not None)


async def traiter_upload_carte_grise(
    session: AsyncSession,
    utilisateur: Utilisateur,
    fichier: UploadFile,
) -> ReponseUploadCarteGrise:
    """Traite l'upload d'une carte grise : OCR, extraction, sauvegarde."""
    debut = time.time()
    contenu = await _lire_image(fichier)

    try:
        res = analyser_image_cni(contenu)
        texte_brut = res.get("texte_brut", "")
        confiance = res.get("confiance_moyenne", 0.0)
    except Exception as e:  # pragma: no cover - dépend de Tesseract
        journal.error(f"Erreur OCR carte grise: {e}")
        texte_brut, confiance = "", 0.0

    donnees = extraire_donnees_carte_grise(texte_brut=texte_brut, confiance=confiance)
    nb_champs = _compter_champs_extraits(donnees)
    succes_ocr = bool(donnees.numero_immatriculation)
    temps_ms = int((time.time() - debut) * 1000)
    erreurs = [] if succes_ocr else ["Immatriculation non extraite (champ critique)."]

    # Rejet si aucune immatriculation (colonne NOT NULL en base).
    if not succes_ocr:
        journal.warning(
            f"REJET CARTE GRISE | immat non extraite | utilisateur={utilisateur.id}"
        )
        return ReponseUploadCarteGrise(
            id=ZERO_UUID,
            statut="rejete",
            resultat_ocr=ResultatOCRCarteGrise(
                succes=False, donnees=donnees, erreurs=erreurs,
                champs_extraits=nb_champs, temps_analyse_ms=temps_ms,
            ),
            message="L'OCR n'a pas pu extraire le numéro d'immatriculation. "
                    "Reprends une photo nette et bien éclairée.",
        )

    date_expiration = _parser_date(donnees.date_expiration, est_expiration=True)
    statut = "approuve"
    # Une carte grise n'a pas toujours de date d'expiration ; si présente et
    # dépassée, on la marque comme expirée sans bloquer la sauvegarde.
    if date_expiration and date_expiration < date.today():
        statut = "expiree"

    nouvelle = CarteGrise(
        utilisateur_id=utilisateur.id,
        numero_immatriculation=donnees.numero_immatriculation,
        numero_chassis=donnees.numero_chassis,
        numero_moteur=donnees.numero_moteur,
        marque=donnees.marque,
        modele=donnees.modele,
        genre=donnees.genre,
        carrosserie=donnees.carrosserie,
        energie=donnees.energie,
        puissance_fiscale_cv=donnees.puissance_fiscale_cv,
        nombre_places=donnees.nombre_places,
        poids_total_kg=donnees.poids_total_kg,
        date_premiere_mise_circulation=_parser_date(donnees.date_premiere_mise_circulation),
        annee_vehicule=donnees.annee_vehicule,
        numero_formule=donnees.numero_formule,
        titulaire_nom=donnees.titulaire_nom,
        titulaire_prenoms=donnees.titulaire_prenoms,
        titulaire_adresse=donnees.titulaire_adresse,
        pays_emetteur=donnees.pays_emetteur,
        date_delivrance=_parser_date(donnees.date_delivrance),
        date_expiration=date_expiration,
        est_valide=(statut == "approuve"),
    )
    session.add(nouvelle)
    await session.commit()
    await session.refresh(nouvelle)

    if date_expiration:
        from src.noyau.rappels_expiration import notifier_expiration_proche
        await notifier_expiration_proche(session, utilisateur, "carte_grise", date_expiration)

    journal.info(
        f"Carte grise enregistrée | user={utilisateur.id} | "
        f"immat={donnees.numero_immatriculation} | temps={temps_ms}ms"
    )

    return ReponseUploadCarteGrise(
        id=nouvelle.id,
        statut=statut,
        resultat_ocr=ResultatOCRCarteGrise(
            succes=True, donnees=donnees, erreurs=[],
            champs_extraits=nb_champs, temps_analyse_ms=temps_ms,
        ),
        message="Carte grise scannée et enregistrée avec succès.",
    )


def _vers_detail(carte: CarteGrise) -> VerificationCarteGriseDetail:
    """Convertit un enregistrement CarteGrise en schéma de détail."""
    return VerificationCarteGriseDetail(
        id=carte.id,
        utilisateur_id=carte.utilisateur_id,
        statut="approuve" if carte.est_valide else "expiree",
        nom_fichier=f"carte_grise_{carte.numero_immatriculation}.jpg",
        numero_immatriculation=carte.numero_immatriculation,
        numero_chassis=carte.numero_chassis,
        marque=carte.marque,
        modele=carte.modele,
        energie=carte.energie,
        puissance_fiscale_cv=carte.puissance_fiscale_cv,
        date_premiere_mise_circulation=(
            carte.date_premiere_mise_circulation.isoformat()
            if carte.date_premiere_mise_circulation else None
        ),
        titulaire_nom=carte.titulaire_nom,
        titulaire_prenoms=carte.titulaire_prenoms,
        date_expiration=carte.date_expiration.isoformat() if carte.date_expiration else None,
        taux_confiance_ocr=None,
        cree_le=carte.cree_le,
        est_supprime=False,
    )


async def obtenir_historique_carte_grise(
    session: AsyncSession,
    utilisateur: Utilisateur,
    limite: int = 20,
) -> ListeVerificationsCarteGrise:
    """Liste l'historique des cartes grises scannées."""
    resultat = await session.execute(
        select(CarteGrise)
        .where(CarteGrise.utilisateur_id == utilisateur.id)
        .order_by(desc(CarteGrise.cree_le))
        .limit(limite)
    )
    enregistrements = resultat.scalars().all()
    historique = [_vers_detail(c) for c in enregistrements]
    return ListeVerificationsCarteGrise(historique=historique, total=len(historique))
