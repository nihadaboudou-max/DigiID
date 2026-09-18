# -*- coding: utf-8 -*-
"""Adaptateur CNI : enveloppe le service ocr_cni dans la réponse unifiée."""
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Utilisateur
from src.modules.inspection_documents.adaptateurs.commun import reponse_unifiee
from src.modules.ocr_cni import service as cni_service
from src.noyau.exceptions import ErreurDigiID


async def adapter_cni(
    session: AsyncSession,
    utilisateur: Utilisateur,
    fichier,
    *,
    face: str = "recto",
    contexte: str = "citoyen",
    enrolement_id: Optional[UUID] = None,
    utilisateur_cible_id: Optional[UUID] = None,
) -> Dict[str, Any]:
    """Extrait une CNI via ocr_cni et renvoie la réponse unifiée."""
    try:
        resultat = await cni_service.traiter_upload_cni(
            session=session,
            utilisateur=utilisateur,
            fichier=fichier,
            face=face,
            contexte=contexte,
            enrolement_id=enrolement_id,
        )
    except ErreurDigiID as e:
        return reponse_unifiee(
            "cni_biometrique", statut="rejete",
            message=e.message_utilisateur or str(e),
        )

    ocr = resultat.get("resultat_ocr", {}) or {}
    d = ocr.get("donnees")
    donnees = {
        "nom_famille": getattr(d, "nom_famille", None),
        "prenoms": getattr(d, "prenoms", None),
        "date_naissance": getattr(d, "date_naissance", None),
        "sexe": getattr(d, "sexe", None),
        "numero_document": getattr(d, "numero_cni", None),
        "date_delivrance": getattr(d, "date_delivrance", None),
        "date_expiration": getattr(d, "date_expiration", None),
        "lieu_naissance": getattr(d, "lieu_naissance", None),
        "autorite_delivrance": getattr(d, "autorite_delivrance", None),
        "taille": getattr(d, "taille", None),
    }
    return reponse_unifiee(
        "cni_biometrique",
        identifiant=resultat.get("id"),
        statut=resultat.get("statut", "en_attente"),
        donnees=donnees,
        message=resultat.get("message", ""),
        champs_extraits=ocr.get("champs_extraits", 0),
        texte_brut=getattr(d, "texte_brut", "") or "",
        temps_ms=ocr.get("temps_analyse_ms", 0),
    )
