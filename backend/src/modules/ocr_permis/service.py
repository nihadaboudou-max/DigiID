# -*- coding: utf-8 -*-
"""
Service OCR Permis — orchestration du scan, validation stricte d'identité et sauvegarde.
"""
import re
import time
from datetime import datetime, date
from uuid import UUID
from fastapi import UploadFile
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Utilisateur
from src.modeles.permis_conduire import PermisConduire
from src.modules.ocr_cni.ocr_engine import analyser_image_cni  # ✅ Moteur OCR partagé
from src.modules.ocr_permis.extraction_permis import extraire_donnees_permis
from src.modules.ocr_permis.schemas import (
    DonneesPermisExtraites,
    ListeVerificationsPermis,
    ReponseUploadPermis,
    ResultatOCRPermis,
    VerificationPermisDetail,
)
from src.noyau import journal
from src.noyau.exceptions import ErreurValidation

from src.noyau.chiffrement import dechiffrer_donnee

# =============================================================================
# Constantes
# =============================================================================
TAILLE_MAX_IMAGE = 15 * 1024 * 1024  # 15 Mo
TYPES_MIME_AUTORISES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

# =============================================================================
# ✅ FONCTION DE PARSING DES DATES (Résout l'erreur 'toordinal')
# =============================================================================
def _parser_date(chaine_date: str | None, est_expiration: bool = False) -> date | None:
    """Convertit une chaîne de date brute en objet datetime.date valide pour la base de données."""
    if not chaine_date:
        return None
    
    # Extraire tous les motifs de date (JJ.MM.AAAA, JJ/MM/AAAA, JJ-MM-AAAA)
    dates_trouvees = re.findall(r'\d{1,2}[./-]\d{1,2}[./-]\d{2,4}', chaine_date)
    if not dates_trouvees:
        return None
    
    # Si c'est une date d'expiration et que l'OCR en a capturé deux, on prend la dernière (la plus lointaine)
    # Sinon, on prend la première (pour la date de délivrance)
    date_cible = dates_trouvees[-1] if est_expiration else dates_trouvees[0]
    
    # Formats de date courants dans les documents officiels
    formats = ["%d.%m.%Y", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%y", "%d/%m/%y", "%d-%m-%y"]
    
    for fmt in formats:
        try:
            return datetime.strptime(date_cible, fmt).date()
        except ValueError:
            continue
            
    journal.warning(f"Impossible de parser la date : {chaine_date}")
    return None

# =============================================================================
# Fonctions internes
# =============================================================================
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

def _compter_champs_extraits(donnees: DonneesPermisExtraites) -> int:
    """Compte le nombre de champs non-nuls extraits."""
    champs = [
        donnees.nom_famille, donnees.prenoms, donnees.numero_permis,
        donnees.date_naissance, donnees.categories,
    ]
    return sum(1 for c in champs if c is not None and c != [])

# =============================================================================
# Service principal
# =============================================================================
async def traiter_upload_permis(
    session: AsyncSession,
    utilisateur: Utilisateur,
    fichier: UploadFile,
    face: str = "recto",
) -> ReponseUploadPermis:
    """
    Traite l'upload d'une image de permis de conduire avec vérification stricte d'identité.
    """
    debut = time.time()
    
    # 1. Lecture du fichier (✅ avec le underscore corrigé)
    contenu = await _lire_image(fichier)
    nom_fichier = fichier.filename or f"permis_{face}.jpg"
    
    # 2. Analyse OCR RÉELLE avec le moteur partagé
    try:
        resultat_ocr_engine = analyser_image_cni(contenu)
        texte_brut = resultat_ocr_engine.get("texte_brut", "")
        confiance = resultat_ocr_engine.get("confiance_moyenne", 0.0)
        mrz_lignes = resultat_ocr_engine.get("mrz_lignes", (None, None, None))
    except Exception as e:
        journal.error(f"Erreur OCR permis: {e}")
        texte_brut, confiance, mrz_lignes = "", 0.0, (None, None, None)
    
    # 3. Extraction des données
    donnees = extraire_donnees_permis(
        texte_brut=texte_brut,
        confiance=confiance,
        mrz_lignes=mrz_lignes,
    )
    
    nb_champs = _compter_champs_extraits(donnees)
    succes_ocr = nb_champs >= 3
    erreurs = [] if succes_ocr else ["Extraction insuffisante"]
    temps_ms = int((time.time() - debut) * 1000)

    # 4. ✅ VÉRIFICATION STRICTE DE COHÉRENCE (Inspirée de la CNI)
    if succes_ocr and donnees.nom_famille:
        # Déchiffrement des données du profil
        nom_profil = dechiffrer_donnee(utilisateur.nom_chiffre) if utilisateur.nom_chiffre else ""
        prenom_profil = dechiffrer_donnee(utilisateur.prenom_chiffre) if utilisateur.prenom_chiffre else ""

        # Normalisation : majuscules, et extraction du PREMIER prénom
        nom_permis_pur = donnees.nom_famille.strip().upper()
        prenom_permis_pur = donnees.prenoms.strip().split()[0].upper() if donnees.prenoms else ""
        nom_profil_pur = nom_profil.strip().upper()
        prenom_profil_pur = prenom_profil.strip().split()[0].upper() if prenom_profil else ""

        incoherences = []

        # Comparaison stricte du nom
        if nom_profil_pur and nom_permis_pur and nom_profil_pur != nom_permis_pur:
            incoherences.append(
                f"Le nom sur le permis ({nom_permis_pur}) ne correspond pas à votre profil ({nom_profil_pur})."
            )

        # Comparaison stricte du premier prénom
        if prenom_profil_pur and prenom_permis_pur and prenom_profil_pur != prenom_permis_pur:
            incoherences.append(
                f"Le prénom sur le permis ({prenom_permis_pur}) ne correspond pas à votre profil ({prenom_profil_pur})."
            )

        # 🚨 BLOCAGE : Si incohérence détectée, on rejette l'upload immédiatement
        if incoherences:
            message_erreur = "Incohérence d'identité détectée : " + " ".join(incoherences) + " Veuillez corriger votre nom/prénom dans vos paramètres avant de scanner votre permis."
            journal.warning(
                f"REJET PERMIS | Incohérence identité | utilisateur={utilisateur.id} | "
                f"Permis(nom={nom_permis_pur}, prenom={prenom_permis_pur}) vs Profil(nom={nom_profil_pur}, prenom={prenom_profil_pur})"
            )
            raise ErreurValidation(
                message_erreur,
                message_utilisateur=message_erreur
            )

    # 5. Vérification d'unicité du numéro de permis
    if succes_ocr and donnees.numero_permis:
        resultat = await session.execute(
            select(PermisConduire).where(PermisConduire.numero_permis == donnees.numero_permis)
        )
        if resultat.scalar_one_or_none():
            raise ErreurValidation(
                "Permis déjà enregistré",
                message_utilisateur="Ce numéro de permis existe déjà dans la base de données."
            )

    # 6. ✅ SAUVEGARDE EN BASE DE DONNÉES (avec PARSING DES DATES pour éviter l'erreur 'toordinal')
    nouveau_permis = PermisConduire(
        utilisateur_id=utilisateur.id,
        nom_famille=donnees.nom_famille,
        prenoms=donnees.prenoms,
        date_naissance=_parser_date(donnees.date_naissance),
        lieu_naissance=donnees.lieu_naissance,
        numero_permis=donnees.numero_permis,
        categories=donnees.categories or [],
        date_premiere_delivrance=_parser_date(donnees.date_premiere_delivrance),
        date_delivrance=_parser_date(donnees.date_delivrance),          # ✅ Converti en datetime.date
        date_expiration=_parser_date(donnees.date_expiration, est_expiration=True), # ✅ Converti en datetime.date
        autorite_delivrance=donnees.autorite_delivrance,
        est_valide=succes_ocr,
    )
    session.add(nouveau_permis)
    await session.commit()
    await session.refresh(nouveau_permis)

    journal.info(
        f"Permis scanné et enregistré | user={utilisateur.id} | "
        f"succes={succes_ocr} | numero={donnees.numero_permis or 'N/A'} | temps={temps_ms}ms"
    )

    # 7. Construction de la réponse
    resultat_ocr = ResultatOCRPermis(
        succes=succes_ocr,
        donnees=donnees,
        erreurs=erreurs,
        champs_extraits=nb_champs,
        temps_analyse_ms=temps_ms,
    )

    return ReponseUploadPermis(
        id=nouveau_permis.id,
        statut="approuve" if succes_ocr else "rejete",
        resultat_ocr=resultat_ocr,
        message="Permis scanné et enregistré avec succès." if succes_ocr else "L'OCR n'a pas pu extraire suffisamment de données.",
    )


async def obtenir_historique_permis(
    session: AsyncSession,
    utilisateur: Utilisateur,
    limite: int = 20,
) -> ListeVerificationsPermis:
    """Liste l'historique des vérifications de permis."""
    resultat = await session.execute(
        select(PermisConduire)
        .where(PermisConduire.utilisateur_id == utilisateur.id)
        .order_by(desc(PermisConduire.cree_le))
        .limit(limite)
    )
    enregistrements = resultat.scalars().all()
    
    historique = [
                VerificationPermisDetail(
            id=permis.id,
            utilisateur_id=permis.utilisateur_id,
            statut="approuve" if permis.est_valide else "rejete",
            face="recto",
            nom_fichier=f"permis_{permis.numero_permis}.jpg",
            nom_famille=permis.nom_famille,
            prenoms=permis.prenoms,
            date_naissance=permis.date_naissance.isoformat() if permis.date_naissance else None,
            lieu_naissance=permis.lieu_naissance,
            numero_permis=permis.numero_permis,
            categories=permis.categories or [],
            date_delivrance=permis.date_delivrance.isoformat() if permis.date_delivrance else None,
            date_expiration=permis.date_expiration.isoformat() if permis.date_expiration else None,
            date_premiere_delivrance=permis.date_premiere_delivrance.isoformat() if permis.date_premiere_delivrance else None,
            lieu_delivrance=permis.lieu_delivrance,
            autorite_delivrance=permis.autorite_delivrance,
            taux_confiance_ocr=None,
            cree_le=permis.cree_le,
            est_supprime=False,
        )
        for permis in enregistrements
    ]
    
    return ListeVerificationsPermis(historique=historique, total=len(historique))