# -*- coding: utf-8 -*-
"""Adaptateur Assurance auto : enveloppe ocr_assurance dans la réponse unifiée."""
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Utilisateur
from src.modules.inspection_documents.adaptateurs.commun import reponse_unifiee
from src.modules.ocr_assurance import service as assurance_service
from src.noyau.exceptions import ErreurDigiID


async def adapter_assurance(
    session: AsyncSession,
    utilisateur: Utilisateur,
    fichier,
    *,
    face: str = "recto",
    contexte: str = "citoyen",
    enrolement_id: Optional[UUID] = None,
    utilisateur_cible_id: Optional[UUID] = None,
) -> Dict[str, Any]:
    """Extrait une attestation d'assurance via ocr_assurance et renvoie la réponse unifiée."""
    try:
        reponse = await assurance_service.traiter_upload_assurance(
            session=session, utilisateur=utilisateur, fichier=fichier,
        )
    except ErreurDigiID as e:
        return reponse_unifiee(
            "carte_assurance", statut="rejete",
            message=e.message_utilisateur or str(e),
        )

    ocr = getattr(reponse, "resultat_ocr", None)
    d = getattr(ocr, "donnees", None)
    donnees = {
        "nom_famille": getattr(d, "nom_assure", None),
        "prenoms": getattr(d, "prenoms_assure", None),
        "numero_document": getattr(d, "numero_contrat", None),
        "compagnie_assurance": getattr(d, "compagnie_assurance", None),
        "immatriculation": getattr(d, "immatriculation_vehicule", None),
        "marque_vehicule": getattr(d, "marque_vehicule", None),
        "modele_vehicule": getattr(d, "modele_vehicule", None),
        "date_effet": getattr(d, "date_effet", None),
        "date_expiration": getattr(d, "date_expiration", None),
    }
    return reponse_unifiee(
        "carte_assurance",
        identifiant=getattr(reponse, "id", None),
        statut=str(getattr(reponse, "statut", "en_attente")),
        donnees=donnees,
        message=getattr(reponse, "message", ""),
        champs_extraits=getattr(ocr, "champs_extraits", 0),
        texte_brut=getattr(d, "texte_brut", "") or "",
        temps_ms=getattr(ocr, "temps_analyse_ms", 0),
    )
