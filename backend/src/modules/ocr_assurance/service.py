# -*- coding: utf-8 -*-
"""
Service OCR Assurance — orchestration du scan, validation d'identité et sauvegarde.
Rejette automatiquement si le nom de l'assuré ne correspond pas au profil utilisateur.
"""
import re
import unicodedata
from datetime import datetime, date
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Utilisateur
from src.modeles.assurance_auto import AssuranceAuto
from src.modules.ocr_cni.ocr_engine import analyser_image_cni  # ✅ MOTEUR OCR RÉEL
from src.modules.ocr_assurance.extraction_assurance import extraire_donnees_assurance
from src.modules.ocr_assurance.schemas import (
    DonneesAssuranceExtraites,
    ListeVerificationsAssurance,
    ReponseUploadAssurance,
    ResultatOCRAssurance,
    VerificationAssuranceDetail,
)
from src.noyau import journal
from src.noyau.exceptions import ErreurValidation

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
# ✅ FONCTIONS DE VÉRIFICATION D'IDENTITÉ & UTILITAIRES
# =============================================================================
def _normaliser_texte(texte: str | None) -> str:
    """Normalise un texte : supprime accents, met en minuscules, nettoie les espaces."""
    if not texte:
        return ""
    texte = unicodedata.normalize('NFKD', texte).encode('ascii', 'ignore').decode('utf-8')
    return re.sub(r'\s+', ' ', texte.lower().strip())

def verifier_identite_assurance(
    nom_assure_extrait: str | None,
    prenoms_assure_extrait: str | None,
    utilisateur: Utilisateur
) -> tuple[bool, str]:
    """
    Vérifie si le nom/prénoms de l'assuré correspondent au profil utilisateur.
    """
    if not utilisateur.nom or not utilisateur.prenoms:
        return True, "Profil incomplet - validation ignorée"
    
    if not nom_assure_extrait and not prenoms_assure_extrait:
        return False, "Le nom de l'assuré n'a pas pu être extrait du document. Veuillez réessayer avec une image plus claire."
    
    nom_extrait_norm = _normaliser_texte(nom_assure_extrait)
    prenoms_extraits_norm = _normaliser_texte(prenoms_assure_extrait)
    nom_profil_norm = _normaliser_texte(utilisateur.nom)
    prenoms_profil_norm = _normaliser_texte(utilisateur.prenoms)
    
    journal.info(f"Comparaison assurance - Profil: {nom_profil_norm} {prenoms_profil_norm} | Extrait: {nom_extrait_norm} {prenoms_extraits_norm}")
    
    # Vérification NOM (doit être contenu l'un dans l'autre)
    nom_correspond = (nom_extrait_norm in nom_profil_norm) or (nom_profil_norm in nom_extrait_norm)
    
    # Vérification PRÉNOMS (au moins 50% des mots doivent correspondre)
    mots_extraits = set(prenoms_extraits_norm.split())
    mots_profil = set(prenoms_profil_norm.split())
    
    if not mots_profil:
        prenoms_correspondent = True
    else:
        intersection = len(mots_extraits.intersection(mots_profil))
        prenoms_correspondent = (intersection >= max(1, len(mots_profil) // 2))
    
    if nom_correspond and prenoms_correspondent:
        return True, "Identité de l'assuré vérifiée"
    else:
        message = (
            f"⚠️ IDENTITÉ NON CONFORME : Le nom de l'assuré sur le document ({nom_assure_extrait or 'N/A'} {prenoms_assure_extrait or 'N/A'}) "
            f"ne correspond pas à votre profil ({utilisateur.nom} {utilisateur.prenoms}). "
            f"Le document d'assurance doit être à votre nom."
        )
        return False, message

def _parser_date(chaine_date: str | None, est_expiration: bool = False) -> date | None:
    """Convertit une chaîne de date brute en objet datetime.date pour la BDD."""
    if not chaine_date:
        return None
    dates_trouvees = re.findall(r'\d{1,2}[./-]\d{1,2}[./-]\d{2,4}', chaine_date)
    if not dates_trouvees:
        return None
    date_cible = dates_trouvees[-1] if est_expiration else dates_trouvees[0]
    for fmt in ["%d.%m.%Y", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%y", "%d/%m/%y", "%d-%m-%y"]:
        try:
            return datetime.strptime(date_cible, fmt).date()
        except ValueError:
            continue
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

def _compter_champs_extraits(donnees: DonneesAssuranceExtraites) -> int:
    """Compte le nombre de champs non-nuls extraits."""
    champs = [
        donnees.compagnie_assurance,
        donnees.numero_contrat,
        donnees.immatriculation_vehicule,
        donnees.date_expiration,
    ]
    return sum(1 for c in champs if c is not None)

# =============================================================================
# ✅ SERVICE PRINCIPAL
# =============================================================================
async def traiter_upload_assurance(
    session: AsyncSession,
    utilisateur: Utilisateur,
    fichier: UploadFile,
) -> ReponseUploadAssurance:
    """
    Traite l'upload, vérifie l'identité de l'assuré et sauvegarde l'assurance.
    REJETTE si le nom de l'assuré ≠ profil utilisateur.
    """
    # 1. Lecture du fichier
    contenu = await _lire_image(fichier)
    
    # 2. ✅ ANALYSE OCR RÉELLE
    try:
        resultat_ocr_engine = analyser_image_cni(contenu)
        # ✅ CORRECTION : La clé est "texte_brut", pas "texte"
        texte_brut = resultat_ocr_engine.get("texte_brut", "")
        confiance = resultat_ocr_engine.get("confiance_moyenne", 0.0)
    except Exception as e:
        journal.error(f"Erreur OCR assurance: {e}")
        texte_brut = ""
        confiance = 0.0
    
    # 3. Extraction des données
    donnees = extraire_donnees_assurance(
        texte_brut=texte_brut,
        confiance=confiance,
    )
    
    nb_champs = _compter_champs_extraits(donnees)
    
    # 4. ✅ VÉRIFICATION D'IDENTITÉ (C'EST ICI QUE ÇA BLOQUE SI NOM ≠ PROFIL)
    # On récupère nom_assure et prenoms_assure s'ils existent dans le schéma d'extraction
    nom_assure = getattr(donnees, 'nom_assure', None)
    prenoms_assure = getattr(donnees, 'prenoms_assure', None)
    
    identite_valide, message_identite = verifier_identite_assurance(
        nom_assure_extrait=nom_assure,
        prenoms_assure_extrait=prenoms_assure,
        utilisateur=utilisateur
    )
    
    if not identite_valide:
        journal.warning(f"REJET ASSURANCE user {utilisateur.id}: {message_identite}")
        # ✅ LÈVE UNE ERREUR QUE LE FRONTEND AFFICHERA DANS L'ALERTE ROUGE
        raise ErreurValidation(
            "Identité non conforme",
            message_utilisateur=message_identite
        )
    
    # 5. Validation stricte des champs obligatoires
    if nb_champs < 2 or not donnees.immatriculation_vehicule or not donnees.numero_contrat:
        return ReponseUploadAssurance(
            id=UUID("00000000-0000-0000-0000-000000000000"),
            statut="rejete",
            resultat_ocr=ResultatOCRAssurance(
                succes=False,
                donnees=donnees,
                erreurs=["Extraction insuffisante des champs critiques (immatriculation, contrat)"],
                champs_extraits=nb_champs,
            ),
            message="L'OCR n'a pas pu extraire l'immatriculation ou le numéro de contrat.",
        )
    
    # 6. ✅ SAUVEGARDE EN BASE DE DONNÉES (avec parsing des dates)
    nouvelle_assurance = AssuranceAuto(
        utilisateur_id=utilisateur.id,
        compagnie_assurance=donnees.compagnie_assurance or "Inconnue",
        numero_contrat=donnees.numero_contrat,
        immatriculation=donnees.immatriculation_vehicule.upper(),
        marque_vehicule=donnees.marque_vehicule,
        modele_vehicule=donnees.modele_vehicule,
        date_effet=_parser_date(donnees.date_effet),
        date_expiration=_parser_date(donnees.date_expiration, est_expiration=True),
        est_active=True,
    )
    
    session.add(nouvelle_assurance)
    await session.commit()
    await session.refresh(nouvelle_assurance)
    
    journal.info(f"✅ Assurance ENREGISTRÉE : {nouvelle_assurance.numero_contrat} pour user {utilisateur.id}")
    
    # 7. Construction de la réponse
    resultat_ocr = ResultatOCRAssurance(
        succes=True,
        donnees=donnees,
        erreurs=[],
        champs_extraits=nb_champs,
    )
    
    return ReponseUploadAssurance(
        id=str(nouvelle_assurance.id),  # ✅ Converti en string pour le frontend TS
        statut="approuve",
        resultat_ocr=resultat_ocr,
        message=f"Assurance enregistrée avec succès. {message_identite}",
    )

async def obtenir_historique_assurance(
    session: AsyncSession,
    utilisateur: Utilisateur,
    limite: int = 20,
) -> ListeVerificationsAssurance:
    """Liste l'historique des vérifications d'assurance."""
    resultat = await session.execute(
        select(AssuranceAuto)
        .where(AssuranceAuto.utilisateur_id == utilisateur.id)
        .order_by(desc(AssuranceAuto.cree_le))
        .limit(limite)
    )
    enregistrements = resultat.scalars().all()
    
    historique = [
        VerificationAssuranceDetail(
            id=str(assurance.id),
            utilisateur_id=str(assurance.utilisateur_id),
            statut="approuve" if assurance.est_active else "expiree",
            nom_fichier=f"assurance_{assurance.immatriculation}.jpg",
            compagnie_assurance=assurance.compagnie_assurance,
            numero_contrat=assurance.numero_contrat,
            immatriculation_vehicule=assurance.immatriculation,
            marque_vehicule=assurance.marque_vehicule,
            date_expiration=assurance.date_expiration.isoformat() if assurance.date_expiration else None,
            taux_confiance_ocr=None,
            cree_le=assurance.cree_le.isoformat(),
            est_supprime=False,
        )
        for assurance in enregistrements
    ]
    
    return ListeVerificationsAssurance(historique=historique, total=len(historique))