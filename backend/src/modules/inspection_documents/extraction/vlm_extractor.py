# -*- coding: utf-8 -*-
"""
Extracteur VLM (Vision Language Model) via Ollama.
Utilise qwen2-vl:2b (modèle léger) pour l'extraction de documents d'identité.
"""
import base64
from typing import Optional, Dict, Any
from src.modules.chatbot.fournisseur_llm import appeler_llm_vision
from src.noyau import journal

PROMPT_EXTRACTION_VLM = """
Tu es un expert en extraction de données de documents d'identité africains et internationaux.

Analyse cette image et extrais les informations suivantes au format JSON STRICT :
{
  "est_document_identite": true ou false,
  "type_document": "cni_biometrique" | "cni_papier" | "passeport" | "permis_conduire" | "carte_assurance" | "autre",
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
- Si ce n'est PAS un document d'identité officiel, mets "est_document_identite": false.
- Ne JAMAIS inventer de données. Si un champ n'est pas visible, mets null.
- Pour la MRZ (zone avec des <<<), extrais les 3 lignes exactes.
- Réponds UNIQUEMENT le JSON valide, rien d'autre. Pas de markdown.
"""


async def extraire_donnees_vlm(image_bytes: bytes) -> Optional[Dict[str, Any]]:
    """
    Extrait les données d'un document via le VLM local (Ollama qwen2-vl:2b).
    
    Args:
        image_bytes: L'image du document en bytes
        
    Returns:
        Dict avec les données extraites ou None si échec
    """
    try:
        # Convertir l'image en base64
        image_base64 = base64.b64encode(image_bytes).decode("utf-8")
        
        # Appeler le VLM avec le modèle léger 2B
        reponse_brute = await appeler_llm_vision(
            image_base64=image_base64,
            prompt=PROMPT_EXTRACTION_VLM,
            modele="qwen2-vl:2b",  # ← Modèle léger pour VPS 3.7 Go RAM
        )
        
        if not reponse_brute:
            journal.warning("VLM : Réponse vide")
            return None
        
        # Parser la réponse JSON
        donnees = _parser_reponse_json(reponse_brute)
        
        if donnees:
            journal.info(
                f"VLM : Extraction réussie - type={donnees.get('type_document')}, "
                f"nom={donnees.get('nom_famille')}, confiance={donnees.get('confiance_extraction', 0)*100:.1f}%"
            )
        
        return donnees
        
    except Exception as e:
        journal.error(f"VLM : Erreur extraction - {e}")
        return None


def _parser_reponse_json(reponse_brute: str) -> Optional[Dict[str, Any]]:
    """Parse la réponse JSON du VLM en gérant les formats variés."""
    import json
    
    if not reponse_brute:
        return None
    
    reponse_propre = reponse_brute.strip()
    
    # Retirer les balises markdown ```json ... ```
    if reponse_propre.startswith("```"):
        lignes = reponse_propre.split("\n")
        if lignes[0].startswith("```"):
            lignes = lignes[1:]
        if lignes and lignes[-1].strip() == "```":
            lignes = lignes[:-1]
        reponse_propre = "\n".join(lignes).strip()
    
    # Trouver le JSON entre accolades
    premier_accolade = reponse_propre.find("{")
    dernier_accolade = reponse_propre.rfind("}")
    
    if premier_accolade != -1 and dernier_accolade != -1:
        reponse_propre = reponse_propre[premier_accolade:dernier_accolade+1]
    
    try:
        return json.loads(reponse_propre)
    except json.JSONDecodeError as e:
        journal.error(f"VLM : JSON invalide - {e}")
        journal.debug(f"Réponse brute : {reponse_brute[:500]}")
        return None