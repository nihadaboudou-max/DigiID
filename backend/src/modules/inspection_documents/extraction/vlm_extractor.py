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
Tu es un expert en lecture de documents d'identité africains et internationaux (CNI, passeport, permis, assurance, carte de séjour).

Analyse l'image et réponds UNIQUEMENT par un objet JSON valide, sans texte autour, sans bloc markdown.

Schéma attendu :
{
  "est_document_identite": true ou false,
  "type_document": "cni_biometrique" | "cni_papier" | "passeport" | "permis_conduire" | "carte_assurance" | "carte_sejour" | "autre" | null,
  "pays": "code ICAO à 3 lettres (ex: SEN, CIV, MLI, GHA) ou null",
  "nom_famille": "texte ou null",
  "prenoms": "texte ou null",
  "date_naissance": "JJ/MM/AAAA ou null",
  "sexe": "M" | "F" | null,
  "numero_document": "texte ou null",
  "date_expiration": "JJ/MM/AAAA ou null",
  "date_delivrance": "JJ/MM/AAAA ou null",
  "nationalite": "texte ou null",
  "lieu_naissance": "texte ou null",
  "mrz_ligne_1": "texte ou null",
  "mrz_ligne_2": "texte ou null",
  "mrz_ligne_3": "texte ou null",
  "confiance_extraction": 0.0 a 1.0
}

REGLES DE TRANSCRIPTION DE LA MRZ (zone de caracteres '<<<') :
- La MRZ est la zone imprimee en machine-readable, composee de 2 ou 3 lignes.
- Recopie CHAQUE ligne ENTIERE et EXACTEMENT, caractere par caractere,
  y compris les chevrons '<' et les zeros, SANS reformater ni corriger.
- Si tu ne vois pas de MRZ, mets null pour mrz_ligne_1/mrz_ligne_2/mrz_ligne_3.
- Ne STOCKE JAMAIS le contenu d'un faux document : si tu as un doute sur un
  caractere (0/O, 1/I, 5/S), transcris ce que tu vois.

AUTRES REGLES STRICTES :
- Si ce n'est PAS un document d'identite officiel, mets "est_document_identite": false.
- Ne JAMAIS inventer. Si un champ n'est pas lisible, mets null.
- Toutes les dates doivent etre au format JJ/MM/AAAA (ex: 15/03/1987).
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
    """Parse la réponse JSON du VLM en gérant les formats variés."""
    if not reponse_brute:
        return None

    reponse_propre = reponse_brute.strip()

    if reponse_propre.startswith("```"):
        lignes = reponse_propre.split("\n")
        if lignes and lignes[0].startswith("```"):
            lignes = lignes[1:]
        if lignes and lignes[-1].strip() == "```":
            lignes = lignes[:-1]
        reponse_propre = "\n".join(lignes).strip()

    premier_accolade = reponse_propre.find("{")
    dernier_accolade = reponse_propre.rfind("}")
    if premier_accolade != -1 and dernier_accolade != -1:
        reponse_propre = reponse_propre[premier_accolade:dernier_accolade + 1]

    try:
        donnees = json.loads(reponse_propre)
        if not isinstance(donnees, dict):
            return None
        for cle in list(donnees.keys()):
            if donnees[cle] is None:
                continue
            if isinstance(donnees[cle], str):
                donnees[cle] = re.sub(r"\s+", " ", donnees[cle]).strip() or None
        return donnees
    except json.JSONDecodeError as e:
        journal.error(f"VLM : JSON invalide - {e}")
        journal.debug(f"Réponse brute : {reponse_brute[:800]}")
        return None