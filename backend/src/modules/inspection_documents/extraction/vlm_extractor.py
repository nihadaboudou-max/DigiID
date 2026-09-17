# -- coding: utf-8 --
"""
Extracteur VLM (Vision Language Model) adapté pour Low-RAM.
Supporte l'extraction sur image complète (fallback) et sur micro-crops (stratégie Crop & Conquer).
"""
import asyncio
import base64
import io
import json
import re
from typing import Optional, Dict, Any
from src.modules.chatbot.fournisseur_llm import appeler_llm_vision
from src.noyau.journal import journal

# Prompt pour l'image complète (Fallback si le cropper échoue)
PROMPT_EXTRACTION_VLM_GLOBAL = """
Tu es un expert en extraction de documents d'identité.
RÈGLES ABSOLUES :
1. Réponds UNIQUEMENT avec un objet JSON valide.
2. Si une information est absente ou illisible, mets EXACTEMENT : null
3. NE RÉPÈTE JAMAIS la même valeur dans plusieurs champs.
4. Pour les dates : format JJ/MM/AAAA uniquement.
JSON À REMPLIR :
{
 "nom_famille": null, "prenoms": null, "date_naissance": null,
 "sexe": null, "numero_document": null, "date_expiration": null,
 "date_delivrance": null, "lieu_naissance": null, "nationalite": null, "pays_emetteur": null
}
"""

def _normaliser_image_jpeg(image_bytes: bytes, max_dim: int = 1024) -> tuple[str, str]:
    """Convertit l'image en JPEG RGB, la redimensionne si nécessaire."""
    try:
        from PIL import Image
        pil_image = Image.open(io.BytesIO(image_bytes))
        if pil_image.width > max_dim or pil_image.height > max_dim:
            pil_image.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
        if pil_image.mode != "RGB":
            pil_image = pil_image.convert("RGB")
        tampon = io.BytesIO()
        # Qualité réduite pour les crops afin d'économiser la RAM et la bande passante
        qualite = 95 if max_dim >= 1024 else 85 
        pil_image.save(tampon, format="JPEG", quality=qualite)
        return "image/jpeg", base64.b64encode(tampon.getvalue()).decode("utf-8")
    except Exception as e:
        journal.warning(f"VLM : normalisation image impossible ({e})")
        return "image/jpeg", base64.b64encode(image_bytes).decode("utf-8")

async def extraire_donnees_vlm(image_bytes: bytes, timeout: float = 15.0) -> Optional[Dict[str, Any]]:
    """Extraction globale (Fallback). Timeout strict pour ne jamais bloquer le pipeline."""
    try:
        mime_type, image_base64 = _normaliser_image_jpeg(image_bytes, max_dim=1024)
        reponse_brute = await asyncio.wait_for(
            appeler_llm_vision(
                image_base64=image_base64,
                prompt=PROMPT_EXTRACTION_VLM_GLOBAL,
                mime_type=mime_type,
            ),
            timeout=timeout,
        )
        return _parser_reponse_json(reponse_brute)
    except asyncio.TimeoutError:
        journal.warning(f"VLM Global : timeout ({timeout}s), abandon.")
        return None
    except Exception as e:
        journal.error(f"VLM Global : erreur extraction - {e}")
        return None

async def extraire_micro_crop_vlm(image_bytes: bytes, prompt_micro: str) -> Optional[str]:
    """
    Extraction ciblée sur un micro-crop (Stratégie Crop & Conquer).
    Retourne le texte brut ou None.
    """
    try:
        # On ne redimensionne pas trop car les crops sont déjà petits (max 300px)
        mime_type, image_base64 = _normaliser_image_jpeg(image_bytes, max_dim=400)
        
        reponse_brute = await appeler_llm_vision(
            image_base64=image_base64,
            prompt=prompt_micro,
            mime_type=mime_type,
        )
        
        if reponse_brute:
            texte = reponse_brute.strip().strip('"').strip("'").strip()
            if texte.lower() in ["null", "none", "inconnu", "n/a", "", "..."]:
                return None
            return texte
    except Exception as e:
        journal.warning(f"VLM Micro-crop : échec - {e}")
        
    return None

def _parser_reponse_json(reponse_brute: str) -> Optional[Dict[str, Any]]:
    """Parse la réponse JSON du VLM avec tolérance."""
    if not reponse_brute or not reponse_brute.strip():
        return None
        
    reponse_propre = reponse_brute.strip()
    # Extraction du bloc JSON (au cas où le VLM ajoute du texte avant/après)
    premier_accolade = reponse_propre.find("{")
    dernier_accolade = reponse_propre.rfind("}")
    
    if premier_accolade != -1 and dernier_accolade > premier_accolade:
        reponse_propre = reponse_propre[premier_accolade:dernier_accolade + 1]
    else:
        return None
        
    try:
        donnees = json.loads(reponse_propre)
        if not isinstance(donnees, dict):
            return None
            
        # Nettoyage des valeurs
        for cle in list(donnees.keys()):
            if isinstance(donnees[cle], str):
                val = donnees[cle].strip()
                if val.lower() in ["...", "null", "none", "inconnu", "n/a", ""]:
                    donnees[cle] = None
                else:
                    donnees[cle] = re.sub(r"\s+", " ", val).strip()
        return donnees
    except json.JSONDecodeError as e:
        journal.error(f"VLM : JSON invalide - {e}")
        return None