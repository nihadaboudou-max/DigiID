# -- coding: utf-8 --
"""
Moteur de fusion intelligente multi-sources avec calcul de confiance pondéré.
Règle d'or : 
1. Le MRZ est la source de vérité absolue (100%).
2. Le VLM sur crop est validé par similarité floue (Fuzzy) contre l'OCR pour éviter l'hallucination.
3. La confiance finale est calculée selon la source de chaque champ critique.
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

# Champs critiques qui déterminent la confiance globale du document
CHAMPS_CRITIQUES = ["nom_famille", "prenoms", "numero_document", "date_naissance"]

# =============================================================================
# ANTI-HALLUCINATION : VALIDATION FLOUE (FUZZY MATCHING)
# =============================================================================
def _valider_anti_hallucination(valeur_vlm: str, texte_ocr: str, seuil: float = 0.75) -> bool:
    """
    Vérifie si une valeur extraite par le VLM existe bien dans le texte OCR brut.
    Utilise une similarité floue (SequenceMatcher) pour tolérer les erreurs OCR 
    (ex: VLM="PARAKOU", OCR="PARAK0U" -> Accepté car similarité > 75%).
    """
    if not valeur_vlm or not texte_ocr:
        return False
        
    val_upper = valeur_vlm.upper().strip()
    ocr_upper = texte_ocr.upper()
    
    # 1. Match exact (le plus rapide)
    if val_upper in ocr_upper:
        return True
        
    # 2. Match flou mot par mot (pour les noms composés ou lieux)
    mots_valeur = [m for m in re.split(r'[^A-Z0-9À-Ü]+', val_upper) if len(m) > 2]
    if not mots_valeur:
        return True # Valeur trop courte ou vide, on accepte par défaut
        
    mots_ocr = [m for m in re.split(r'[^A-Z0-9À-Ü]+', ocr_upper) if len(m) > 2]
    if not mots_ocr:
        return False
        
    correspondances = 0
    for mot_val in mots_valeur:
        # Trouver le mot dans l'OCR qui a la plus grande similarité
        meilleur_ratio = max(
            (SequenceMatcher(None, mot_val, mot_ocr).ratio() for mot_ocr in mots_ocr), 
            default=0.0
        )
        if meilleur_ratio >= seuil:
            correspondances += 1
            
    # On accepte si au moins 70% des mots de la valeur VLM ont un match flou dans l'OCR
    ratio_global = correspondances / len(mots_valeur)
    return ratio_global >= 0.7

# =============================================================================
# CALCUL DE CONFIANCE GLOBAL
# =============================================================================
def _calculer_confiance_globale(sources_champs: Dict[str, str]) -> float:
    """
    Calcule la confiance globale basée sur la source des champs CRITIQUES.
    Si un champ critique vient de la MRZ -> 100%.
    Sinon, moyenne pondérée des sources des champs critiques trouvés.
    """
    if not sources_champs:
        return 0.0
        
    # Si la MRZ a fourni au moins un champ critique, on monte à 95-100%
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
        
    # Moyenne des champs critiques trouvés
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
    """
    Fusionne les données de 4 sources avec priorité stricte et anti-hallucination.
    """
    donnees_zones_ocr = donnees_zones_ocr or {}
    donnees_zones_vlm = donnees_zones_vlm or {}
    
    # Dictionnaire pour tracker la source de chaque champ (pour le calcul de confiance)
    sources_champs = {}
    
    # ── 1. INITIALISATION : NLP Global (Regex) - Priorité la plus basse (60%) ──
    donnees_finales = {}
    for cle, valeur in donnees_nlp_global.items():
        if valeur and cle not in ["texte_brut", "confiance", "donnees_specifiques"]:
            donnees_finales[cle] = valeur
            sources_champs[cle] = "nlp_global"

    # ── 2. OVERLAY : Zones OCR (Tesseract Whitelist) - Priorité haute (90%) ──
    for cle, valeur in donnees_zones_ocr.items():
        if valeur and cle not in ["texte_brut", "confiance", "donnees_specifiques"]:
            # Écrase le NLP global car Tesseract sur crop avec whitelist est plus fiable
            donnees_finales[cle] = valeur
            sources_champs[cle] = "zone_ocr"

    # ── 3. OVERLAY : Zones VLM (Petit modèle sur crops) - Priorité moyenne (85%) ──
    # RÈGLE D'OR : Le VLM ne remplit QUE les champs vides, SAUF si fuzzy match valide un écrasement.
    for cle, valeur in donnees_zones_vlm.items():
        if not valeur or cle in ["texte_brut", "confiance", "donnees_specifiques"]:
            continue
            
        # Cas 1 : Le champ est vide -> On accepte le VLM (après nettoyage basique)
        if not donnees_finales.get(cle):
            donnees_finales[cle] = valeur
            sources_champs[cle] = "zone_vlm"
            journal.info(f"Fusion VLM -> {cle} : '{valeur}' (Champ vide)")
            
        # Cas 2 : Le champ est déjà rempli -> On vérifie l'anti-hallucination
        else:
            if _valider_anti_hallucination(valeur, texte_brut_ocr):
                # Le VLM a trouvé une valeur similaire dans l'OCR, on garde la plus propre
                donnees_finales[cle] = valeur
                sources_champs[cle] = "zone_vlm"
                journal.info(f"Fusion VLM -> {cle} : '{valeur}' validé par fuzzy match")
            else:
                journal.warning(f"Fusion VLM -> {cle} : '{valeur}' REJETÉ (Hallucination détectée, non trouvé dans OCR)")

    # ── 4. VÉRITÉ ABSOLUE : MRZ (100%) ──
    if donnees_mrz and donnees_mrz.get("mrz_valide"):
        journal.info("Fusion : Priorité MRZ absolue activée.")
        champs_mrz_mapping = {
            "nom_famille": "nom_famille",
            "prenoms": "prenoms",
            "numero_document": "numero_document",
            "date_naissance_date": "date_naissance",
            "date_expiration_date": "date_expiration",
            "sexe": "sexe",
            "pays_emetteur_nom": "pays_emetteur",
            "nationalite_nom": "nationalite",
        }
        for cle_mrz, cle_cible in champs_mrz_mapping.items():
            valeur_mrz = donnees_mrz.get(cle_mrz)
            if valeur_mrz:
                donnees_finales[cle_cible] = valeur_mrz
                sources_champs[cle_cible] = "mrz"

    # ── 5. SÉCURISATION PYDANTIC & NORMALISATION ──
    # Sexe (doit être M, F ou non_detecte)
    sexe_val = donnees_finales.get("sexe") or donnees_mrz.get("sexe") or "non_detecte"
    if isinstance(sexe_val, str):
        sexe_val = sexe_val.upper()
        if sexe_val not in ("M", "F"):
            if sexe_val in ("H", "MASculin", "MALE"): sexe_val = "M"
            else: sexe_val = "non_detecte"
    donnees_finales["sexe"] = sexe_val

    # Pays émetteur
    if not donnees_finales.get("pays_emetteur"):
        donnees_finales["pays_emetteur"] = donnees_finales.get("nationalite")

    # ── 6. CALCUL DE LA CONFIANCE GLOBALE ──
    confiance_calculee = _calculer_confiance_globale(sources_champs)
    
    # Si la MRZ est valide, on force à 100%
    if donnees_mrz and donnees_mrz.get("mrz_valide"):
        confiance_calculee = 100.0

    # ── 7. ASSEMBLAGE FINAL DU MODÈLE PYDANTIC ──
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
            lieu_naissance=donnees_finales.get("lieu_naissance"),
            autorite_delivrance=donnees_finales.get("autorite_delivrance"),
            nationalite=donnees_finales.get("nationalite"),
            taille=donnees_finales.get("taille"),
            sexe=SexeDocument(sexe_val),
            donnees_specifiques=donnees_nlp_global.get("donnees_specifiques", {}),
            taux_confiance_ocr=confiance_calculee,
            texte_brut=donnees_nlp_global.get("texte_brut", "")[:5000],
            mrz_ligne_1=donnees_mrz.get("mrz_ligne_1") or donnees_nlp_global.get("mrz_ligne_1"),
            mrz_ligne_2=donnees_mrz.get("mrz_ligne_2") or donnees_nlp_global.get("mrz_ligne_2"),
            mrz_ligne_3=donnees_mrz.get("mrz_ligne_3") or donnees_nlp_global.get("mrz_ligne_3"),
            mrz_valide=bool(donnees_mrz and donnees_mrz.get("mrz_valide")),
        )
        journal.info(f"Fusion terminée : Confiance={confiance_calculee}%, Sources={sources_champs}")
        return resultat
    except Exception as e:
        journal.error(f"Erreur assemblage Pydantic : {e}")
        # Fallback de secours pour ne jamais crasher l'API
        return DonneesDocumentExtraites(
            type_document=type_document,
            texte_brut=donnees_nlp_global.get("texte_brut", "")[:5000],
            taux_confiance_ocr=0.0,
            mrz_valide=False,
        )