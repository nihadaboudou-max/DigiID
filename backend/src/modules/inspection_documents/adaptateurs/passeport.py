
# -*- coding: utf-8 -*-
"""Adaptateur Passeport : enveloppe le module `ocr_passeport` dans la réponse unifiée."""
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Utilisateur
from src.modules.inspection_documents.adaptateurs.commun import reponse_unifiee
from src.modules.ocr_passeport import service as passeport_service
from src.noyau.exceptions import ErreurDigiID


async def adapter_passeport(
    session: AsyncSession,
    utilisateur: Utilisateur,
    fichier,
    *,
    face: str = "recto",
    contexte: str = "citoyen",
    enrolement_id: Optional[UUID] = None,
    utilisateur_cible_id: Optional[UUID] = None,
) -> Dict[str, Any]:
    """Extrait un passeport via ocr_passeport et renvoie la réponse unifiée.

    Le passeport est lu principalement via sa MRZ (`P<`, format TD3), gérée par
    le module dédié `ocr_passeport`.
    """
    try:
        reponse = await passeport_service.traiter_upload_passeport(
            session=session,
            utilisateur=utilisateur,
            fichier=fichier,
            face=face,
        )
    except ErreurDigiID as e:
        return reponse_unifiee(
            "passeport", statut="rejete",
            message=e.message_utilisateur or str(e),
        )

    ocr = getattr(reponse, "resultat_ocr", None)
    d = getattr(ocr, "donnees", None)
    donnees = {
        "nom_famille": getattr(d, "nom_famille", None),
        "prenoms": getattr(d, "prenoms", None),
        "date_naissance": getattr(d, "date_naissance", None),
        "sexe": getattr(d, "sexe", None),
        "numero_passeport": getattr(d, "numero_passeport", None),
        "numero_document": getattr(d, "numero_passeport", None),
        "type_passeport": getattr(d, "type_passeport", None),
        "date_delivrance": getattr(d, "date_delivrance", None),
        "date_expiration": getattr(d, "date_expiration", None),
        "lieu_naissance": getattr(d, "lieu_naissance", None),
        "autorite_delivrance": getattr(d, "autorite_delivrance", None),
        "nationalite": getattr(d, "nationalite", None),
        "pays_emetteur": getattr(d, "pays_emetteur", None),
        "mrz_valide": getattr(d, "mrz_valide", None),
    }

    return reponse_unifiee(
        "passeport",
        identifiant=getattr(reponse, "id", None),
        statut=str(getattr(reponse, "statut", "en_attente")),
        donnees=donnees,
        message=getattr(reponse, "message", ""),
        champs_extraits=getattr(ocr, "champs_extraits", 0),
        texte_brut=getattr(d, "texte_brut", "") or "",
        temps_ms=getattr(ocr, "temps_analyse_ms", 0),
    )
