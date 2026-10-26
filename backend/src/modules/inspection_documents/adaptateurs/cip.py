# -*- coding: utf-8 -*-
"""Adaptateur CIP : enveloppe ocr_cip dans la réponse unifiée."""
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Utilisateur
from src.modules.inspection_documents.adaptateurs.commun import reponse_unifiee
from src.modules.ocr_cip import service as cip_service
from src.noyau.exceptions import ErreurDigiID


async def adapter_cip(
    session: AsyncSession,
    utilisateur: Utilisateur,
    fichier,
    *,
    face: str = "recto",
    contexte: str = "citoyen",
    enrolement_id: Optional[UUID] = None,
    utilisateur_cible_id: Optional[UUID] = None,
) -> Dict[str, Any]:
    """Extrait un CIP et renvoie la réponse unifiée (NPI = numero_document)."""
    try:
        reponse = await cip_service.traiter_upload_cip(
            session=session, utilisateur=utilisateur, fichier=fichier,
        )
    except ErreurDigiID as e:
        return reponse_unifiee(
            "cip", statut="rejete",
            message=e.message_utilisateur or str(e),
        )

    ocr = getattr(reponse, "resultat_ocr", None)
    d = getattr(ocr, "donnees", None)
    donnees = d.model_dump(exclude={"texte_brut", "taux_confiance_moyen"}) if d else {}
    # Garantir l'alias unifié : le numéro de pièce EST le NPI.
    if donnees.get("npi") and not donnees.get("numero_document"):
        donnees["numero_document"] = donnees["npi"]

    return reponse_unifiee(
        "cip",
        identifiant=getattr(reponse, "id", None),
        statut=str(getattr(reponse, "statut", "en_attente")),
        donnees=donnees,
        message=getattr(reponse, "message", ""),
        champs_extraits=getattr(ocr, "champs_extraits", 0),
        texte_brut=getattr(d, "texte_brut", "") or "",
        temps_ms=getattr(ocr, "temps_analyse_ms", 0),
    )
