# -*- coding: utf-8 -*-
"""
Service OCR Permis — orchestration du scan, validation d'identité et sauvegarde.
"""
import re
import unicodedata
from datetime import datetime, date
from uuid import UUID
from fastapi import UploadFile
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Utilisateur
from src.modeles.permis_conduire import PermisConduire
from src.modules.ocr_cni.ocr_engine import analyser_image_cni  # Moteur OCR partagé
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
# Fonctions utilitaires de vérification d'identité
# =============================================================================
def _normaliser_chaine(texte: str | None) -> str:
    """Normalise une chaîne : minuscules, sans accents, sans espaces multiples."""
    if not texte:
        return ""
    # Supprime les accents
    texte_norm = unicodedata.normalize('NFKD', texte).encode('ascii', 'ignore').decode('utf-8')
    # Minuscules et nettoyage des espaces
    return re.sub(r'\s+', ' ', texte_norm.lower().strip())

def verifier_correspondance_identite(
    nom_extrait: str | None, 
    prenoms_extraits: str | None, 
    utilisateur: Utilisateur
) -> tuple[bool, str]:
    """
    Compare les noms extraits par l'OCR avec le profil utilisateur.
    Retourne (True, "Message succès") ou (False, "Message d'erreur").
    """
    # Si le profil n'a pas de nom, on ne peut pas vérifier (ou on accepte par défaut)
    if not utilisateur.nom or not utilisateur.prenoms:
        return True, "Profil utilisateur incomplet, validation du nom ignorée."

    nom_extrait_norm = _normaliser_chaine(nom_extrait)
    prenoms_extraits_norm = _normaliser_chaine(prenoms_extraits)
    nom_profil_norm = _normaliser_chaine(utilisateur.nom)
    prenoms_profil_norm = _normaliser_chaine(utilisateur.prenoms)

    # 1. Vérification du NOM (doit être contenu l'un dans l'autre pour tolérer les particules)
    nom_correspond = (nom_extrait_norm in nom_profil_norm) or (nom_profil_norm in nom_extrait_norm)

    # 2. Vérification des PRÉNOMS (vérifie le chevauchement des mots)
    mots_extraits = set(prenoms_extraits_norm.split())
    mots_profil = set(prenoms_profil_norm.split())
    
    # On considère comme valide si au moins la moitié des prénoms du profil sont dans l'extrait, 
    # ou si c'est une correspondance exacte après normalisation.
    if not mots_profil:
        prenoms_correspondent = True
    else:
        intersection = len(mots_extraits.intersection(mots_profil))
        prenoms_correspondent = (intersection >= max(1, len(mots_profil) // 2)) or (prenoms_extraits_norm == prenoms_profil_norm)

    if nom_correspond and prenoms_correspondent:
        return True, "Identité vérifiée avec succès."
    else:
        msg_erreur = (
            f"Incohérence d'identité détectée. "
            f"Profil : {utilisateur.nom} {utilisateur.prenoms} | "
            f"Extrait OCR : {nom_extrait or 'N/A'} {prenoms_extraits or 'N/A'}. "
            f"Veuillez vérifier que le permis appartient bien au titulaire du compte."
        )
        return False, msg_erreur

# =============================================================================
# Fonctions internes
# =============================================================================
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

def _compter_champs_extraits(donnees: DonneesPermisExtraites) -> int:
    champs = [donnees.nom_famille, donnees.prenoms, donnees.numero_permis, donnees.categories]
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
    """Traite l'upload, vérifie l'identité et sauvegarde le permis."""
    
    # 1. Lecture du fichier
    contenu = await _lire_image(fichier)
    
    # 2. Analyse OCR réelle
    try:
        resultat_ocr = analyser_image_cni(contenu)
        texte_brut = resultat_ocr.get("texte_brut", "")
        confiance = resultat_ocr.get("confiance_moyenne", 0.0)
        mrz_lignes = resultat_ocr.get("mrz_lignes", (None, None, None))
    except Exception as e:
        journal.error(f"Erreur OCR permis: {e}")
        texte_brut = ""
        confiance = 0.0
        mrz_lignes = (None, None, None)
    
    # 3. Extraction des données
    donnees = extraire_donnees_permis(
        texte_brut=texte_brut,
        confiance=confiance,
        mrz_lignes=mrz_lignes,
    )
    
    nb_champs = _compter_champs_extraits(donnees)
    if nb_champs < 2 or not donnees.numero_permis:
        return ReponseUploadPermis(
            id=UUID("00000000-0000-0000-0000-000000000000"),
            statut="rejete",
            resultat_ocr=ResultatOCRPermis(succes=False, donnees=donnees, erreurs=["Extraction insuffisante"], champs_extraits=nb_champs),
            message="L'OCR n'a pas pu extraire suffisamment de données ou le numéro de permis est manquant.",
        )
    
    # 4. ✅ VÉRIFICATION D'IDENTITÉ (Comparaison avec le profil)
    est_conforme, message_validation = verifier_correspondance_identite(
        nom_extrait=donnees.nom_famille,
        prenoms_extraits=donnees.prenoms,
        utilisateur=utilisateur
    )
    
    if not est_conforme:
        journal.warning(f"Rejet permis user {utilisateur.id} : {message_validation}")
        # On rejette l'upload en levant une exception que le frontend affichera
        raise ErreurValidation("Incohérence d'identité", message_utilisateur=message_validation)
    
    # 5. Vérification d'unicité du numéro de permis
    resultat = await session.execute(
        select(PermisConduire).where(PermisConduire.numero_permis == donnees.numero_permis)
    )
    if resultat.scalar_one_or_none():
        raise ErreurValidation("Ce numéro de permis est déjà enregistré dans la base.")
    
    # 6. Sauvegarde en base de données
    nouveau_permis = PermisConduire(
        utilisateur_id=utilisateur.id,
        numero_permis=donnees.numero_permis,
        categories=donnees.categories or [],
        date_delivrance=donnees.date_delivrance,
        date_expiration=donnees.date_expiration,
        autorite_delivrance=donnees.autorite_delivrance,
        est_valide=True,
    )
    session.add(nouveau_permis)
    await session.commit()
    await session.refresh(nouveau_permis)
    
    journal.info(f"Permis enregistré et validé : {nouveau_permis.numero_permis} pour user {utilisateur.id}")
    
    # 7. Construction de la réponse
    return ReponseUploadPermis(
        id=nouveau_permis.id,
        statut="approuve",
        resultat_ocr=ResultatOCRPermis(succes=True, donnees=donnees, erreurs=[], champs_extraits=nb_champs),
        message=f"Permis enregistré avec succès. {message_validation}",
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
            nom_famille=None, # À mapper si tu stockes ces champs dans le modèle
            prenoms=None,
            numero_permis=permis.numero_permis,
            categories=permis.categories or [],
            date_delivrance=permis.date_delivrance.isoformat() if permis.date_delivrance else None,
            date_expiration=permis.date_expiration.isoformat() if permis.date_expiration else None,
            taux_confiance_ocr=None,
            cree_le=permis.cree_le,
            est_supprime=False,
        )
        for permis in enregistrements
    ]
    
    return ListeVerificationsPermis(historique=historique, total=len(historique))