# -*- coding: utf-8 -*-
"""Stockage privé des photos jointes aux colis."""
from io import BytesIO
from pathlib import Path
import uuid

from PIL import Image, ImageOps, UnidentifiedImageError

from src.config import parametres

TAILLE_MAX_PHOTO = 5 * 1024 * 1024
PIXELS_MAX_PHOTO = 20_000_000


def stocker_photo_colis(contenu: bytes) -> str:
    """Réencode une image acceptée en JPEG sans métadonnées EXIF."""
    try:
        with Image.open(BytesIO(contenu)) as image:
            if image.format not in {"JPEG", "PNG", "WEBP"}:
                raise ValueError("Format non pris en charge. Utilisez JPEG, PNG ou WebP.")
            if image.width * image.height > PIXELS_MAX_PHOTO:
                raise ValueError("L'image est trop grande.")
            image.verify()
        with Image.open(BytesIO(contenu)) as image:
            image = ImageOps.exif_transpose(image)
            image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
            if "A" in image.getbands():
                fond = Image.new("RGB", image.size, "white")
                fond.paste(image.convert("RGBA"), mask=image.convert("RGBA").getchannel("A"))
                image = fond
            else:
                image = image.convert("RGB")
            sortie = BytesIO()
            image.save(sortie, format="JPEG", quality=85, optimize=True)
    except Image.DecompressionBombError as erreur:
        raise ValueError("L'image dépasse la taille maximale autorisée.") from erreur
    except (UnidentifiedImageError, OSError) as erreur:
        raise ValueError("Le fichier envoyé n'est pas une image valide.") from erreur

    base = Path(parametres.dossier_medias)
    dossier = base / "colis"
    dossier.mkdir(parents=True, exist_ok=True)
    chemin = dossier / f"{uuid.uuid4().hex}.jpg"
    chemin.write_bytes(sortie.getvalue())
    return str(chemin.relative_to(base))


def chemin_photo_colis(chemin_relatif: str | None) -> Path | None:
    if not chemin_relatif:
        return None
    base = Path(parametres.dossier_medias).resolve()
    chemin = (base / chemin_relatif).resolve()
    if not chemin.is_relative_to(base):
        return None
    return chemin if chemin.is_file() else None


def supprimer_photo_colis(chemin_relatif: str | None) -> bool:
    """Supprime une photo stockée ; retourne False si le fichier était absent."""
    chemin = chemin_photo_colis(chemin_relatif)
    if chemin is None:
        return False
    chemin.unlink(missing_ok=True)
    return True
