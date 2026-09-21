# -- coding: utf-8 --
"""
Service d'orchestration pour le module d'inspection de documents.
Pipeline "Crop & Conquer" (Low-RAM / Anti-Hallucination) :
1. OCR global (texte brut de secours pour les regex)
2. Zone Cropper (OpenCV) : Découpage en zones propres (MRZ, Bandes)
3. Zone Reader : 
   - Tesseract avec whitelists pour Dates/Numéros
   - Petit VLM sur micro-crops pour Noms/Lieux
4. Parsing MRZ (Vérité absolue)
5. NLP Regex (Filet de secours)
6. Fusion intelligente & Validation
"""
import base64
import time
import re
from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID
from fastapi import UploadFile
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import DocumentIdentite
from src.modeles import Utilisateur
from src.modeles.inspection_document import InspectionDocument
from src.modules.inspection_documents.schemas import (
    DonneesDocumentExtraites, DetailVerification, FaceDocument, ListeVerifications,
    ResultatCoherence, ResultatValidation, ReponseSuppression, ReponseRestauration,
    ReponseUploadDocument, StatutVerification, SyntheseVerification, TypeDocument, SexeDocument,
)
from src.modules.inspection_documents.validation.validation_engine import valider_document
from src.modules.inspection_documents.validation.coherence_engine import verifier_coherence_identite

# --- ANCIENS MODULES (Gardés pour le texte brut de secours et les regex) ---
from src.modules.inspection_documents.extraction.ocr_engine import analyser_document
from src.modules.inspection_documents.extraction.mrz_parser import parser_mrz_complet
from src.modules.inspection_documents.extraction.fusion_engine import fusionner_donnees
from src.modules.inspection_documents.extraction.nlp_extractor import (
    extraire_permis_conduire, extraire_carte_assurance, extraire_par_labels,
)
from src.modules.inspection_documents.extraction.field_mapper import mapper_champs_extraits
from src.modules.inspection_documents.classification.document_classifier import classifier_document, detecter_pays
from src.modules.inspection_documents.classification.patterns_documents import PATTERNS_GENERIQUES
from src.modules.inspection_documents.storage.document_storage import stocker_document
from src.modules.inspection_documents.preprocessing.quality_checker import evaluer_qualite_image

# --- NOUVEAUX MODULES "CROP & CONQUER" ---
from src.modules.inspection_documents.extraction.zone_cropper import extraire_zones_interet
from src.modules.inspection_documents.extraction.zone_reader import (
    lire_zone_mrz, lire_zones_structurees, lire_zones_non_structurees
)

from src.noyau import journal
from src.noyau.exceptions import ErreurRessourceIntrouvable, ErreurValidation
from src.config import parametres

# =============================================================================
# CONSTANTES
# =============================================================================
TAILLE_MAX_IMAGE = 15 * 1024 * 1024  # 15 Mo
TYPES_MIME_AUTORISES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/tiff": "tiff"}
CODES_PAYS_TEXTES = ["SEN", "CIV", "MLI", "BEN", "BFA", "TOG", "GHA", "NGA", "GIN", "NER", "CMR", "COD", "COG"]

# =============================================================================
# FONCTIONS UTILITAIRES INTERNES
# =============================================================================
async def _lire_image(fichier: UploadFile) -> bytes:
    if fichier.content_type not in TYPES_MIME_AUTORISES:
        raise ErreurValidation(f"Type MIME refusé : {fichier.content_type}", message_utilisateur="Format d'image non supporté.")
    contenu = await fichier.read()
    if not contenu: raise ErreurValidation("Fichier vide reçu.", message_utilisateur="Le fichier est vide.")
    if len(contenu) > TAILLE_MAX_IMAGE:
        raise ErreurValidation(f"Image trop volumineuse.", message_utilisateur=f"L'image dépasse {TAILLE_MAX_IMAGE // 1024 // 1024} Mo.")
    return contenu

def _normaliser_date(chaine: Optional[str]) -> Optional[str]:
    if not chaine: return None
    s = str(chaine).strip()
    m_iso = re.search(r"(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})", s)
    if m_iso:
        annee, mois, jour = int(m_iso.group(1)), int(m_iso.group(2)), int(m_iso.group(3))
        if 1 <= mois <= 12 and 1 <= jour <= 31 and 1900 <= annee <= 2100:
            return f"{jour:02d}/{mois:02d}/{annee:04d}"
    m = re.search(r"(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})", s)
    if not m: return None
    jour, mois, annee = int(m.group(1)), int(m.group(2)), m.group(3)
    if len(annee) == 2: annee = 1900 + int(annee) if int(annee) >= 40 else 2000 + int(annee)
    else: annee = int(annee)
    if 1 <= mois <= 12 and 1 <= jour <= 31 and 1900 <= annee <= 2100:
        return f"{jour:02d}/{mois:02d}/{annee:04d}"
    return None

def _pad3(lignes) -> tuple:
    valeurs = list(lignes or ())[:3]
    while len(valeurs) < 3: valeurs.append(None)
    return tuple(valeurs)

def _type_depuis_code_mrz(l1: Optional[str]) -> Optional[TypeDocument]:
    if not l1: return None
    debut = str(l1).upper().ljust(2)
    if debut.startswith(("P<", "P ")): return TypeDocument.PASSEPORT
    if debut.startswith(("I<", "ID")): return TypeDocument.CNI_BIOMETRIQUE
    if debut.startswith(("A<", "AC")): return TypeDocument.CARTE_SEJOUR
    return None

def _choisir_type_document(texte_brut: str, mrz_lignes: tuple, type_suggere: Optional[TypeDocument]) -> TypeDocument:
    ocr_type = classifier_document(texte_brut or "", mrz_lignes or (None, None, None))
    code_mrz = _type_depuis_code_mrz((mrz_lignes or (None,))[0])
    type_document = code_mrz or ocr_type or TypeDocument.INCONNU
    if type_suggere and type_suggere != TypeDocument.INCONNU:
        if type_document == TypeDocument.INCONNU: type_document = type_suggere
    return type_document

async def verifier_numero_document_unique(
    session: AsyncSession,
    numero_document: str,
    type_document: str,
    utilisateur_id: str
) -> None:
    """
    Vérifie qu'un numéro de document n'existe pas déjà en base de données.
    Lève une ErreurValidation si le document est déjà enregistré.
    """
    # On cherche un document avec le même numéro ET le même type
    stmt = select(DocumentIdentite).where(
        DocumentIdentite.numero_document == numero_document.strip().upper(),
        DocumentIdentite.type_document == type_document
    )
    
    resultat = await session.execute(stmt)
    document_existant = resultat.scalar_one_or_none()
    
    if document_existant:
        # Cas 1 : C'est le même utilisateur qui tente de re-uploader le même document
        if str(document_existant.utilisateur_id) == str(utilisateur_id):
            raise ErreurValidation(
                "Document déjà enregistré",
                message_utilisateur=f"Vous avez déjà enregistré ce {type_document} (N° {numero_document}). Vous ne pouvez pas l'ajouter plusieurs fois."
            )
        # Cas 2 : C'est un autre utilisateur qui possède déjà ce numéro (Fraude potentielle)
        else:
            raise ErreurValidation(
                "Numéro de document déjà utilisé",
                message_utilisateur=f"Ce numéro de {type_document} ({numero_document}) est déjà associé à un autre compte dans le système. Veuillez vérifier le numéro ou contacter le support."
            )


# =============================================================================
# NOUVEAU PIPELINE D'EXTRACTION : "CROP & CONQUER"
# =============================================================================
async def _extraire_donnees_classique(
    image_bytes: bytes,
    type_suggere: Optional[TypeDocument],
) -> DonneesDocumentExtraites:
    try:
        # ── 1. OCR GLOBAL (Texte brut de secours pour les Regex) ──
        resultat_ocr = analyser_document(image_bytes)
        texte_brut = resultat_ocr.get("texte_brut") or ""
        confiance_globale = float(resultat_ocr.get("confiance_moyenne", 0.0) or 0.0)        
        
        # ── 2. CROP & CONQUER (Le nouveau moteur Low-RAM) ──
        donnees_zones_nlp = {}
        donnees_zones_struct = {"dates_trouvees": [], "numeros_trouves": []}
        mrz_lignes_zones = (None, None, None)
        
        try:
            journal.info("Pipeline: Lancement du Zone Cropper (OpenCV)...")
            zones = extraire_zones_interet(image_bytes)
            
            if zones:
                # 2a. Lecture MRZ ciblée (Tesseract config stricte)
                if zones.get("zone_mrz"):
                    mrz_crop = lire_zone_mrz(zones["zone_mrz"])
                    mrz_lignes_zones = (
                        mrz_crop.get("mrz_ligne_1"), 
                        mrz_crop.get("mrz_ligne_2"), 
                        mrz_crop.get("mrz_ligne_3")
                    )
                    journal.info(f"ZoneReader: MRZ lue depuis crop -> {mrz_lignes_zones[0][:10] if mrz_lignes_zones[0] else 'None'}...")
                
                # 2b. Lecture structurée (Tesseract avec Whitelists)
                bandes = {k: v for k, v in zones.items() if "bande" in k or "fallback" in k}
                if bandes:
                    donnees_zones_struct = lire_zones_structurees(bandes)
                    journal.info(f"ZoneReader: {len(donnees_zones_struct['dates_trouvees'])} dates, {len(donnees_zones_struct['numeros_trouves'])} numéros trouvés.")
               
                # 2c. Lecture non-structurée (Petit VLM sur micro-crops)
                # ⚠️ RÈGLE D'OR : Si la MRZ est lue, on SAUTE le VLM pour les noms/prénoms.
                # Le MRZ parser s'en chargera avec 100% de certitude.
                mrz_lue_avec_suces = mrz_lignes_zones[0] and mrz_lignes_zones[1] and "<<" in mrz_lignes_zones[0]
                
                if not mrz_lue_avec_suces and bandes and getattr(parametres, 'activer_extraction_vlm', False):
                    journal.info("ZoneReader: MRZ absente ou incomplète. Activation du VLM de secours sur les crops.")
                    donnees_zones_nlp = await lire_zones_non_structurees(bandes)
                    journal.info(f"ZoneReader: VLM Crop -> {donnees_zones_nlp}")
                elif mrz_lue_avec_suces:
                    journal.info("ZoneReader: MRZ lue avec succès. VLM désactivé pour les noms (gain de temps/RAM).")


        except Exception as e:
            journal.warning(f"Pipeline Zone échoué, fallback sur OCR global : {e}")

        # ── 3. Fusion des lignes MRZ (Crop prioritaire, sinon OCR global) ──
        mrz_lignes_globales = resultat_ocr.get("mrz_lignes") or (None, None, None)
        mrz_finales = mrz_lignes_zones if mrz_lignes_zones[0] and mrz_lignes_zones[1] else mrz_lignes_globales

        # ── 4. Classification du document ──
        type_document = _choisir_type_document(texte_brut, mrz_finales, type_suggere)
        journal.info(f"Classification finale : {type_document.value}")

        # ── 5. Parsing MRZ (Vérité absolue) ──
        donnees_mrz = {}
        if mrz_finales[0] and mrz_finales[1]:
            donnees_mrz = parser_mrz_complet(mrz_finales[0], mrz_finales[1], mrz_finales[2])

        # ── 6. Extraction NLP Globale (Filet de secours Regex) ──
        donnees_nlp = extraire_par_labels(texte_brut, PATTERNS_GENERIQUES)
        
        # ── 7. Injection des données des ZONES (Si le NLP global a échoué) ──
        # 7a. Dates et Numéros (Tesseract Whitelist)
        if not donnees_nlp.get("date_naissance") and donnees_zones_struct["dates_trouvees"]:
            # La date de naissance est généralement la plus ancienne
            dates_valides = [d for d in donnees_zones_struct["dates_trouvees"] if _normaliser_date(d)]
            if dates_valides:
                donnees_nlp["date_naissance"] = min(dates_valides, key=lambda d: int(d.split('/')[2]))
                
        if not donnees_nlp.get("numero_document") and donnees_zones_struct["numeros_trouves"]:
            donnees_nlp["numero_document"] = donnees_zones_struct["numeros_trouves"][0]

        # 7b. Noms et Lieux (VLM sur crops)
        for cle in ["nom_famille", "prenoms", "lieu_naissance"]:
            if not donnees_nlp.get(cle) and donnees_zones_nlp.get(cle):
                donnees_nlp[cle] = donnees_zones_nlp[cle]
            
        # ── 8. Extracteurs spécifiques (Permis, Assurance, CNI) ──
        if type_document == TypeDocument.PERMIS_CONDUIRE:
            extraits = extraire_permis_conduire(texte_brut)
        elif type_document == TypeDocument.CARTE_ASSURANCE:
            extraits = extraire_carte_assurance(texte_brut)
        else:
            extraits = {}

        # 🎯 MAPPING CANONIQUE (module unique) : traduction des clés brutes des
        # extracteurs vers les champs du schéma + les clés attendues en aval.
        communs_extraits, donnees_specifiques = mapper_champs_extraits(extraits, type_document)

        # Injection dans le flux principal SANS écraser une valeur déjà présente
        for cle, valeur in communs_extraits.items():
            if valeur and not donnees_nlp.get(cle):
                donnees_nlp[cle] = valeur            

        # ── 9. Pays émetteur ──
        code_pays = detecter_pays(texte_brut, mrz_finales)
        if not code_pays:
            for code in CODES_PAYS_TEXTES:
                if re.search(rf"\b{code}\b", texte_brut.upper()):
                    code_pays = code
                    break
        if code_pays: donnees_nlp["pays_emetteur"] = code_pays

        # ── 10. Assemblage final ──
        donnees_nlp["donnees_specifiques"] = donnees_specifiques
        donnees_nlp["texte_brut"] = texte_brut[:5000]
        donnees_nlp["confiance"] = confiance_globale
        donnees_nlp["mrz_ligne_1"] = mrz_finales[0]
        donnees_nlp["mrz_ligne_2"] = mrz_finales[1]
        donnees_nlp["mrz_ligne_3"] = mrz_finales[2]

        return fusionner_donnees(
            donnees_nlp_global=donnees_nlp,
            donnees_zones_ocr=donnees_zones_struct,
            donnees_zones_vlm=donnees_zones_nlp,
            #donnees_zones_vlm={},
            donnees_mrz=donnees_mrz,
            texte_brut_ocr=texte_brut,
            type_document=type_document
        )            

    except Exception as e:
        journal.exception(f"Échec critique de l'extraction : {e}")
        return DonneesDocumentExtraites(
            type_document=type_suggere or TypeDocument.INCONNU,
            texte_brut="Erreur extraction. Nécessite une saisie manuelle.",
            taux_confiance_ocr=0.0, mrz_valide=False,
        )

# =============================================================================
# PERSISTANCE EN BASE DE DONNÉES (INCHANGÉ)
# =============================================================================
async def _enregistrer_document(
    session: AsyncSession, utilisateur: Utilisateur, donnees: DonneesDocumentExtraites,
    validation: ResultatValidation, face: str, nom_fichier: str, type_mime: str,
    taille_octets: int, document_chemin: Optional[str] = None,
) -> InspectionDocument:
    doc = InspectionDocument(
        utilisateur_id=utilisateur.id, type_document=donnees.type_document.value, face=face,
        nom_fichier=nom_fichier, type_mime=type_mime, taille_octets=taille_octets,
        document_chemin=document_chemin, nom_famille=donnees.nom_famille, prenoms=donnees.prenoms,
        date_naissance=donnees.date_naissance, 
        sexe=donnees.sexe.value if hasattr(donnees.sexe, 'value') else str(donnees.sexe),
        numero_document=donnees.numero_document, date_expiration=donnees.date_expiration,
        lieu_naissance=donnees.lieu_naissance, date_delivrance=donnees.date_delivrance,
        autorite_delivrance=getattr(donnees, 'autorite_delivrance', None),
        nationalite=donnees.pays_emetteur, taille=getattr(donnees, 'taille', None),
        mrz_ligne_1=donnees.mrz_ligne_1, mrz_ligne_2=donnees.mrz_ligne_2, mrz_ligne_3=donnees.mrz_ligne_3,
        mrz_valide=donnees.mrz_valide, donnees_specifiques=getattr(donnees, 'donnees_specifiques', {}),
        texte_brut=donnees.texte_brut[:5000] if donnees.texte_brut else None,
        statut=validation.statut.value, est_valide=validation.est_valide,
        scores_validation=validation.scores or {}, taux_confiance_ocr=donnees.taux_confiance_ocr,
    )
    session.add(doc)
    await session.commit()
    await session.refresh(doc)
    return doc

# =============================================================================
# SERVICES PUBLICS (INCHANGÉS)
# =============================================================================
async def traiter_upload_document(
    session: AsyncSession, utilisateur: Utilisateur, fichier: UploadFile,
    type_document: Optional[TypeDocument] = None, face: str = "recto",
    utilisateur_cible_id: Optional[UUID] = None,
) -> ReponseUploadDocument:
    debut = time.time()
    contenu = await _lire_image(fichier)
    nom_fichier = fichier.filename or f"document_{face}.jpg"
    extension = fichier.filename.split(".")[-1] if "." in fichier.filename else "jpg"

    qualite = evaluer_qualite_image(contenu)
    if not qualite.est_valide:
        raise ErreurValidation(f"Qualité d'image insuffisante : {qualite.message}", message_utilisateur="L'image est trop floue ou mal éclairée.")

    # 🚀 APPEL DU NOUVEAU PIPELINE "CROP & CONQUER"
    donnees = await _extraire_donnees_classique(contenu, type_document)

    # ✅ NOUVEAU : Vérifier l'unicité du numéro de document AVANT toute autre vérification
    if donnees.numero_document:
        # On utilise .value si c'est un Enum, sinon on convertit en string
        type_doc_str = donnees.type_document.value if hasattr(donnees.type_document, 'value') else str(donnees.type_document)
        
        await verifier_numero_document_unique(
            session=session,
            numero_document=donnees.numero_document,
            type_document=type_doc_str,
            utilisateur_id=str(utilisateur.id)
        )

    validation = valider_document(donnees)
    if not validation.est_valide:
        validation.statut = StatutVerification.EN_ATTENTE
        validation.message = "Document reçu. Extraction partielle, en attente de vérification manuelle."

    coherence = None
    if donnees.nom_famille or donnees.numero_document:
        coherence = await verifier_coherence_identite(
            session=session, 
            utilisateur=utilisateur, 
            nouvelles_donnees=donnees, 
            utilisateur_cible_id=utilisateur_cible_id
        )
        if not coherence.est_coherent:
            validation.statut = StatutVerification.EN_ATTENTE
            validation.message = f"Incohérence détectée : {coherence.message}. En attente de revue."

    chemin_stockage = None
    try:
        chemin_stockage = stocker_document(contenu, extension=extension, prefixe=donnees.type_document.value)
    except Exception as e:
        journal.warning(f"Échec stockage document : {e}")

    doc = await _enregistrer_document(
        session=session, utilisateur=utilisateur, donnees=donnees, validation=validation,
        face=face, nom_fichier=nom_fichier, type_mime=fichier.content_type or "image/jpeg",
        taille_octets=len(contenu), document_chemin=chemin_stockage,
    )

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
    journal.info(f"Upload document terminé : statut={validation.statut.value}, temps={temps_ms}ms")

    return ReponseUploadDocument(
        id_verification=doc.id, type_document=donnees.type_document, statut=validation.statut,
        donnees=donnees, validation=validation, coherence=coherence,
        message=validation.message, temps_traitement_ms=temps_ms,
    )

async def obtenir_synthese_verification(session: AsyncSession, utilisateur: Utilisateur) -> SyntheseVerification:
    resultats = await session.execute(select(InspectionDocument).where(InspectionDocument.utilisateur_id == utilisateur.id, InspectionDocument.est_supprime == False).order_by(desc(InspectionDocument.cree_le)).limit(10))
    verifs = resultats.scalars().all()
    dernier_recto = next((v for v in verifs if v.face == "recto"), None)
    dernier_verso = next((v for v in verifs if v.face == "verso"), None)
    dernier_unique = next((v for v in verifs if v.face == "unique"), None)
    doc_cible = dernier_unique or dernier_recto
    if not doc_cible: return SyntheseVerification(statut=StatutVerification.EN_ATTENTE, message="Aucun document trouvé.")
    scores = doc_cible.scores_validation or {}
    champs_verifies = sum(1 for v in scores.values() if v) if isinstance(scores, dict) else 0
    return SyntheseVerification(id_recto=dernier_recto.id if dernier_recto else None, id_verso=dernier_verso.id if dernier_verso else None, statut=StatutVerification(doc_cible.statut), message=f"Synthèse basée sur {doc_cible.type_document}", champs_verifies=champs_verifies)

async def obtenir_historique(session: AsyncSession, utilisateur: Utilisateur, limite: int = 20) -> ListeVerifications:
    resultats = await session.execute(select(InspectionDocument).where(InspectionDocument.utilisateur_id == utilisateur.id, InspectionDocument.est_supprime == False).order_by(desc(InspectionDocument.cree_le)).limit(limite))
    verifs = resultats.scalars().all()
    historique = [DetailVerification(id=v.id, utilisateur_id=v.utilisateur_id, type_document=TypeDocument(v.type_document), statut=StatutVerification(v.statut), face=FaceDocument(v.face), nom_fichier=v.nom_fichier, numero_document=v.numero_document, nom_famille=v.nom_famille, prenoms=v.prenoms, date_naissance=v.date_naissance, taux_confiance_ocr=v.taux_confiance_ocr, est_valide=v.est_valide, cree_le=v.cree_le, est_supprime=v.est_supprime) for v in verifs]
    return ListeVerifications(historique=historique, total=len(historique), limite=limite)

async def supprimer_verification(session: AsyncSession, utilisateur: Utilisateur, verification_id: UUID) -> ReponseSuppression:
    res = await session.execute(select(InspectionDocument).where(InspectionDocument.id == verification_id, InspectionDocument.utilisateur_id == utilisateur.id))
    doc = res.scalar_one_or_none()
    if not doc: raise ErreurRessourceIntrouvable("Document introuvable.")
    doc.est_supprime = True
    doc.date_suppression = datetime.now(timezone.utc)
    await session.commit()
    return ReponseSuppression(id=verification_id, message="Document mis à la corbeille.")

async def restaurer_verification(session: AsyncSession, utilisateur: Utilisateur, verification_id: UUID) -> ReponseRestauration:
    res = await session.execute(select(InspectionDocument).where(InspectionDocument.id == verification_id, InspectionDocument.utilisateur_id == utilisateur.id))
    doc = res.scalar_one_or_none()
    if not doc: raise ErreurRessourceIntrouvable("Document introuvable.")
    doc.est_supprime = False
    doc.date_suppression = None
    await session.commit()
    return ReponseRestauration(id=verification_id, message="Document restauré.")