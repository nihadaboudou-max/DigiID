
# -*- coding: utf-8 -*-
"""Adaptateur Passeport : enveloppe le pipeline générique (MRZ `P<`) dans la réponse unifiée."""
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Utilisateur
from src.modules.inspection_documents.adaptateurs.commun import reponse_unifiee
from src.modules.inspection_documents import service as generique_service
from src.modules.inspection_documents.schemas import TypeDocument
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
    """Extrait un passeport via le pipeline générique et renvoie la réponse unifiée.

    Le passeport est lu principalement via sa MRZ (`P<`), gérée par le service
    universel d'inspection de documents.
    """
    try:
        reponse = await generique_service.traiter_upload_document(
            session=session,
            utilisateur=utilisateur,
            fichier=fichier,
            type_document=TypeDocument.PASSEPORT,
            face=face,
            utilisateur_cible_id=utilisateur_cible_id,
        )
    except ErreurDigiID as e:
        return reponse_unifiee(
            "passeport", statut="rejete",
            message=e.message_utilisateur or str(e),
        )

    d = reponse.donnees
    sexe = getattr(d, "sexe", None)
    donnees = {
        "nom_famille": getattr(d, "nom_famille", None),
        "prenoms": getattr(d, "prenoms", None),
        "date_naissance": getattr(d, "date_naissance", None),
        "sexe": getattr(sexe, "value", sexe),
        "numero_document": getattr(d, "numero_document", None),
        "date_delivrance": getattr(d, "date_delivrance", None),
        "date_expiration": getattr(d, "date_expiration", None),
        "lieu_naissance": getattr(d, "lieu_naissance", None),
        "autorite_delivrance": getattr(d, "autorite_delivrance", None),
        "nationalite": getattr(d, "nationalite", None),
        "pays_emetteur": getattr(d, "pays_emetteur", None),
        "mrz_valide": getattr(d, "mrz_valide", None),
    }
    champs_extraits = sum(1 for v in donnees.values() if v not in (None, "", [], {}))

    return reponse_unifiee(
        "passeport",
        identifiant=getattr(reponse, "id_verification", None),
        statut=str(getattr(reponse, "statut", "en_attente")),
        donnees=donnees,
        message=getattr(reponse, "message", ""),
        champs_extraits=champs_extraits,
        texte_brut=getattr(d, "texte_brut", "") or "",
        temps_ms=getattr(reponse, "temps_traitement_ms", 0),
    )
