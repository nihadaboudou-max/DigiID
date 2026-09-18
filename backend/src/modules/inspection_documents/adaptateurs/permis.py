# -*- coding: utf-8 -*-
"""Adaptateur Permis de conduire : enveloppe ocr_permis dans la réponse unifiée."""
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Utilisateur
from src.modules.inspection_documents.adaptateurs.commun import reponse_unifiee
from src.modules.ocr_permis import service as permis_service
from src.noyau.exceptions import ErreurDigiID


async def adapter_permis(
    session: AsyncSession,
    utilisateur: Utilisateur,
    fichier,
    *,
    face: str = "recto",
    contexte: str = "citoyen",
    enrolement_id: Optional[UUID] = None,
    utilisateur_cible_id: Optional[UUID] = None,
) -> Dict[str, Any]:
    """Extrait un permis de conduire via ocr_permis et renvoie la réponse unifiée."""
    try:
        reponse = await permis_service.traiter_upload_permis(
            session=session, utilisateur=utilisateur, fichier=fichier, face=face,
        )
    except ErreurDigiID as e:
        return reponse_unifiee(
            "permis_conduire", statut="rejete",
            message=e.message_utilisateur or str(e),
        )

    ocr = getattr(reponse, "resultat_ocr", None)
    d = getattr(ocr, "donnees", None)
    donnees = {
        "nom_famille": getattr(d, "nom_famille", None),
        "prenoms": getattr(d, "prenoms", None),
        "date_naissance": getattr(d, "date_naissance", None),
        "lieu_naissance": getattr(d, "lieu_naissance", None),
        "numero_document": getattr(d, "numero_permis", None),
        "categories": getattr(d, "categories", None) or getattr(d, "categories_permis", None),
        "date_delivrance": getattr(d, "date_delivrance", None) or getattr(d, "date_premiere_delivrance", None),
        "date_expiration": getattr(d, "date_expiration", None),
    }
    return reponse_unifiee(
        "permis_conduire",
        identifiant=getattr(reponse, "id", None),
        statut=str(getattr(reponse, "statut", "en_attente")),
        donnees=donnees,
        message=getattr(reponse, "message", ""),
        champs_extraits=getattr(ocr, "champs_extraits", 0),
        texte_brut=getattr(d, "texte_brut", "") or "",
        temps_ms=getattr(ocr, "temps_analyse_ms", 0),
    )
