# -*- coding: utf-8 -*-
"""
Extracteur VLM (Vision Language Model) pour les documents d'identité.
Le modèle est désormais géré dynamiquement via la variable d'environnement 
OLLAMA_MODELE_VISION (dans .env), et non plus codé en dur.
"""
import base64
import io
import json
import re
from typing import Optional, Dict, Any

from src.modules.chatbot.fournisseur_llm import appeler_llm_vision
from src.noyau import journal

# ─── Prompt d'extraction ─────────────────────────────────────────────────────
PROMPT_EXTRACTION_VLM = """\
Look at this identity card image carefully.

Extract this information and respond ONLY with a JSON object, no explanation:

{
  "est_document_identite": true,
  "type_document": "cni_biometrique",
  "pays": "BEN",
  "nom_famille": "family name here",
  "prenoms": "first name here",
  "date_naissance": "DD/MM/YYYY",
  "sexe": "M or F",
  "numero_document": "number at top of card",
  "date_expiration": "DD/MM/YYYY",
  "date_delivrance": "DD/MM/YYYY",
  "nationalite": "Béninoise",
  "lieu_naissance": "city name",
  "mrz_ligne_1": "",
  "mrz_ligne_2": "",
  "mrz_ligne_3": "",
  "confiance_extraction": 0.8
}

Rules:
- document number format is usually XXXX/CITY like 0551/PARAKOU
- dates must be DD/MM/YYYY format
- if a field is not visible, use empty string ""
- respond with JSON only, nothing before or after
"""


def _normaliser_image_jpeg(image_bytes: bytes) -> tuple[str, str]:
    """Convertit l'image en JPEG RGB, la redimensionne si nécessaire, et renvoie (mime_type, base64)."""
    try:
        from PIL import Image
        
        pil_image = Image.open(io.BytesIO(image_bytes))
        
        # ✅ NOUVEAU : Redimensionner si l'image est trop grande (max 1024x1024)
        # Cela réduit drastiquement le nombre de tokens et le temps de traitement (de ~60s à ~10s)
        max_dimension = 1024
        if pil_image.width > max_dimension or pil_image.height > max_dimension:
            pil_image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
            journal.info(f"VLM : Image redimensionnée à {pil_image.width}x{pil_image.height} pour optimiser le traitement.")
        
        # Convertir en RGB si nécessaire (pour les PNG avec transparence)
        if pil_image.mode != "RGB":
            pil_image = pil_image.convert("RGB")
        
        # Sauvegarder en JPEG avec une qualité raisonnable
        tampon = io.BytesIO()
        pil_image.save(tampon, format="JPEG", quality=85)
        
        return "image/jpeg", base64.b64encode(tampon.getvalue()).decode("utf-8")
        
    except Exception as e:
        journal.warning(f"VLM : normalisation image impossible ({e}), envoi brut en JPEG.")
        return "image/jpeg", base64.b64encode(image_bytes).decode("utf-8")


async def extraire_donnees_vlm(image_bytes: bytes) -> Optional[Dict[str, Any]]:
    """
    Extrait les données d'un document via le VLM configuré.
    """
    try:
        mime_type, image_base64 = _normaliser_image_jpeg(image_bytes)

        # ✅ CORRECTION : On ne force plus "moondream". 
        # On laisse appeler_llm_vision utiliser parametres.ollama_modele_vision
        reponse_brute = await appeler_llm_vision(
            image_base64=image_base64,
            prompt=PROMPT_EXTRACTION_VLM,
            mime_type=mime_type,
            # Le paramètre 'modele' est omis, donc le fallback de fournisseur_llm.py s'applique
        )

        if not reponse_brute:
            journal.warning("VLM : réponse vide")
            return None

        donnees = _parser_reponse_json(reponse_brute)

        if donnees:
            journal.info(
                f"VLM : extraction réussie - type={donnees.get('type_document')}, "
                f"nom={donnees.get('nom_famille')}, "
                f"mrz={'oui' if donnees.get('mrz_ligne_1') else 'non'}, "
                f"confiance={donnees.get('confiance_extraction', 0) or 0}"
            )

        return donnees

    except Exception as e:
        journal.error(f"VLM : erreur extraction - {e}")
        return None


def _parser_reponse_json(reponse_brute: str) -> Optional[Dict[str, Any]]:
    """Parse la réponse JSON du VLM avec une tolérance maximale aux erreurs de formatage."""
    if not reponse_brute or not reponse_brute.strip():
        journal.warning("VLM : Réponse complètement vide ou nulle reçue du modèle.")
        journal.debug(f"Réponse brute complète (repr): {repr(reponse_brute)}")
        return None

    reponse_propre = reponse_brute.strip()

    # 1. Chercher la première et la dernière accolade pour isoler le JSON
    premier_accolade = reponse_propre.find("{")
    dernier_accolade = reponse_propre.rfind("}")
    
    if premier_accolade != -1 and dernier_accolade != -1 and dernier_accolade > premier_accolade:
        reponse_propre = reponse_propre[premier_accolade:dernier_accolade + 1]
    else:
        journal.warning(f"VLM : Aucune accolade JSON '{{}}' trouvée dans la réponse.")
        journal.debug(f"Début de la réponse brute : {reponse_propre[:300]}")
        return None

    try:
        donnees = json.loads(reponse_propre)
        
        if not isinstance(donnees, dict):
            journal.warning(f"VLM : Le JSON parsé n'est pas un dictionnaire, mais un {type(donnees)}")
            return None
        
        # Assainissement minimal des chaînes (nettoie les sauts de ligne et espaces multiples)
        for cle in list(donnees.keys()):
            if donnees[cle] is None:
                continue
            if isinstance(donnees[cle], str):
                donnees[cle] = re.sub(r"\s+", " ", donnees[cle]).strip() or None
                
        journal.info("✅ VLM : JSON parsé et nettoyé avec succès.")
        return donnees
        
    except json.JSONDecodeError as e:
        journal.error(f"VLM : Échec du parsing JSON - {e}")
        # On affiche un aperçu de ce qui a causé l'erreur pour le débogage
        journal.debug(f"Contenu ayant échoué au parsing (500 premiers chars) : {repr(reponse_propre[:500])}")
        return None