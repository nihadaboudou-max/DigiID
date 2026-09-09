# -*- coding: utf-8 -*-
"""
Extracteur VLM (Vision Language Model) pour les documents d'identité.

Le fournisseur et le modèle sont gérés par `src.modules.chatbot.fournisseur_llm` :
- Groq (production)  : qwen-3.6-27b (variable GROQ_MODELE_VISION)
- Ollama (développement) : qwen2-vl:2b (variable OLLAMA_MODELE_VISION)

L'image est normalisée en JPEG (RGB) avant l'envoi pour être compatible
avec tous les fournisseurs et limiter la taille du payload.
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


# Type MIME réel de l'image → le modèle vision l'accepte mieux en JPEG/PNG.
def _normaliser_image_jpeg(image_bytes: bytes) -> tuple[str, str]:
    """Convertit l'image en JPEG RGB et renvoie (mime_type, base64)."""
    try:
        from PIL import Image
        pil_image = Image.open(io.BytesIO(image_bytes))
        if pil_image.format and pil_image.format.upper() in ("JPEG", "JPG"):
            # Déjà du JPEG : on l'envoie tel quel (rapide, sans perte).
            return "image/jpeg", base64.b64encode(image_bytes).decode("utf-8")
        rgb = pil_image.convert("RGB")
        tampon = io.BytesIO()
        rgb.save(tampon, format="JPEG", quality=90)
        return "image/jpeg", base64.b64encode(tampon.getvalue()).decode("utf-8")
    except Exception as e:
        journal.warning(f"VLM : normalisation image impossible ({e}), envoi brut en JPEG.")
        return "image/jpeg", base64.b64encode(image_bytes).decode("utf-8")


async def extraire_donnees_vlm(image_bytes: bytes) -> Optional[Dict[str, Any]]:
    """
    Extrait les données d'un document via le VLM configuré (Groq ou Ollama).

    Args:
        image_bytes: L'image du document en bytes

    Returns:
        Dict avec les données extraites, ou None si échec.
    """
    try:
        mime_type, image_base64 = _normaliser_image_jpeg(image_bytes)

        reponse_brute = await appeler_llm_vision(
            image_base64=image_base64,
            prompt=PROMPT_EXTRACTION_VLM,
            modele="qwen2.5vl:3b",
            mime_type=mime_type,
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

    # Retirer les balises markdown ```json ... ```
    if reponse_propre.startswith("```"):
        lignes = reponse_propre.split("\n")
        if lignes and lignes[0].startswith("```"):
            lignes = lignes[1:]
        if lignes and lignes[-1].strip() == "```":
            lignes = lignes[:-1]
        reponse_propre = "\n".join(lignes).strip()

    # Trouver le JSON entre accolades (premier { … dernier })
    premier_accolade = reponse_propre.find("{")
    dernier_accolade = reponse_propre.rfind("}")
    if premier_accolade != -1 and dernier_accolade != -1:
        reponse_propre = reponse_propre[premier_accolade:dernier_accolade + 1]

    try:
        donnees = json.loads(reponse_propre)
        if not isinstance(donnees, dict):
            return None
        # Assainissement minimal des chaînes
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
