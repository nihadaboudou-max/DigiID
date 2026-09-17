# -- coding: utf-8 --
"""
Moteur de Réalignement et Validation Croisée.
Règle d'or : La MRZ est la "Vérité Absolue" (Golden Record). 
Ce moteur compare activement l'OCR visuel à la MRZ pour détecter les conflits et les corriger.
"""
import re
from difflib import SequenceMatcher
from typing import Optional, Dict, Any

from src.modules.inspection_documents.schemas import (
    DonneesDocumentExtraites, TypeDocument, SexeDocument
)
from src.noyau import journal

# =============================================================================
# POIDS DE CONFIANCE PAR SOURCE
# =============================================================================
POIDS_SOURCES = {
    "mrz": 100.0,
    "zone_ocr": 90.0,   # Tesseract avec whitelist (très fiable)
    "zone_vlm": 85.0,   # VLM sur crop (fiable si fuzzy validé)
    "nlp_global": 60.0, # Regex sur texte brut (fallback)
}

CHAMPS_CRITIQUES = ["nom_famille", "prenoms", "numero_document", "date_naissance"]

# =============================================================================
# COMPARAISON ET VALIDATION CROISÉE (Le cœur de la robustesse)
# =============================================================================
def _comparer_et_valider(champ: str, valeur_ocr: Any, valeur_mrz: Any) -> Any:
    """
    Compare une valeur OCR à sa contrepartie MRZ.
    Si elles diffèrent, la MRZ gagne toujours, et un avertissement est logué.
    """
    if not valeur_mrz:
        return valeur_ocr  # Pas de MRZ pour ce champ, on garde l'OCR
        
    if not valeur_ocr:
        return valeur_mrz  # Champ vide en OCR, on prend la MRZ
        
    # Nettoyage basique pour comparaison (enlever espaces, mettre en majuscule)
    ocr_clean = str(valeur_ocr).upper().replace(" ", "").replace("-", "")
    mrz_clean = str(valeur_mrz).upper().replace(" ", "").replace("-", "")
    
    # Si c'est identique (ou très proche), on garde la version MRZ (plus propre)
    if ocr_clean == mrz_clean or mrz_clean in ocr_clean or ocr_clean in mrz_clean:
        return valeur_mrz
        
    # 🚨 CONFLIT DÉTECTÉ : L'OCR a halluciné ou mal lu
    journal.warning(f"CONFLIT {champ.upper()} : OCR='{valeur_ocr}' vs MRZ='{valeur_mrz}'. La MRZ est imposée.")
    return valeur_mrz

# =============================================================================
# ANTI-HALLUCINATION : VALIDATION FLOUE (FUZZY MATCHING)
# =============================================================================
def _valider_anti_hallucination(valeur_vlm: str, texte_ocr: str, seuil: float = 0.75) -> bool:
    if not valeur_vlm or not texte_ocr:
        return False
        
    val_upper = valeur_vlm.upper().strip()
    ocr_upper = texte_ocr.upper()
    
    if val_upper in ocr_upper:
        return True
        
    mots_valeur = [m for m in re.split(r'[^A-Z0-9À-Ü]+', val_upper) if len(m) > 2]
    if not mots_valeur:
        return True 
        
    mots_ocr = [m for m in re.split(r'[^A-Z0-9À-Ü]+', ocr_upper) if len(m) > 2]
    if not mots_ocr:
        return False
        
    correspondances = 0
    for mot_val in mots_valeur:
        meilleur_ratio = max(
            (SequenceMatcher(None, mot_val, mot_ocr).ratio() for mot_ocr in mots_ocr), 
            default=0.0
        )
        if meilleur_ratio >= seuil:
            correspondances += 1
            
    ratio_global = correspondances / len(mots_valeur)
    return ratio_global >= 0.7

# =============================================================================
# CALCUL DE CONFIANCE GLOBAL
# =============================================================================
def _calculer_confiance_globale(sources_champs: Dict[str, str], mrz_valide: bool) -> float:
    if mrz_valide:
        return 100.0
        
    if not sources_champs:
        return 0.0
        
    if any(sources_champs.get(c) == "mrz" for c in CHAMPS_CRITIQUES):
        return 100.0
        
    total_poids = 0.0
    nb_champs_trouves = 0
    
    for champ in CHAMPS_CRITIQUES:
        source = sources_champs.get(champ)
        if source and source in POIDS_SOURCES:
            total_poids += POIDS_SOURCES[source]
            nb_champs_trouves += 1
            
    if nb_champs_trouves == 0:
        return 0.0
        
    return round(total_poids / nb_champs_trouves, 1)

# =============================================================================
# FONCTION DE FUSION PRINCIPALE
# =============================================================================
def fusionner_donnees(
    donnees_nlp_global: dict,
    donnees_mrz: dict,
    type_document: TypeDocument,
    donnees_zones_ocr: Optional[dict] = None,
    donnees_zones_vlm: Optional[dict] = None,
    texte_brut_ocr: str = "",
) -> DonneesDocumentExtraites:
    donnees_zones_ocr = donnees_zones_ocr or {}
    donnees_zones_vlm = donnees_zones_vlm or {}
    
    sources_champs = {}
    donnees_finales = {}
    
    # 1. INITIALISATION : NLP Global (60%)
    for cle, valeur in donnees_nlp_global.items():
        if valeur and cle not in ["texte_brut", "confiance", "donnees_specifiques"]:
            donnees_finales[cle] = valeur
            sources_champs[cle] = "nlp_global"

    # 2. OVERLAY : Zones OCR (90%)
    for cle, valeur in donnees_zones_ocr.items():
        if valeur and cle not in ["texte_brut", "confiance", "donnees_specifiques"]:
            donnees_finales[cle] = valeur
            sources_champs[cle] = "zone_ocr"

    # 3. OVERLAY : Zones VLM (85%)
    for cle, valeur in donnees_zones_vlm.items():
        if not valeur or cle in ["texte_brut", "confiance", "donnees_specifiques"]:
            continue
            
        if not donnees_finales.get(cle):
            donnees_finales[cle] = valeur
            sources_champs[cle] = "zone_vlm"
            journal.info(f"Fusion VLM -> {cle} : '{valeur}' (Champ vide)")
        else:
            if _valider_anti_hallucination(valeur, texte_brut_ocr):
                donnees_finales[cle] = valeur
                sources_champs[cle] = "zone_vlm"
                journal.info(f"Fusion VLM -> {cle} : '{valeur}' validé par fuzzy match")
            else:
                journal.warning(f"Fusion VLM -> {cle} : '{valeur}' REJETÉ (Hallucination détectée)")

    # 4. VÉRITÉ ABSOLUE : MRZ (100%) avec Validation Croisée
    mrz_valide = bool(donnees_mrz and donnees_mrz.get("mrz_valide") and donnees_mrz.get("nom_famille"))
    
    if mrz_valide:
        journal.info("Fusion : Mode Réalignement MRZ activé (Vérité Absolue).")
        
        # Réalignement actif des champs critiques (compare et logue les conflits)
        donnees_finales["nom_famille"] = _comparer_et_valider("nom", donnees_finales.get("nom_famille"), donnees_mrz.get("nom_famille"))
        donnees_finales["prenoms"] = _comparer_et_valider("prenoms", donnees_finales.get("prenoms"), donnees_mrz.get("prenoms"))
        donnees_finales["numero_document"] = _comparer_et_valider("numero", donnees_finales.get("numero_document"), donnees_mrz.get("numero_document"))
        donnees_finales["date_naissance"] = _comparer_et_valider("date_naissance", donnees_finales.get("date_naissance"), donnees_mrz.get("date_naissance_date"))
        donnees_finales["date_expiration"] = _comparer_et_valider("date_expiration", donnees_finales.get("date_expiration"), donnees_mrz.get("date_expiration_date"))
        
        # Champs MRZ directs
        if donnees_mrz.get("sexe") in ("M", "F"):
            donnees_finales["sexe"] = donnees_mrz.get("sexe")
        if donnees_mrz.get("pays_emetteur_nom"):
            donnees_finales["pays_emetteur"] = donnees_mrz.get("pays_emetteur_nom")
            donnees_finales["nationalite"] = donnees_mrz.get("pays_emetteur_nom")
            
        for champ in ["nom_famille", "prenoms", "numero_document", "date_naissance", "date_expiration"]:
            sources_champs[champ] = "mrz"

    # 5. SÉCURISATION PYDANTIC & NORMALISATION
    sexe_val = donnees_finales.get("sexe") or "non_detecte"
    if isinstance(sexe_val, str):
        sexe_val = sexe_val.upper()
        if sexe_val not in ("M", "F"):
            if sexe_val in ("H", "MASCULIN", "MALE"): sexe_val = "M"
            else: sexe_val = "non_detecte"
    donnees_finales["sexe"] = sexe_val

    if not donnees_finales.get("pays_emetteur"):
        donnees_finales["pays_emetteur"] = donnees_finales.get("nationalite")

    # 6. CALCUL DE LA CONFIANCE GLOBALE
    confiance_calculee = _calculer_confiance_globale(sources_champs, mrz_valide)

    # 7. ASSEMBLAGE FINAL DU MODÈLE PYDANTIC
    try:
        resultat = DonneesDocumentExtraites(
            type_document=type_document,
            pays_emetteur=donnees_finales.get("pays_emetteur"),
            nom_famille=donnees_finales.get("nom_famille"),
            prenoms=donnees_finales.get("prenoms"),
            numero_document=donnees_finales.get("numero_document"),
            date_naissance=donnees_finales.get("date_naissance"),
            date_expiration=donnees_finales.get("date_expiration"),
            date_delivrance=donnees_finales.get("date_delivrance"),
            lieu_naissance=donnees_finales.get("lieu_naissance"), # Jamais dans la MRZ, on garde l'OCR/NLP
            autorite_delivrance=donnees_finales.get("autorite_delivrance"), # Jamais dans la MRZ
            nationalite=donnees_finales.get("nationalite"),
            taille=donnees_finales.get("taille"),
            sexe=SexeDocument(sexe_val),
            donnees_specifiques=donnees_nlp_global.get("donnees_specifiques", {}),
            taux_confiance_ocr=confiance_calculee,
            texte_brut=donnees_nlp_global.get("texte_brut", "")[:5000],
            mrz_ligne_1=donnees_mrz.get("mrz_ligne_1") or donnees_nlp_global.get("mrz_ligne_1"),
            mrz_ligne_2=donnees_mrz.get("mrz_ligne_2") or donnees_nlp_global.get("mrz_ligne_2"),
            mrz_ligne_3=donnees_mrz.get("mrz_ligne_3") or donnees_nlp_global.get("mrz_ligne_3"),
            mrz_valide=mrz_valide,
        )
        journal.info(f"Fusion terminée : Confiance={confiance_calculee}%, MRZ={mrz_valide}")
        return resultat
    except Exception as e:
        journal.error(f"Erreur assemblage Pydantic : {e}")
        return DonneesDocumentExtraites(
            type_document=type_document,
            texte_brut=donnees_nlp_global.get("texte_brut", "")[:5000],
            taux_confiance_ocr=0.0,
            mrz_valide=False,
        )