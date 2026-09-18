# -*- coding: utf-8 -*-
"""Helpers communs aux adaptateurs de l'interface unique d'extraction."""
from typing import Any, Dict, Optional

ZERO_UUID = "00000000-0000-0000-0000-000000000000"


def reponse_unifiee(
    type_document: str,
    identifiant: Any = ZERO_UUID,
    statut: str = "en_attente",
    donnees: Optional[Dict[str, Any]] = None,
    message: str = "",
    champs_extraits: int = 0,
    texte_brut: str = "",
    temps_ms: int = 0,
) -> Dict[str, Any]:
    """Construit la réponse unifiée, identique pour les 6 documents."""
    return {
        "type_document": str(type_document),
        "identifiant": str(identifiant) if identifiant else ZERO_UUID,
        "statut": statut,
        "donnees": {k: v for k, v in (donnees or {}).items() if v is not None},
        "message": message or "",
        "champs_extraits": int(champs_extraits or 0),
        "texte_brut": (texte_brut or "")[:5000],
        "temps_ms": int(temps_ms or 0),
    }
