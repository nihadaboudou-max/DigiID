# -*- coding: utf-8 -*-
"""
Service d'orchestration pour le module d'inspection de documents.
Gère l'upload, l'analyse, la validation et la persistance.
Pipeline complet : Qualité → Prétraitement → Extraction → Validation → Cohérence → Stockage
"""
import time
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID
from fastapi import UploadFile
from sqlalchemy import desc, select, update
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
)
from src.modules.inspection_documents.extraction import extraire_donnees_universelles
from src.modules.inspection_documents.validation import (
    valider_document,
    verifier_coherence_identite,
)
from src.modules.inspection_documents.preprocessing import (
    evaluer_qualite_image,
    pretraiter_image,
)
from src.modules.inspection_documents.storage import (
    stocker_document,
    generer_embedding_facial,
)
from src.noyau import journal, dechiffrer_donnee
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
SEUIL_QUALITE_MINIMUM = 40.0  # En dessous, on rejette l'image


# =============================================================================
# FONCTIONS UTILITAIRES
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
        raise ErreurValidation(
            "Fichier vide reçu.",
            message_utilisateur="Le fichier est vide. Merci de sélectionner une image valide.",
        )
    
    if len(contenu) > TAILLE_MAX_IMAGE:
        raise ErreurValidation(
            f"Image trop volumineuse : {len(contenu)} octets (max {TAILLE_MAX_IMAGE})",
            message_utilisateur=f"L'image dépasse la taille maximale de {TAILLE_MAX_IMAGE // 1024 // 1024} Mo.",
        )
    
    return contenu


def _extraire_premier_prenom(prenoms_complets: str) -> str:
    """Extrait le premier prénom d'une chaîne."""
    if not prenoms_complets:
        return ""
    return prenoms_complets.strip().split()[0]


def _compter_champs_extraits(donnees: DonneesDocumentExtraites) -> int:
    """Compte le nombre de champs non-nuls extraits."""
    champs_pertinents = [
        donnees.nom_famille,
        donnees.prenoms,
        donnees.sexe,
        donnees.date_naissance,
        donnees.lieu_naissance,
        donnees.numero_document,
        donnees.date_delivrance,
        donnees.date_expiration,
        donnees.autorite_delivrance,
        donnees.taille,
    ]
    return sum(
        1 for c in champs_pertinents 
        if c is not None and c != "non_detecte" and c != ""
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
        sexe=donnees.sexe.value if hasattr(donnees.sexe, 'value') else donnees.sexe,
        numero_document=donnees.numero_document,
        date_expiration=donnees.date_expiration,
        lieu_naissance=donnees.lieu_naissance,
        date_delivrance=donnees.date_delivrance,
        autorite_delivrance=donnees.autorite_delivrance,
        nationalite=donnees.pays_emetteur,
        taille=donnees.taille,
        mrz_ligne_1=donnees.mrz_ligne_1,
        mrz_ligne_2=donnees.mrz_ligne_2,
        mrz_ligne_3=donnees.mrz_ligne_3,
        mrz_valide=donnees.mrz_valide,
        donnees_specifiques=donnees.donnees_specifiques,
        texte_brut=donnees.texte_brut[:5000] if donnees.texte_brut else None,
        statut=validation.statut.value,
        est_valide=validation.est_valide,
        scores_validation=validation.scores,
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
    
    Pipeline complet :
    1. Validation du fichier (format, taille)
    2. Évaluation de la qualité d'image
    3. Prétraitement de l'image
    4. Extraction universelle (OCR + MRZ + NLP)
    5. Validation métier dynamique
    6. Vérification de cohérence (agent vs citoyen)
    7. Stockage physique et embedding facial
    8. Persistance en base de données
    """
    debut = time.time()
    
    # ── ÉTAPE 1 : Lire et valider l'image ──
    contenu = await _lire_image(fichier)
    nom_fichier = fichier.filename or f"document_{face}.jpg"
    extension = fichier.filename.split(".")[-1] if "." in fichier.filename else "jpg"
    
    # ── ÉTAPE 2 : Évaluer la qualité d'image ──
    qualite = evaluer_qualite_image(contenu)
    if not qualite.est_valide:
        raise ErreurValidation(
            f"Qualité d'image insuffisante : {qualite.message}",
            message_utilisateur="L'image est trop floue ou mal éclairée. Veuillez prendre une nouvelle photo dans de bonnes conditions."
        )
    
    journal.info(f"Qualité image : score={qualite.score_global:.1f}/100")
    
    # ── ÉTAPE 3 : Prétraiter l'image pour l'OCR ─
    contenu_optimise = pretraiter_image(contenu) or contenu
    
    # ── ÉTAPE 4 : Extraction universelle ──
    donnees = extraire_donnees_universelles(contenu_optimise)
    
    # Si type_document forcé, l'utiliser
    if type_document:
        donnees.type_document = type_document
    
    journal.info(
        f"Extraction terminée : type={donnees.type_document.value}, "
        f"confiance={donnees.taux_confiance_ocr:.1f}%, "
        f"nom={donnees.nom_famille}, prenom={donnees.prenoms}"
    )
    
    # ── ÉTAPE 5 : Validation métier dynamique ──
    validation = valider_document(donnees)
    
    if not validation.est_valide:
        journal.warning(
            f"Validation échouée : type={donnees.type_document.value}, "
            f"erreurs={validation.erreurs}"
        )
    
    # ── ÉTAPE 6 : Vérification de cohérence ──
    coherence = await verifier_coherence_identite(
        session=session,
        utilisateur=utilisateur,
        nouvelles_donnees=donnees,
        utilisateur_cible_id=utilisateur_cible_id,
    )
    
    # Si incohérence détectée, on rejette
    if not coherence.est_coherent:
        raise ErreurValidation(
            coherence.message,
            message_utilisateur=coherence.message,
        )
    
    # ─ ÉTAPE 7 : Stockage physique et embedding facial ──
    chemin_stockage = None
    embedding = None
    
    try:
        chemin_stockage = stocker_document(
            contenu,
            extension=extension,
            prefixe=donnees.type_document.value,
        )
        journal.info(f"Document stocké : {chemin_stockage}")
    except Exception as e:
        journal.warning(f"Échec stockage document : {e}")
    
    # Embedding facial (uniquement pour recto/unique et si validation réussie)
    if face in ("recto", "unique") and validation.est_valide:
        try:
            embedding = generer_embedding_facial(contenu)
            if embedding:
                journal.info(f"Embedding facial généré (dim: {len(embedding)})")
        except Exception as e:
            journal.warning(f"Échec extraction embedding facial : {e}")
    
    # ── ÉTAPE 8 : Persistance en base de données ─
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
    
    # ── ÉTAPE 9 : Mettre à jour le profil utilisateur si validation réussie ──
    if validation.est_valide:
        utilisateur.est_cni_verifiee = True
        utilisateur.date_verification_cni = datetime.now(timezone.utc)
        utilisateur.date_derniere_mise_a_jour_verifications = datetime.now(timezone.utc)
        await session.commit()
        
        # Recalcul du score de confiance
        try:
            from src.modules.scoring.service import declencher_recalcul_score
            await declencher_recalcul_score(
                session=session,
                utilisateur=utilisateur,
                raison="upload_document_valide",
            )
        except Exception as e:
            journal.warning(f"Échec recalcul score : {e}")
    
    temps_ms = int((time.time() - debut) * 1000)
    
    journal.info(
        f"Upload document terminé : utilisateur={utilisateur.id}, "
        f"type={donnees.type_document.value}, face={face}, "
        f"validation={validation.est_valide}, temps={temps_ms}ms"
    )
    
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
        .where(
            InspectionDocument.utilisateur_id == utilisateur.id,
            InspectionDocument.est_supprime == False,
        )
        .order_by(desc(InspectionDocument.cree_le))
        .limit(10)
    )
    verifs = resultats.scalars().all()
    
    dernier_recto = next((v for v in verifs if v.face == "recto"), None)
    dernier_verso = next((v for v in verifs if v.face == "verso"), None)
    dernier_unique = next((v for v in verifs if v.face == "unique"), None)
    
    doc_cible = dernier_unique or dernier_recto
    
    if not doc_cible:
        return SyntheseVerification(
            statut=StatutVerification.EN_ATTENTE,
            message="Aucun document trouvé.",
        )
    
    return SyntheseVerification(
        id_recto=dernier_recto.id if dernier_recto else None,
        id_verso=dernier_verso.id if dernier_verso else None,
        statut=StatutVerification(doc_cible.statut),
        message=f"Synthèse basée sur {doc_cible.type_document}",
        champs_verifies=sum(1 for v in doc_cible.scores_validation.values() if v) if doc_cible.scores_validation else 0
    )


async def obtenir_historique(
    session: AsyncSession,
    utilisateur: Utilisateur,
    limite: int = 20,
) -> ListeVerifications:
    """Liste l'historique paginé des vérifications."""
    resultats = await session.execute(
        select(InspectionDocument)
        .where(
            InspectionDocument.utilisateur_id == utilisateur.id,
            InspectionDocument.est_supprime == False,
        )
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