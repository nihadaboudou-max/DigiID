# -*- coding: utf-8 -*-
"""
Service OCR Permis — orchestration du scan et de la validation
des Permis de Conduire.
"""
import re
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
# Fonctions utilitaires
# =============================================================================
def parser_date(chaine_date: str | None, est_expiration: bool = False) -> date | None:
    """
    Convertit une chaîne de date brute (ex: '15.03.2021' ou '15.03.2021 14.03.2031') 
    en objet datetime.date valide pour la base de données.
    """
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
    """Traite l'upload d'une image de permis de conduire."""
    contenu = await _lire_image(fichier)  # ✅ Correction du nom de fonction
    
    # 1. Analyse OCR RÉELLE
    try:
        resultat_ocr = analyser_image_cni(contenu)  # ✅ Appel synchrone au moteur
        texte_brut = resultat_ocr.get("texte_brut", "")
        confiance = resultat_ocr.get("confiance_moyenne", 0.0)
        mrz_lignes = resultat_ocr.get("mrz_lignes", (None, None, None))
    except Exception as e:
        journal.error(f"Erreur OCR permis: {e}")
        texte_brut = ""
        confiance = 0.0
        mrz_lignes = (None, None, None)
    
    # 2. Extraction des données spécifiques au permis
    donnees = extraire_donnees_permis(
        texte_brut=texte_brut,
        confiance=confiance,
        mrz_lignes=mrz_lignes,
    )
    
    nb_champs = _compter_champs_extraits(donnees)
    succes = nb_champs >= 3  # Au moins 3 champs pour considérer comme succès
    
    if not succes or not donnees.numero_permis:
        return ReponseUploadPermis(
            id=UUID("00000000-0000-0000-0000-000000000000"),
            statut="rejete",
            resultat_ocr=ResultatOCRPermis(
                succes=False,
                donnees=donnees,
                erreurs=["Extraction insuffisante"] if not succes else [],
                champs_extraits=nb_champs,
            ),
            message="L'OCR n'a pas pu extraire suffisamment de données." if not succes else "Numéro de permis introuvable.",
        )
    
    # 3. Vérification d'unicité
    resultat = await session.execute(
        select(PermisConduire).where(PermisConduire.numero_permis == donnees.numero_permis)
    )
    if resultat.scalar_one_or_none():
        raise ErreurValidation("Ce numéro de permis existe déjà dans la base.")
    
    # 4. Sauvegarde en base avec PARSING DES DATES ✅
    nouveau_permis = PermisConduire(
        utilisateur_id=utilisateur.id,
        numero_permis=donnees.numero_permis,
        categories=donnees.categories or [],
        date_premiere_delivrance=parser_date(donnees.date_premiere_delivrance),
        date_delivrance=parser_date(donnees.date_delivrance),
        date_expiration=parser_date(donnees.date_expiration, est_expiration=True), # ✅ Prend la dernière date si l'OCR en a capturé deux
        autorite_delivrance=donnees.autorite_delivrance,
        est_valide=True,
    )
    session.add(nouveau_permis)
    await session.commit()
    await session.refresh(nouveau_permis)
    
    journal.info(f"Permis enregistré : {nouveau_permis.numero_permis} pour user {utilisateur.id}")
    
    # 5. Construction de la réponse
    resultat_ocr_final = ResultatOCRPermis(
        succes=True,
        donnees=donnees,
        erreurs=[],
        champs_extraits=nb_champs,
    )
    
    return ReponseUploadPermis(
        id=nouveau_permis.id,
        statut="approuve",
        resultat_ocr=resultat_ocr_final,
        message="Permis enregistré avec succès.",
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
            nom_famille=None,
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