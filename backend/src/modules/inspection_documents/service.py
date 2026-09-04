# -*- coding: utf-8 -*-
"""
Service d'orchestration pour le module d'inspection de documents.
Architecture VLM (Vision Language Model) via Ollama.

Pipeline complet :
1. Validation du fichier uploadé
2. Extraction par VLM (qwen2-vl:7b) — remplace Tesseract + Regex
3. Validation métier (dates, MRZ, format)
4. Vérification de cohérence avec le profil utilisateur
5. Persistance en base de données
6. Recalcul du score de confiance
"""
import base64
import json
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
from src.modules.chatbot.fournisseur_llm import appeler_llm_vision
from src.modules.inspection_documents.validation.validation_engine import valider_document
from src.modules.inspection_documents.validation.coherence_engine import verifier_coherence_identite
from src.modules.inspection_documents.storage.document_storage import stocker_document
from src.modules.inspection_documents.preprocessing.quality_checker import evaluer_qualite_image
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

# Prompt VLM pour extraction structurée de documents d'identité
PROMPT_EXTRACTION_VLM = """
Tu es un expert en extraction de données de documents d'identité africains et internationaux.

Analyse cette image et extrais les informations suivantes au format JSON STRICT :
{
  "est_document_identite": true ou false,
  "type_document": "cni_biometrique" | "cni_papier" | "passeport" | "permis_conduire" | "carte_assurance" | "carte_sejour" | "autre",
  "pays": "code pays à 3 lettres (ex: SEN, CIV, MLI) ou null",
  "nom_famille": "..." ou null,
  "prenoms": "..." ou null,
  "date_naissance": "JJ/MM/AAAA" ou null,
  "sexe": "M" ou "F" ou null,
  "numero_document": "..." ou null,
  "date_expiration": "JJ/MM/AAAA" ou null,
  "date_delivrance": "JJ/MM/AAAA" ou null,
  "nationalite": "..." ou null,
  "lieu_naissance": "..." ou null,
  "mrz_ligne_1": "..." ou null,
  "mrz_ligne_2": "..." ou null,
  "mrz_ligne_3": "..." ou null,
  "confiance_extraction": 0.0 à 1.0
}

RÈGLES STRICTES :
- Si ce n'est PAS un document d'identité officiel (ex: facture, photo personnelle, document non-officiel), mets "est_document_identite": false et tous les autres champs à null.
- Ne JAMAIS inventer de données. Si un champ n'est pas visible ou illisible, mets null.
- Pour la MRZ (zone en bas avec des <<<), extrais les 3 lignes exactes si présentes.
- Réponds UNIQUEMENT le JSON valide, rien d'autre. Pas de markdown, pas de commentaire, pas de ```json.
"""


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


def _parser_reponse_vlm(reponse_brute: str) -> Optional[dict]:
    """
    Parse la réponse JSON du VLM en gérant les formats variés.
    Retourne le dict extrait ou None si invalide.
    """
    if not reponse_brute:
        return None
    
    # Nettoyer la réponse (le VLM peut ajouter ```json ... ```)
    reponse_propre = reponse_brute.strip()
    
    # Retirer les balises markdown si présentes
    if reponse_propre.startswith("```"):
        lignes = reponse_propre.split("\n")
        # Retirer la première ligne (```json) et la dernière (```)
        if lignes[0].startswith("```"):
            lignes = lignes[1:]
        if lignes and lignes[-1].strip() == "```":
            lignes = lignes[:-1]
        reponse_propre = "\n".join(lignes).strip()
    
    try:
        donnees = json.loads(reponse_propre)
        return donnees
    except json.JSONDecodeError as e:
        journal.error(f"VLM : JSON invalide - {e}")
        journal.debug(f"Réponse brute VLM : {reponse_brute[:500]}")
        return None


async def _extraire_par_vlm(image_bytes: bytes) -> Optional[DonneesDocumentExtraites]:
    """
    Extrait les données d'un document via le VLM (Ollama qwen2-vl).
    Retourne un objet DonneesDocumentExtraites ou None si rejeté.
    """
    # Convertir l'image en base64
    image_base64 = base64.b64encode(image_bytes).decode("utf-8")
    
    try:
        # Appeler le VLM
        reponse_brute = await appeler_llm_vision(
            image_base64=image_base64,
            prompt=PROMPT_EXTRACTION_VLM,
            modele="qwen2-vl:7b",
        )
        
        # Parser la réponse JSON
        donnees_vlm = _parser_reponse_vlm(reponse_brute)
        
        if not donnees_vlm:
            journal.warning("VLM : Réponse invalide ou vide")
            return None
        
        # Vérifier si c'est un document d'identité
        if not donnees_vlm.get("est_document_identite", False):
            journal.info("VLM : Document rejeté (non-identité)")
            return None
        
        # Mapper le type de document
        type_doc_str = donnees_vlm.get("type_document", "inconnu")
        try:
            type_document = TypeDocument(type_doc_str)
        except ValueError:
            type_document = TypeDocument.INCONNU
        
        # Mapper le sexe
        sexe_val = donnees_vlm.get("sexe")
        if sexe_val not in ("M", "F"):
            sexe_val = "non_detecte"
        
        # Construire l'objet DonneesDocumentExtraites
        donnees = DonneesDocumentExtraites(
            type_document=type_document,
            pays_emetteur=donnees_vlm.get("pays"),
            nom_famille=donnees_vlm.get("nom_famille"),
            prenoms=donnees_vlm.get("prenoms"),
            date_naissance=donnees_vlm.get("date_naissance"),
            sexe=sexe_val,
            numero_document=donnees_vlm.get("numero_document"),
            date_expiration=donnees_vlm.get("date_expiration"),
            date_delivrance=donnees_vlm.get("date_delivrance"),
            nationalite=donnees_vlm.get("nationalite"),
            lieu_naissance=donnees_vlm.get("lieu_naissance"),
            mrz_ligne_1=donnees_vlm.get("mrz_ligne_1"),
            mrz_ligne_2=donnees_vlm.get("mrz_ligne_2"),
            mrz_ligne_3=donnees_vlm.get("mrz_ligne_3"),
            mrz_valide=bool(donnees_vlm.get("mrz_ligne_1")),
            taux_confiance_ocr=float(donnees_vlm.get("confiance_extraction", 0.0) * 100),
            texte_brut=reponse_brute[:5000] if reponse_brute else "",
        )
        
        journal.info(
            f"VLM : Document extrait - type={type_document.value}, "
            f"pays={donnees.pays_emetteur}, confiance={donnees.taux_confiance_ocr:.1f}%"
        )
        
        return donnees
        
    except Exception as e:
        journal.error(f"VLM : Erreur extraction - {e}")
        return None


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
        donnees_specifiques=donnees.donnees_specifiques or {},
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
    Traite l'upload d'un document d'identité via VLM.
    
    Pipeline complet :
    1. Validation du fichier (format, taille)
    2. Évaluation de la qualité d'image
    3. Extraction par VLM (Ollama qwen2-vl:7b)
    4. Validation métier dynamique
    5. Vérification de cohérence (agent vs citoyen)
    6. Stockage physique
    7. Persistance en base de données
    8. Recalcul du score de confiance
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
    
    # ── ÉTAPE 3 : Extraction par VLM ──
    donnees = await _extraire_par_vlm(contenu)
    
    if donnees is None:
        raise ErreurValidation(
            "Document non reconnu comme pièce d'identité officielle.",
            message_utilisateur="Ce document ne semble pas être une pièce d'identité officielle (CNI, passeport, permis, etc.)."
        )
    
    # Si type_document forcé par l'utilisateur, l'utiliser
    if type_document:
        donnees.type_document = type_document
    
    journal.info(
        f"Extraction VLM terminée : type={donnees.type_document.value}, "
        f"confiance={donnees.taux_confiance_ocr:.1f}%, "
        f"nom={donnees.nom_famille}, prenom={donnees.prenoms}"
    )
    
    # ── ÉTAPE 4 : Validation métier dynamique ──
    validation = valider_document(donnees)
    
    if not validation.est_valide:
        journal.warning(
            f"Validation échouée : type={donnees.type_document.value}, "
            f"erreurs={validation.erreurs}"
        )
    
    # ── ÉTAPE 5 : Vérification de cohérence ──
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
    
    # ── ÉTAPE 6 : Stockage physique ──
    chemin_stockage = None
    try:
        chemin_stockage = stocker_document(
            contenu,
            extension=extension,
            prefixe=donnees.type_document.value,
        )
        journal.info(f"Document stocké : {chemin_stockage}")
    except Exception as e:
        journal.warning(f"Échec stockage document : {e}")
    
    # ── ÉTAPE 7 : Persistance en base de données ──
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
    
    # ── ÉTAPE 8 : Mettre à jour le profil utilisateur si validation réussie ──
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