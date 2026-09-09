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
from src.modules.inspection_documents.extraction.ocr_engine import analyser_document
from src.modules.inspection_documents.extraction.mrz_parser import parser_mrz_complet
from src.modules.inspection_documents.extraction.fusion_engine import fusionner_donnees
from src.modules.inspection_documents.extraction.nlp_extractor import (
    extraire_permis_conduire,
    extraire_carte_assurance,
    extraire_par_labels,
)
from src.modules.inspection_documents.classification.document_classifier import (
    classifier_document,
    detecter_pays,
)
from src.modules.inspection_documents.classification.patterns_documents import PATTERNS_GENERIQUES
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


CODES_PAYS_TEXTES = ["SEN", "CIV", "MLI", "BEN", "BFA", "TOG", "GHA", "NGA", "GIN", "NER", "CMR", "COD", "COG"]


def _normaliser_date(chaine: Optional[str]) -> Optional[str]:
    """Normalise JJ/MM/AAAA ou JJ-MM-AAAA vers JJ/MM/AAAA (valide)."""
    m = re.search(r"(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})", chaine or "")
    if not m:
        return None
    jour, mois, annee = int(m.group(1)), int(m.group(2)), m.group(3)
    if len(annee) == 2:
        annee = 1900 + int(annee) if int(annee) >= 40 else 2000 + int(annee)
    else:
        annee = int(annee)
    if 1 <= mois <= 12 and 1 <= jour <= 31 and 1900 <= annee <= 2100:
        return f"{jour:02d}/{mois:02d}/{annee:04d}"
    return None


async def _extraire_donnees_classique(
    image_bytes: bytes,
    type_suggere: Optional[TypeDocument],
) -> DonneesDocumentExtraites:
    """
    Extraction universelle et performante, quel que soit le type de document :
    Prétraitement OpenCV → OCR + détection MRZ multi-zones → Classification robuste
    → Parsing MRZ (source de vérité) → Extraction NLP générique + spécifique au type → Fusion.
    """
    try:
        # ── 1. OCR prétraité (CLAHE/adaptatif) + MRZ + confiance réelle ──
        resultat_ocr = analyser_document(image_bytes)
        texte = resultat_ocr.get("texte_brut") or ""
        confiance = float(resultat_ocr.get("confiance_moyenne", 0.0) or 0.0)
        mrz_lignes = resultat_ocr.get("mrz_lignes") or (None, None, None)
        texte_upper = texte.upper()

        # ── 2. Classification automatique (MRZ > regex > heuristique) ──
        type_document = classifier_document(texte, mrz_lignes)

        # Le type choisi côté client tranche les ambiguïtés (ex : CNI papier vs biométrique sans MRZ)
        if type_suggere and type_suggere != TypeDocument.INCONNU:
            if type_document == TypeDocument.INCONNU or (
                type_suggere == TypeDocument.CNI_PAPIER
                and type_document == TypeDocument.CNI_BIOMETRIQUE
                and not mrz_lignes[0]
            ):
                type_document = type_suggere

        # ── 3. Parsing MRZ (prioritaire si présente) ──
        donnees_mrz = {}
        if mrz_lignes[0] and mrz_lignes[1]:
            donnees_mrz = parser_mrz_complet(mrz_lignes[0], mrz_lignes[1], mrz_lignes[2])

        # ── 4. Identité commune (NOM, PRÉNOMS, naissance, sexe, lieu) ──
        donnees_nlp = extraire_par_labels(texte, PATTERNS_GENERIQUES)

        # ── 5. Numéro de document (si absent du MRZ) ──
        if not donnees_nlp.get("numero_document") and not donnees_mrz.get("numero_document"):
            m_num = re.search(
                r"(?:N[°O]|NUM[ÉE]RO)\s*(?:D['`]?IDENTIT[ÉE]|CNI|PASSEPORT|PERMIS)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\s\-]{5,19})",
                texte,
                re.IGNORECASE,
            )
            if m_num:
                numero = re.sub(r"[^A-Z0-9]", "", m_num.group(1).upper())
                if 5 <= len(numero) <= 20:
                    donnees_nlp["numero_document"] = numero

        # ── 6. Dates expiration/délivrance étiquetées (si absentes du MRZ) ──
        if not donnees_nlp.get("date_expiration") and not donnees_mrz.get("date_expiration_date"):
            m_exp = re.search(
                r"(?:EXPIR[EÉ]|EXPIRATION|VALABLE\s*(?:JUSQU|AU)|VALIDIT[ÉE]\s*JUSQU|FIN\s*DE\s*VALIDIT[ÉE])\s*[:\-]?\s*(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})",
                texte,
                re.IGNORECASE,
            )
            if m_exp:
                d = _normaliser_date(m_exp.group(1))
                if d:
                    donnees_nlp["date_expiration"] = d

        if not donnees_nlp.get("date_delivrance"):
            m_del = re.search(
                r"(?:D[ÉE]LIVR[ÉE]|DATE\s*DE\s*D[ÉE]LIVRANCE)\s*[:\-]?\s*(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})",
                texte,
                re.IGNORECASE,
            )
            if m_del:
                d = _normaliser_date(m_del.group(1))
                if d:
                    donnees_nlp["date_delivrance"] = d

        # ── 7. Données spécifiques au type (permis, assurance, …) ──
        if type_document == TypeDocument.PERMIS_CONDUIRE:
            extraits = extraire_permis_conduire(texte)
        elif type_document == TypeDocument.CARTE_ASSURANCE:
            extraits = extraire_carte_assurance(texte)
        else:
            extraits = {}

        champs_communs = {"numero_document", "date_expiration", "date_delivrance",
                          "nom_famille", "prenoms", "date_naissance", "sexe"}
        donnees_specifiques = {}
        for cle, valeur in (extraits or {}).items():
            if not valeur:
                continue
            if cle in champs_communs:
                donnees_nlp.setdefault(cle, valeur)
            else:
                donnees_specifiques[cle] = valeur

        # ── 8. Pays émetteur (MRZ d'abord, puis codes pays dans le texte) ──
        code_pays = detecter_pays(texte, mrz_lignes)
        if not code_pays:
            for code in CODES_PAYS_TEXTES:
                if re.search(rf"\b{code}\b", texte_upper):
                    code_pays = code
                    break

        # ── 9. Assemblage + fusion (MRZ prioritaire) ──
        donnees_nlp["pays_emetteur"] = code_pays
        donnees_nlp["donnees_specifiques"] = donnees_specifiques
        donnees_nlp["texte_brut"] = texte[:5000]
        donnees_nlp["confiance"] = confiance
        donnees_nlp["mrz_ligne_1"] = mrz_lignes[0]
        donnees_nlp["mrz_ligne_2"] = mrz_lignes[1]
        donnees_nlp["mrz_ligne_3"] = mrz_lignes[2]

        return fusionner_donnees(donnees_nlp, donnees_mrz, type_document)

    except Exception as e:
        journal.warning(f"Échec de l'extraction OCR : {e}")
        return DonneesDocumentExtraites(
            type_document=type_suggere or TypeDocument.INCONNU,
            texte_brut="OCR indisponible. Nécessite une saisie manuelle.",
            taux_confiance_ocr=0.0,
            mrz_valide=False,
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