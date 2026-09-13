# -*- coding: utf-8 -*-
"""
Extracteur VLM (Vision Language Model) pour les documents d'identité.
"""
import base64
import io
import json
import re
from typing import Optional, Dict, Any
from src.modules.chatbot.fournisseur_llm import appeler_llm_vision
from src.noyau import journal

PROMPT_EXTRACTION_VLM = """
Tu es un expert en extraction de documents d'identité.

RÈGLES ABSOLUES :
1. Réponds UNIQUEMENT avec un objet JSON valide.
2. Si une information est absente ou illisible, mets EXACTEMENT : null
3. NE RÉPÈTE JAMAIS la même valeur dans plusieurs champs.
4. Chaque champ doit avoir une valeur DIFFÉRENTE (sauf si vraiment identique sur le document).
5. Pour le nom et prénom : cherche les MAJUSCULES après les labels "NOM", "SURNAME", "PRÉNOM".
6. Pour le numéro : cherche un format comme "1234/VILLE" ou un bloc de 6-15 caractères alphanumériques.
7. Pour les dates : format JJ/MM/AAAA uniquement.

JSON À REMPLIR :
{
  "nom_famille": null,
  "prenoms": null,
  "date_naissance": null,
  "sexe": null,
  "numero_document": null,
  "date_expiration": null,
  "date_delivrance": null,
  "lieu_naissance": null,
  "nationalite": null,
  "pays_emetteur": null
}

EXEMPLE DE BONNE RÉPONSE :
{
  "nom_famille": "ABOUDOU TRAORE",
  "prenoms": "NIHAD",
  "date_naissance": "12/10/2002",
  "sexe": "F",
  "numero_document": "0551/PARAKOU",
  "date_expiration": "09/09/2034",
  "date_delivrance": "09/09/2024",
  "lieu_naissance": "PARAKOU",
  "nationalite": "Béninoise",
  "pays_emetteur": "BEN"
}
"""

def _normaliser_image_jpeg(image_bytes: bytes) -> tuple[str, str]:
    """Convertit l'image en JPEG RGB, la redimensionne si nécessaire."""
    try:
        from PIL import Image
        pil_image = Image.open(io.BytesIO(image_bytes))
        max_dimension = 1024
        if pil_image.width > max_dimension or pil_image.height > max_dimension:
            pil_image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
            journal.info(f"VLM : Image redimensionnée à {pil_image.width}x{pil_image.height}")
        if pil_image.mode != "RGB":
            pil_image = pil_image.convert("RGB")
        tampon = io.BytesIO()
        pil_image.save(tampon, format="JPEG", quality=85)
        return "image/jpeg", base64.b64encode(tampon.getvalue()).decode("utf-8")
    except Exception as e:
        journal.warning(f"VLM : normalisation image impossible ({e})")
        return "image/jpeg", base64.b64encode(image_bytes).decode("utf-8")

async def extraire_donnees_vlm(image_bytes: bytes) -> Optional[Dict[str, Any]]:
    """Extrait les données d'un document via le VLM configuré."""
    try:
        mime_type, image_base64 = _normaliser_image_jpeg(image_bytes)
        reponse_brute = await appeler_llm_vision(
            image_base64=image_base64,
            prompt=PROMPT_EXTRACTION_VLM,
            mime_type=mime_type,
        )
        if not reponse_brute:
            journal.warning("VLM : réponse vide")
            return None
        donnees = _parser_reponse_json(reponse_brute)
        if donnees:
            journal.info(f"VLM : extraction réussie - nom={donnees.get('nom_famille')}, num={donnees.get('numero_document')}")
        return donnees
    except Exception as e:
        journal.error(f"VLM : erreur extraction - {e}")
        return None

def _parser_reponse_json(reponse_brute: str) -> Optional[Dict[str, Any]]:
    """Parse la réponse JSON du VLM avec tolérance."""
    if not reponse_brute or not reponse_brute.strip():
        return None
    reponse_propre = reponse_brute.strip()
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
        # Nettoyage : remplacer "..." ou "null" string par None
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