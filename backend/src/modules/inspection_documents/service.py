# -*- coding: utf-8 -*-
"""
Service d'orchestration pour le module d'inspection de documents.
Architecture stable : OCR Classique + Validation Règles + Flux de validation manuelle (EN_ATTENTE).
Suppression de la dépendance au VLM pour garantir la stabilité et la conformité bancaire.

Pipeline complet :
1. Validation du fichier uploadé (format, taille)
2. Évaluation de la qualité d'image
3. Extraction via OCR classique (Tesseract) avec fallback gracieux
4. Validation métier (si les données sont présentes)
5. Persistance en base de données (même en cas d'extraction partielle)
6. Statut EN_ATTENTE pour revue manuelle si nécessaire
"""
import base64
import time
import re
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Utilisateur
from src.modeles.inspection_document import InspectionDocument
from src.modules.inspection_documents.schemas import (
    DonneesDocumentExtraites,
    DetailVerification,
    FaceDocument,
    ListeVerifications,
    ResultatCoherence,
    ResultatValidation,
    ReponseSuppression,
    ReponseRestauration,
    ReponseUploadDocument,
    StatutVerification,
    SyntheseVerification,
    TypeDocument,
    SexeDocument,
)
from src.modules.inspection_documents.validation.validation_engine import valider_document
from src.modules.inspection_documents.validation.coherence_engine import verifier_coherence_identite
from src.modules.inspection_documents.storage.document_storage import stocker_document
from src.modules.inspection_documents.preprocessing.quality_checker import evaluer_qualite_image
from src.noyau import journal
from src.noyau.exceptions import ErreurRessourceIntrouvable, ErreurValidation


# =============================================================================
# CONSTANTES
# =============================================================================
TAILLE_MAX_IMAGE = 15 * 1024 * 1024  # 15 Mo
TYPES_MIME_AUTORISES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/tiff": "tiff",
}


# =============================================================================
# FONCTIONS UTILITAIRES INTERNES
# =============================================================================

async def _lire_image(fichier: UploadFile) -> bytes:
    """Lit et valide le fichier image uploadé."""
    if fichier.content_type not in TYPES_MIME_AUTORISES:
        raise ErreurValidation(
            f"Type MIME refusé : {fichier.content_type}",
            message_utilisateur="Format d'image non supporté. Utilise JPG, PNG, WEBP ou TIFF.",
        )
    
    contenu = await fichier.read()
    
    if not contenu:
        raise ErreurValidation("Fichier vide reçu.", message_utilisateur="Le fichier est vide.")
    
    if len(contenu) > TAILLE_MAX_IMAGE:
        raise ErreurValidation(
            f"Image trop volumineuse : {len(contenu)} octets",
            message_utilisateur=f"L'image dépasse la taille maximale de {TAILLE_MAX_IMAGE // 1024 // 1024} Mo.",
        )
    
    return contenu


async def _extraire_donnees_classique(
    image_bytes: bytes, 
    type_suggere: Optional[TypeDocument]
) -> DonneesDocumentExtraites:
    """
    Tente une extraction via OCR classique (Tesseract).
    Si l'OCR échoue ou ne trouve rien, retourne un objet minimal pour permettre 
    l'upload et la validation manuelle ultérieure (conformité bancaire).
    """
    texte_brut = ""
    confiance = 0.0
    numero_document = None
    nom_famille = None
    prenoms = None

    try:
        # Importation différée pour éviter le crash si pytesseract n'est pas installé
        from PIL import Image
        import pytesseract
        import io

        image = Image.open(io.BytesIO(image_bytes))
        # Extraction du texte (français + anglais pour les codes MRZ)
        texte_brut = pytesseract.image_to_string(image, lang='fra+eng')
        
        if texte_brut.strip():
            confiance = 60.0  # Confiance de base pour un OCR classique réussi
            
            # Exemples de règles simples (Regex) pour pré-remplir
            # À adapter selon les formats de CNI de votre pays cible
            # Exemple : recherche d'un motif de type numéro de série (à personnaliser)
            match_numero = re.search(r'\b[A-Z0-9]{6,15}\b', texte_brut)
            if match_numero:
                numero_document = match_numero.group(0)
                
    except Exception as e:
        journal.warning(f"Échec de l'OCR classique (Tesseract), passage en mode manuel : {e}")
        texte_brut = "OCR indisponible. Nécessite une saisie ou vérification manuelle."
        confiance = 0.0

    return DonneesDocumentExtraites(
        type_document=type_suggere or TypeDocument.INCONNU,
        nom_famille=nom_famille,
        prenoms=prenoms,
        numero_document=numero_document,
        texte_brut=texte_brut[:5000],
        taux_confiance_ocr=confiance,
        mrz_valide=False, # La validation MRZ stricte peut être faite plus tard si le texte brut la contient
    )


async def _enregistrer_document(
    session: AsyncSession,
    utilisateur: Utilisateur,
    donnees: DonneesDocumentExtraites,
    validation: ResultatValidation,
    face: str,
    nom_fichier: str,
    type_mime: str,
    taille_octets: int,
    document_chemin: Optional[str] = None,
) -> InspectionDocument:
    """Enregistre le document analysé en base de données."""
    doc = InspectionDocument(
        utilisateur_id=utilisateur.id,
        type_document=donnees.type_document.value,
        face=face,
        nom_fichier=nom_fichier,
        type_mime=type_mime,
        taille_octets=taille_octets,
        document_chemin=document_chemin,
        nom_famille=donnees.nom_famille,
        prenoms=donnees.prenoms,
        date_naissance=donnees.date_naissance,
        sexe=donnees.sexe.value if hasattr(donnees.sexe, 'value') else str(donnees.sexe),
        numero_document=donnees.numero_document,
        date_expiration=donnees.date_expiration,
        lieu_naissance=donnees.lieu_naissance,
        date_delivrance=donnees.date_delivrance,
        autorite_delivrance=getattr(donnees, 'autorite_delivrance', None),
        nationalite=donnees.pays_emetteur,
        taille=getattr(donnees, 'taille', None),
        mrz_ligne_1=donnees.mrz_ligne_1,
        mrz_ligne_2=donnees.mrz_ligne_2,
        mrz_ligne_3=donnees.mrz_ligne_3,
        mrz_valide=donnees.mrz_valide,
        donnees_specifiques=getattr(donnees, 'donnees_specifiques', {}),
        texte_brut=donnees.texte_brut[:5000] if donnees.texte_brut else None,
        statut=validation.statut.value,
        est_valide=validation.est_valide,
        scores_validation=validation.scores or {},
        taux_confiance_ocr=donnees.taux_confiance_ocr,
    )
    session.add(doc)
    await session.commit()
    await session.refresh(doc)
    return doc


# =============================================================================
# SERVICES PUBLICS
# =============================================================================

async def traiter_upload_document(
    session: AsyncSession,
    utilisateur: Utilisateur,
    fichier: UploadFile,
    type_document: Optional[TypeDocument] = None,
    face: str = "recto",
    utilisateur_cible_id: Optional[UUID] = None,
) -> ReponseUploadDocument:
    """
    Traite l'upload d'un document d'identité.
    Philosophie : Ne jamais rejeter brutalement un upload. Si l'extraction est mauvaise, 
    on enregistre quand même avec le statut EN_ATTENTE pour revue manuelle.
    """
    debut = time.time()
    
    # 1. Lire et valider l'image
    contenu = await _lire_image(fichier)
    nom_fichier = fichier.filename or f"document_{face}.jpg"
    extension = fichier.filename.split(".")[-1] if "." in fichier.filename else "jpg"
    
    # 2. Évaluer la qualité d'image
    qualite = evaluer_qualite_image(contenu)
    if not qualite.est_valide:
        raise ErreurValidation(
            f"Qualité d'image insuffisante : {qualite.message}",
            message_utilisateur="L'image est trop floue ou mal éclairée. Veuillez reprendre la photo."
        )
    journal.info(f"Qualité image : score={qualite.score_global:.1f}/100")
    
    # 3. Extraction des données (OCR Classique, sans VLM)
    donnees = await _extraire_donnees_classique(contenu, type_document)
    
    # 4. Validation métier dynamique
    # Si les données sont vides, valider_document retournera est_valide=False, 
    # mais nous NE levons PAS d'exception. Nous laissons le processus continuer.
    validation = valider_document(donnees)
    
    # 5. Ajustement du statut pour la conformité (Banque/Gouvernement)
    # Si l'OCR n'a pas pu tout extraire, on passe en EN_ATTENTE pour validation humaine.
    if not validation.est_valide:
        validation.statut = StatutVerification.EN_ATTENTE
        validation.message = "Document reçu. Extraction partielle, en attente de vérification manuelle."
        journal.info("Document marqué comme EN_ATTENTE pour revue manuelle.")

    # 6. Vérification de cohérence (seulement si on a assez de données)
    coherence = None
    if donnees.nom_famille or donnees.numero_document:
        coherence = await verifier_coherence_identite(
            session=session,
            utilisateur=utilisateur,
            nouvelles_donnees=donnees,
            utilisateur_cible_id=utilisateur_cible_id,
        )
        if not coherence.est_coherent:
            # Même en cas d'incohérence, on peut choisir d'enregistrer en EN_ATTENTE 
            # plutôt que de bloquer l'utilisateur, selon votre règle métier.
            validation.statut = StatutVerification.EN_ATTENTE
            validation.message = f"Incohérence détectée : {coherence.message}. En attente de revue."

    # 7. Stockage physique
    chemin_stockage = None
    try:
        chemin_stockage = stocker_document(contenu, extension=extension, prefixe=donnees.type_document.value)
        journal.info(f"Document stocké : {chemin_stockage}")
    except Exception as e:
        journal.warning(f"Échec stockage document : {e}")
    
    # 8. Persistance en base de données
    doc = await _enregistrer_document(
        session=session,
        utilisateur=utilisateur,
        donnees=donnees,
        validation=validation,
        face=face,
        nom_fichier=nom_fichier,
        type_mime=fichier.content_type or "image/jpeg",
        taille_octets=len(contenu),
        document_chemin=chemin_stockage,
    )
    
    # 9. Mise à jour du profil (seulement si la validation est complète et réussie)
    if validation.est_valide and validation.statut == StatutVerification.APPROUVE:
        utilisateur.est_cni_verifiee = True
        utilisateur.date_verification_cni = datetime.now(timezone.utc)
        utilisateur.date_derniere_mise_a_jour_verifications = datetime.now(timezone.utc)
        await session.commit()
        
        try:
            from src.modules.scoring.service import declencher_recalcul_score
            await declencher_recalcul_score(session=session, utilisateur=utilisateur, raison="upload_document_valide")
        except Exception as e:
            journal.warning(f"Échec recalcul score : {e}")
    
    temps_ms = int((time.time() - debut) * 1000)
    journal.info(f"Upload document terminé : utilisateur={utilisateur.id}, statut={validation.statut.value}, temps={temps_ms}ms")
    
    return ReponseUploadDocument(
        id_verification=doc.id,
        type_document=donnees.type_document,
        statut=validation.statut,
        donnees=donnees,
        validation=validation,
        coherence=coherence,
        message=validation.message,
        temps_traitement_ms=temps_ms,
    )


async def obtenir_synthese_verification(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> SyntheseVerification:
    """Obtient la synthèse des dernières vérifications de documents."""
    resultats = await session.execute(
        select(InspectionDocument)
        .where(InspectionDocument.utilisateur_id == utilisateur.id, InspectionDocument.est_supprime == False)
        .order_by(desc(InspectionDocument.cree_le))
        .limit(10)
    )
    verifs = resultats.scalars().all()
    
    dernier_recto = next((v for v in verifs if v.face == "recto"), None)
    dernier_verso = next((v for v in verifs if v.face == "verso"), None)
    dernier_unique = next((v for v in verifs if v.face == "unique"), None)
    
    doc_cible = dernier_unique or dernier_recto
    
    if not doc_cible:
        return SyntheseVerification(statut=StatutVerification.EN_ATTENTE, message="Aucun document trouvé.")
    
    scores = doc_cible.scores_validation or {}
    champs_verifies = sum(1 for v in scores.values() if v) if isinstance(scores, dict) else 0
    
    return SyntheseVerification(
        id_recto=dernier_recto.id if dernier_recto else None,
        id_verso=dernier_verso.id if dernier_verso else None,
        statut=StatutVerification(doc_cible.statut),
        message=f"Synthèse basée sur {doc_cible.type_document} (Statut: {doc_cible.statut})",
        champs_verifies=champs_verifies
    )


async def obtenir_historique(
    session: AsyncSession,
    utilisateur: Utilisateur,
    limite: int = 20,
) -> ListeVerifications:
    """Liste l'historique paginé des vérifications."""
    resultats = await session.execute(
        select(InspectionDocument)
        .where(InspectionDocument.utilisateur_id == utilisateur.id, InspectionDocument.est_supprime == False)
        .order_by(desc(InspectionDocument.cree_le))
        .limit(limite)
    )
    verifs = resultats.scalars().all()
    
    historique = [
        DetailVerification(
            id=v.id,
            utilisateur_id=v.utilisateur_id,
            type_document=TypeDocument(v.type_document),
            statut=StatutVerification(v.statut),
            face=FaceDocument(v.face),
            nom_fichier=v.nom_fichier,
            numero_document=v.numero_document,
            nom_famille=v.nom_famille,
            prenoms=v.prenoms,
            date_naissance=v.date_naissance,
            taux_confiance_ocr=v.taux_confiance_ocr,
            est_valide=v.est_valide,
            cree_le=v.cree_le,
            est_supprime=v.est_supprime
        ) for v in verifs
    ]
    return ListeVerifications(historique=historique, total=len(historique), limite=limite)


async def supprimer_verification(
    session: AsyncSession,
    utilisateur: Utilisateur,
    verification_id: UUID,
) -> ReponseSuppression:
    """Soft-delete d'une vérification."""
    res = await session.execute(
        select(InspectionDocument).where(
            InspectionDocument.id == verification_id,
            InspectionDocument.utilisateur_id == utilisateur.id,
        )
    )
    doc = res.scalar_one_or_none()
    if not doc:
        raise ErreurRessourceIntrouvable("Document introuvable.")
    
    doc.est_supprime = True
    doc.date_suppression = datetime.now(timezone.utc)
    await session.commit()
    return ReponseSuppression(id=verification_id, message="Document mis à la corbeille.")


async def restaurer_verification(
    session: AsyncSession,
    utilisateur: Utilisateur,
    verification_id: UUID,
) -> ReponseRestauration:
    """Restauration d'une vérification."""
    res = await session.execute(
        select(InspectionDocument).where(
            InspectionDocument.id == verification_id,
            InspectionDocument.utilisateur_id == utilisateur.id,
        )
    )
    doc = res.scalar_one_or_none()
    if not doc:
        raise ErreurRessourceIntrouvable("Document introuvable.")
    
    doc.est_supprime = False
    doc.date_suppression = None
    await session.commit()
    return ReponseRestauration(id=verification_id, message="Document restauré.")