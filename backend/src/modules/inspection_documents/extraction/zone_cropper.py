# -- coding: utf-8 --
"""
Zone Reader : Le Lecteur Ciblé.
Prend les crops générés par zone_cropper et les lit avec les moteurs adaptés.
- Tesseract pour les données structurées (MRZ, Dates, Numéros) avec whitelists strictes.
- VLM pour les données non structurées (Noms, Lieux) sur des crops propres.
"""
import io
import re
import base64
import asyncio
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
    """Lance Tesseract sur un crop avec une whitelist stricte."""
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
    """Lit la zone MRZ avec la configuration stricte."""
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
# LECTURE STRUCTURÉE (Dates, Numéros via Tesseract)
# =============================================================================
def lire_zones_structurees(bandes: Dict[str, bytes]) -> Dict[str, Any]:
    """Lit les dates et numéros dans les bandes avec des whitelists strictes."""
    resultats = {"dates_trouvees": [], "numeros_trouves": []}
    
    for nom_bande, img_bytes in bandes.items():
        if not img_bytes or "mrz" in nom_bande: continue
            
        # 1. Dates (Tesseract ne lira QUE des chiffres et /)
        texte_date = _ocr_crop(img_bytes, WHITELIST_DATES, psm=6)
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
# LECTURE NON-STRUCTURÉE (VLM sur micro-crops)
# =============================================================================
async def _micro_vlm_extract(image_bytes: bytes, prompt: str) -> Optional[str]:
    """
    Appelle le VLM avec un micro-prompt sur un crop.
    Retourne le texte brut ou None.
    """
    if not getattr(parametres, 'activer_extraction_vlm', False):
        return None
        
    try:
        from src.modules.chatbot.fournisseur_llm import appeler_llm_vision
        
        # Normalisation rapide en base64
        pil_img = Image.open(io.BytesIO(image_bytes))
        if pil_img.mode != "RGB": pil_img = pil_img.convert("RGB")
        tampon = io.BytesIO()
        pil_img.save(tampon, format="JPEG", quality=85)
        img_b64 = base64.b64encode(tampon.getvalue()).decode("utf-8")
        
        # ⚠️ TIMEOUT STRICT : 10 secondes max pour ne pas bloquer le serveur
        try:
            reponse = await asyncio.wait_for(
                appeler_llm_vision(
                    image_base64=img_b64,
                    prompt=prompt,
                    mime_type="image/jpeg",
                ),
                timeout=10.0
            )
        except asyncio.TimeoutError:
            journal.warning("ZoneReader: VLM Timeout (10s). Abandon.")
            return None
        
        if reponse:
            # Nettoyage basique de la réponse
            texte = reponse.strip().strip('"').strip("'").strip()
            if texte.lower() in ["null", "none", "inconnu", "n/a", ""]:
                return None
            return texte
    except Exception as e:
        journal.warning(f"ZoneReader: Micro-VLM échec : {e}")
        
    return None

async def lire_zones_non_structurees(bandes: Dict[str, bytes]) -> Dict[str, Optional[str]]:
    """
    Utilise le VLM pour lire les noms et lieux sur des crops propres.
    Le VLM ne voit que des petits rectangles noirs et blancs, il ne peut pas halluciner.
    """
    resultats = {}
    
    # Micro-prompts ultra-ciblés pour le VLM
    prompt_nom = """
    Tu es un OCR pur. Lis UNIQUEMENT le nom de famille (en majuscules) sur cette petite image.
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

    # On analyse les bandes (hors MRZ)
    bandes_a_analyser = {k: v for k, v in bandes.items() if "mrz" not in k and "fallback" not in k and "globale" not in k}
    
    for nom_bande, img_bytes in bandes_a_analyser.items():
        if not img_bytes: continue
            
        # On essaie d'extraire le Nom
        if "nom_famille" not in resultats:
            val = await _micro_vlm_extract(img_bytes, prompt_nom)
            if val and len(val) > 2:
                resultats["nom_famille"] = val
                journal.info(f"VLM Crop ({nom_bande}) -> Nom: {val}")
                
        # On essaie d'extraire le Prénom
        if "prenoms" not in resultats:
            val = await _micro_vlm_extract(img_bytes, prompt_prenom)
            if val and len(val) > 2:
                resultats["prenoms"] = val
                journal.info(f"VLM Crop ({nom_bande}) -> Prénom: {val}")

        # On essaie d'extraire le Lieu
        if "lieu_naissance" not in resultats:
            val = await _micro_vlm_extract(img_bytes, prompt_lieu)
            if val and len(val) > 2:
                resultats["lieu_naissance"] = val
                journal.info(f"VLM Crop ({nom_bande}) -> Lieu: {val}")
                
        # Limiter les appels VLM pour ne pas exploser le temps de traitement (Max 3 crops analysés par VLM)
        if len(resultats) >= 3:
            break
            
    return resultats