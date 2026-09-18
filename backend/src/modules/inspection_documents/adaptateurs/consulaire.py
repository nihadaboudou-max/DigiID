# -*- coding: utf-8 -*-
"""Adaptateur Consulaire : enveloppe ocr_consulaire dans la réponse unifiée."""
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Utilisateur
from src.modules.inspection_documents.adaptateurs.commun import reponse_unifiee
from src.modules.ocr_consulaire import service as consulaire_service
from src.noyau.exceptions import ErreurDigiID


async def adapter_consulaire(
    session: AsyncSession,
    utilisateur: Utilisateur,
    fichier,
    *,
    face: str = "recto",
    contexte: str = "citoyen",
    enrolement_id: Optional[UUID] = None,
    utilisateur_cible_id: Optional[UUID] = None,
) -> Dict[str, Any]:
    """Extrait une carte d'immatriculation consulaire et renvoie la réponse unifiée."""
    try:
        reponse = await consulaire_service.traiter_upload_consulaire(
            session=session, utilisateur=utilisateur, fichier=fichier,
        )
    except ErreurDigiID as e:
        return reponse_unifiee(
            "carte_consulaire", statut="rejete",
            message=e.message_utilisateur or str(e),
        )

    ocr = getattr(reponse, "resultat_ocr", None)
    d = getattr(ocr, "donnees", None)
    donnees = d.model_dump(exclude={"texte_brut", "taux_confiance_moyen"}) if d else {}
    return reponse_unifiee(
        "carte_consulaire",
        identifiant=getattr(reponse, "id", None),
        statut=str(getattr(reponse, "statut", "en_attente")),
        donnees=donnees,
        message=getattr(reponse, "message", ""),
        champs_extraits=getattr(ocr, "champs_extraits", 0),
        texte_brut=getattr(d, "texte_brut", "") or "",
        temps_ms=getattr(ocr, "temps_analyse_ms", 0),
    )
