# -*- coding: utf-8 -*-
"""
Extracteur VLM (Vision Language Model) pour documents d'identité.
Remplace Tesseract + Regex par un seul appel à Ollama (qwen2-vl).
"""
import base64
import json
from typing import Optional
from src.modules.chatbot.fournisseur_llm import appeler_llm_vision
from src.noyau.journal import journal

PROMPT_EXTRACTION = """
Tu es un expert en extraction de données de documents d'identité africains et internationaux.

Analyse cette image et extrais les informations suivantes au format JSON STRICT :
{
  "est_document_identite": true/false,
  "type_document": "cni|passeport|permis_conduire|carte_sejour|assurance|autre",
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
- Si ce n'est PAS un document d'identité (ex: facture, photo, document non-officiel), mets "est_document_identite": false et tous les autres champs à null.
- Ne JAMAIS inventer de données. Si un champ n'est pas visible, mets null.
- Pour la MRZ (zone en bas avec des <<<), extrais les 3 lignes exactes.
- Réponds UNIQUEMENT le JSON, rien d'autre. Pas de markdown, pas de commentaire.
"""

async def extraire_document_vlm(image_bytes: bytes) -> dict:
    """
    Extrait les données d'un document d'identité via VLM (Ollama).
    Retourne un dict structuré ou None si rejeté.
    """
    # Convertir l'image en base64
    image_base64 = base64.b64encode(image_bytes).decode("utf-8")
    
    try:
        # Appeler le VLM
        reponse_brute = await appeler_llm_vision(
            image_base64=image_base64,
            prompt=PROMPT_EXTRACTION,
            modele="qwen2-vl:7b",
        )
        
        # Parser le JSON (le VLM peut ajouter des ```json ... ```)
        reponse_propre = reponse_brute.strip()
        if reponse_propre.startswith("```"):
            reponse_propre = reponse_propre.split("```")[1]
            if reponse_propre.startswith("json"):
                reponse_propre = reponse_propre[4:]
        reponse_propre = reponse_propre.strip()
        
        donnees = json.loads(reponse_propre)
        
        # Vérifier si c'est un document d'identité
        if not donnees.get("est_document_identite", False):
            journal.info("VLM : Document rejeté (non-identité)")
            return None
        
        journal.info(
            f"VLM : Document extrait - type={donnees.get('type_document')}, "
            f"pays={donnees.get('pays')}, confiance={donnees.get('confiance_extraction')}"
        )
        
        return donnees
        
    except json.JSONDecodeError as e:
        journal.error(f"VLM : JSON invalide - {e} - Réponse brute : {reponse_brute[:200]}")
        return None
    except Exception as e:
        journal.error(f"VLM : Erreur extraction - {e}")
        return None