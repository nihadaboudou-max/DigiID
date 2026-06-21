# -*- coding: utf-8 -*-
"""
Extraction de texte depuis différents formats de documents.

Phase 3 — formats supportés :
  - PDF (via pypdf)
  - TXT (lecture directe)
  - Markdown (lecture directe)

Phase 4 — formats à ajouter :
  - DOCX (python-docx)
  - DOC (LibreOffice)
  - Images avec OCR (pytesseract)
"""
import io
from typing import Tuple

from fastapi import UploadFile

from src.noyau.exceptions import ErreurValidation
from src.noyau import journal


# Limite : 5 Mo par document
TAILLE_MAX_OCTETS = 5 * 1024 * 1024

# Types MIME acceptés
TYPES_MIME_AUTORISES = {
    "application/pdf": "pdf",
    "text/plain": "txt",
    "text/markdown": "md",
}


async def extraire_texte_depuis_upload(
    fichier: UploadFile,
) -> Tuple[str, str, int]:
    """
    Extrait le texte d'un fichier uploadé.

    Arguments :
        fichier : objet UploadFile de FastAPI

    Retour :
        (contenu_texte, type_mime, taille_octets)

    Lève :
        ErreurValidation si le format est non supporté ou le fichier trop gros.
    """
    # Vérifier le type MIME
    type_mime = fichier.content_type or "application/octet-stream"
    if type_mime not in TYPES_MIME_AUTORISES:
        raise ErreurValidation(
            f"Type MIME refusé : {type_mime}",
            message_utilisateur=(
                "Format de fichier non supporté. Tu peux uploader des PDF, des fichiers texte (.txt) "
                "ou Markdown (.md)."
            ),
        )

    # Lire le contenu en mémoire
    try:
        contenu_bytes = await fichier.read()
    except Exception as e:
        journal.error(f"Erreur lecture fichier : {e}")
        raise ErreurValidation(
            f"Impossible de lire le fichier : {e}",
            message_utilisateur="Erreur lors de la lecture du fichier. Réessaie.",
        )
    
    taille = len(contenu_bytes)

    # Vérifier la taille
    if taille > TAILLE_MAX_OCTETS:
        raise ErreurValidation(
            f"Fichier trop gros : {taille} octets",
            message_utilisateur=(
                f"Ce fichier dépasse la taille maximale autorisée ({TAILLE_MAX_OCTETS // 1024 // 1024} Mo)."
            ),
        )

    # Extraire le texte selon le format
    extension = TYPES_MIME_AUTORISES[type_mime]

    # ========================================================================
    # 📄 EXTRACTION PDF
    # ========================================================================
    if extension == "pdf":
        contenu_texte = _extraire_pdf(contenu_bytes)
    
    # ========================================================================
    # 📝 EXTRACTION TXT / MARKDOWN
    # ========================================================================
    elif extension in ("txt", "md"):
        # Décoder en UTF-8 (standard), ou latin-1 en fallback
        try:
            contenu_texte = contenu_bytes.decode("utf-8")
        except UnicodeDecodeError:
            # Fallback : latin-1 accepte tous les bytes (jamais d'erreur)
            contenu_texte = contenu_bytes.decode("latin-1", errors="replace")
            journal.warning(f"Fichier {fichier.filename} décodé en latin-1 (UTF-8 invalide)")
    else:
        raise ErreurValidation(
            f"Extension non gérée : {extension}",
            message_utilisateur="Format interne non géré.",
        )

    # Vérifier que le contenu n'est pas vide
    if not contenu_texte.strip():
        raise ErreurValidation(
            "Document vide après extraction",
            message_utilisateur="Le fichier semble vide ou son texte n'a pas pu être extrait. Si c'est un PDF scanné (image), le texte ne peut pas être extrait automatiquement.",
        )

    return contenu_texte, type_mime, taille


def _extraire_pdf(contenu_bytes: bytes) -> str:
    """Extrait le texte d'un PDF avec pypdf."""
    # Import dynamique pour ne charger pypdf que si besoin
    try:
        from pypdf import PdfReader
    except ImportError:
        # Si pypdf n'est pas installé, on tombe sur une erreur claire
        raise ErreurValidation(
            "pypdf n'est pas installé",
            message_utilisateur="Le serveur ne peut pas lire les PDF pour l'instant.",
        )

    # Gestion des erreurs PDF (corrompu, chiffré, malformé)
    try:
        reader = PdfReader(io.BytesIO(contenu_bytes))
    except Exception as e:
        journal.error(f"Erreur lecture PDF : {e}")
        raise ErreurValidation(
            f"Impossible de lire le PDF : {e}",
            message_utilisateur="Le PDF est peut-être corrompu, chiffré ou dans un format non supporté. Essaie un autre fichier.",
        )

    # Vérifier si le PDF est chiffré
    if reader.is_encrypted:
        raise ErreurValidation(
            "PDF chiffré",
            message_utilisateur="Ce PDF est protégé par un mot de passe. Retire la protection avant de l'uploader.",
        )

    # Extraire le texte de chaque page
    pages_texte = []
    for i, page in enumerate(reader.pages):
        try:
            texte = page.extract_text() or ""
            pages_texte.append(texte)
        except Exception as e:
            journal.warning(f"Erreur extraction page {i} : {e}")
            # Continuer avec les autres pages
            continue

    return "\n\n".join(pages_texte)
