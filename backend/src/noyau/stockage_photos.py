# -*- coding: utf-8 -*-
"""
Stockage local des photos d'identité (visage selfie + photo de la CNI).

Rôle :
  - Écrit les photos (selfie approuvé, image recto de la CNI) sur disque.
  - Retrouve la photo la plus récente d'un utilisateur pour le contrôle
    visuel effectué par les agents de police.
  - Sert de source de vérité pour l'URL /api/v1/police/photo/{id}.

⚠️ Sécurité : ces photos sont des données personnelles sensibles. Elles ne
doivent JAMAIS être exposées publiquement — uniquement servies via l'endpoint
protégé par JWT + vérification de rôle (police) côté backend.
"""
import os
import uuid
from pathlib import Path
from typing import Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import parametres

# URL de l'endpoint police qui sert les photos (relatif → proxifié par Next.js)
_URL_ENDPOINT_PHOTO = "/api/v1/police/photo/"


def _dossier_photos() -> Path:
    """Retourne le dossier des photos (créé si besoin)."""
    base = Path(parametres.dossier_medias)
    dossier = base / "photos"
    dossier.mkdir(parents=True, exist_ok=True)
    return dossier


def _extension(type_mime: Optional[str]) -> str:
    mapping = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/tiff": ".tiff",
    }
    return mapping.get(type_mime or "", ".jpg")


def stocker_photo(
    contenu: bytes,
    prefixe: str,
    type_mime: Optional[str] = None,
) -> str:
    """Écrit une photo sur disque et retourne le chemin relatif au dossier media."""
    nom = f"{prefixe}_{uuid.uuid4().hex}{_extension(type_mime)}"
    chemin = _dossier_photos() / nom
    chemin.write_bytes(contenu)
    return str(chemin.relative_to(Path(parametres.dossier_medias)))


def chemin_absolu(chemin_relatif: Optional[str]) -> Optional[Path]:
    """Convertit un chemin relatif en chemin absolu (None si absent du disque)."""
    if not chemin_relatif:
        return None
    chemin = Path(parametres.dossier_medias) / chemin_relatif
    return chemin if chemin.exists() else None


def supprimer_photo(chemin_relatif: Optional[str]) -> None:
    """Supprime une photo du disque (silencieuse si absente)."""
    chemin = chemin_absolu(chemin_relatif)
    if chemin:
        try:
            chemin.unlink(missing_ok=True)
        except OSError:
            pass


async def trouver_photo_utilisateur(
    session: AsyncSession,
    utilisateur_id,
) -> Optional[Path]:
    """
    Retrouve la photo la plus récente d'un utilisateur, dans cet ordre :
      1. Selfie approuvé de la vérification visuelle (le plus fiable)
      2. Photo du recto de la CNI validée
    Retourne le chemin absolu du fichier, ou None si aucune photo stockée.
    """
    from src.modeles.verification_visuelle import VerificationVisuelle
    from src.modeles.verification_cni import VerificationCNI

    # 1. Selfie approuvé le plus récent
    resultat = await session.execute(
        select(VerificationVisuelle)
        .where(
            VerificationVisuelle.utilisateur_id == utilisateur_id,
            VerificationVisuelle.statut == "approuve",
            VerificationVisuelle.photo_chemin.isnot(None),
            VerificationVisuelle.est_supprime == False,
        )
        .order_by(desc(VerificationVisuelle.cree_le))
        .limit(1)
    )
    visuelle = resultat.scalar_one_or_none()
    if visuelle:
        chemin = chemin_absolu(visuelle.photo_chemin)
        if chemin:
            return chemin

    # 2. Recto CNI validé le plus récent
    resultat = await session.execute(
        select(VerificationCNI)
        .where(
            VerificationCNI.utilisateur_id == utilisateur_id,
            VerificationCNI.face == "recto",
            VerificationCNI.est_valide == True,
            VerificationCNI.photo_chemin.isnot(None),
            VerificationCNI.est_supprime == False,
        )
        .order_by(desc(VerificationCNI.date_traitement))
        .limit(1)
    )
    cni = resultat.scalar_one_or_none()
    if cni:
        chemin = chemin_absolu(cni.photo_chemin)
        if chemin:
            return chemin

    return None


async def photo_url_utilisateur(
    session: AsyncSession,
    utilisateur_id,
) -> Optional[str]:
    """
    Retourne l'URL (relative, proxifiée) de la photo de la personne
    si elle est disponible, sinon None. À utiliser dans les réponses
    destinées à la police.
    """
    chemin = await trouver_photo_utilisateur(session, utilisateur_id)
    if chemin is None:
        return None
    return f"{_URL_ENDPOINT_PHOTO}{utilisateur_id}"
