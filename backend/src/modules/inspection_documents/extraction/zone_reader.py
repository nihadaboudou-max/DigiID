# -- coding: utf-8 --
"""
Zone Reader V2 : Lecteur Ciblé avec protection Anti-JSON et Regex tolérantes.
"""
import io
import re
import base64
from typing import Dict, List, Optional, Any
from PIL import Image
import pytesseract

from src.noyau.journal import journal
from src.config import parametres

# =============================================================================
# WHITELISTS TESSERACT (Anti-hallucination OCR)
# =============================================================================
WHITELIST_DATES = "0123456789/-. "
WHITELIST_NUMEROS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/- "
WHITELIST_MRZ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<"

def _ocr_crop(image_bytes: bytes, whitelist: str, psm: int = 6, lang: str = "eng") -> str:
    if not image_bytes: return ""
    try:
        pil_img = Image.open(io.BytesIO(image_bytes))
        config = f"--oem 3 --psm {psm} -c tessedit_char_whitelist={whitelist}"
        return pytesseract.image_to_string(pil_img, lang=lang, config=config).strip()
    except Exception as e:
        journal.error(f"ZoneReader: Erreur OCR crop : {e}")
        return ""

# =============================================================================
# LECTURE MRZ (Vérité absolue)
# =============================================================================
def lire_zone_mrz(mrz_bytes: bytes) -> Dict[str, Optional[str]]:
    if not mrz_bytes: return {}
    texte = _ocr_crop(mrz_bytes, WHITELIST_MRZ, psm=6)
    lignes = [l.strip() for l in texte.split('\n') if l.strip()]
    lignes_mrz = [l for l in lignes if len(l) >= 25 and l.count('<') > 3]
    
    result = {}
    if len(lignes_mrz) >= 2:
        result['mrz_ligne_1'] = lignes_mrz[0]
        result['mrz_ligne_2'] = lignes_mrz[1]
        if len(lignes_mrz) >= 3: result['mrz_ligne_3'] = lignes_mrz[2]
    return result

# =============================================================================
# LECTURE STRUCTURÉE (Dates, Numéros via Tesseract - Regex assouplies)
# =============================================================================
def lire_zones_structurees(bandes: Dict[str, bytes]) -> Dict[str, Any]:
    resultats = {"dates_trouvees": [], "numeros_trouves": []}
    
    for nom_bande, img_bytes in bandes.items():
        if not img_bytes or "mrz" in nom_bande: continue
            
        # 1. Dates (Tesseract ne lira QUE des chiffres, /, - et ESPACES)
        texte_date = _ocr_crop(img_bytes, WHITELIST_DATES, psm=6)
        # Regex assouplie : accepte les espaces entre les chiffres (ex: 12 08 1990)
        dates_trouvees = re.findall(r'\d{1,2}[\s/.\-]\d{1,2}[\s/.\-]\d{2,4}', texte_date)
        resultats["dates_trouvees"].extend(dates_trouvees)
            
        # 2. Numéros
        texte_num = _ocr_crop(img_bytes, WHITELIST_NUMEROS, psm=6)
        numeros_trouves = re.findall(r'\b[A-Z0-9]{6,20}\b', texte_num.upper())
        numeros_valides = [n for n in numeros_trouves if any(c.isdigit() for c in n)]
        resultats["numeros_trouves"].extend(numeros_valides)

    resultats["dates_trouvees"] = list(dict.fromkeys(resultats["dates_trouvees"]))
    resultats["numeros_trouves"] = list(dict.fromkeys(resultats["numeros_trouves"]))
    return resultats

# =============================================================================
# PROTECTION ANTI-JSON & SANITIZATION VLM
# =============================================================================
def _nettoyer_et_valider_reponse_vlm(texte_brut: str) -> Optional[str]:
    """
    Nettoie la réponse du petit VLM.
    Si le VLM hallucine et renvoie du JSON ou une boucle, on rejette ou on extrait.
    """
    if not texte_brut: return None
    
    texte = texte_brut.strip()
    
    # 1. Rejet strict si le VLM a généré du JSON (il n'a pas respecté le prompt)
    if "{" in texte or "}" in texte or "[" in texte:
        journal.warning(f"ZoneReader: VLM a renvoyé du JSON, tentative d'extraction du premier mot clé.")
        # Tentative de sauvetage : extraire la première clé du JSON
        match = re.search(r'["\']([A-ZÀ-Üa-zà-ü\s\-]{3,30})["\']\s*:', texte)
        if match:
            return match.group(1).strip()
        return None # Rejet total si on n'arrive pas à sauver
        
    # 2. Rejet si la réponse est trop longue (signe de boucle d'hallucination)
    if len(texte) > 50:
        journal.warning(f"ZoneReader: Réponse VLM trop longue ({len(texte)} chars), rejetée (hallucination).")
        return None
        
    # 3. Nettoyage basique
    texte = texte.strip().strip('"').strip("'").strip()
    if texte.lower() in ["null", "none", "inconnu", "n/a", "", "...", "je ne sais pas"]:
        return None
        
    return texte

# =============================================================================
# LECTURE NON-STRUCTURÉE (Noms, Lieux via Petit VLM - Prompts Blindés)
# =============================================================================
async def _micro_vlm_extract(image_bytes: bytes, prompt: str) -> Optional[str]:
    if not getattr(parametres, 'activer_extraction_vlm', False): return None
        
    try:
        from src.modules.chatbot.fournisseur_llm import appeler_llm_vision
        
        pil_img = Image.open(io.BytesIO(image_bytes))
        if pil_img.mode != "RGB": pil_img = pil_img.convert("RGB")
        tampon = io.BytesIO()
        pil_img.save(tampon, format="JPEG", quality=85)
        img_b64 = base64.b64encode(tampon.getvalue()).decode("utf-8")
        
        # ⚠️ AJOUT D'UN MAX_TOKENS STRICT (Si ton fournisseur LLM le supporte)
        # Sinon, le prompt suffit à le brider.
        reponse = await appeler_llm_vision(
            image_base64=img_b64,
            prompt=prompt,
            mime_type="image/jpeg",
        )
        
        return _nettoyer_et_valider_reponse_vlm(reponse)
        
    except Exception as e:
        journal.warning(f"ZoneReader: Micro-VLM échec : {e}")
        return None

async def lire_zones_non_structurees(bandes: Dict[str, bytes]) -> Dict[str, Optional[str]]:
    resultats = {}
    
    # 🛡️ PROMPTS BLINDÉS : Interdiction formelle de faire du JSON
    prompt_nom = """
    Tu es un OCR pur. Lis UNIQUEMENT le nom de famille (en majuscules) sur cette image.
    RÈGLE ABSOLUE : Ne réponds AVEC AUCUN JSON, aucune accolade, aucune phrase. 
    Réponds STRICTEMENT avec le mot du nom, ou "null" si illisible.
    """
    
    prompt_prenom = """
    Tu es un OCR pur. Lis le prénom sur cette image.
    RÈGLE ABSOLUE : Ne réponds AVEC AUCUN JSON, aucune accolade, aucune phrase. 
    Réponds STRICTEMENT avec le mot du prénom, ou "null" si illisible.
    """
    
    prompt_lieu = """
    Tu es un OCR pur. Lis le lieu de naissance ou la ville sur cette image.
    RÈGLE ABSOLUE : Ne réponds AVEC AUCUN JSON, aucune accolade, aucune phrase. 
    Réponds STRICTEMENT avec le mot du lieu, ou "null" si illisible.
    """

    bandes_a_analyser = {k: v for k, v in bandes.items() if "mrz" not in k and "fallback" not in k and "globale" not in k}
    
    for nom_bande, img_bytes in bandes_a_analyser.items():
        if not img_bytes: continue
            
        if "nom_famille" not in resultats:
            val = await _micro_vlm_extract(img_bytes, prompt_nom)
            if val and len(val) > 2:
                resultats["nom_famille"] = val
                journal.info(f"VLM Crop ({nom_bande}) -> Nom: {val}")
                
        if "prenoms" not in resultats:
            val = await _micro_vlm_extract(img_bytes, prompt_prenom)
            if val and len(val) > 2:
                resultats["prenoms"] = val
                journal.info(f"VLM Crop ({nom_bande}) -> Prénom: {val}")

        if "lieu_naissance" not in resultats:
            val = await _micro_vlm_extract(img_bytes, prompt_lieu)
            if val and len(val) > 2:
                resultats["lieu_naissance"] = val
                journal.info(f"VLM Crop ({nom_bande}) -> Lieu: {val}")
                
        # Limite stricte : 3 appels VLM max pour ne pas exploser le temps de traitement
        if len(resultats) >= 3: break
            
    return resultats