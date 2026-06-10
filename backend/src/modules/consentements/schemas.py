# -*- coding: utf-8 -*-
"""Schémas Pydantic du module consentements."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ConsentementDetail(BaseModel):
    """Représentation complète d'un consentement pour un utilisateur."""
    model_config = ConfigDict(from_attributes=True)

    categorie: str
    titre: str
    description: str
    obligatoire: bool
    version: str

    est_accorde: bool
    date_accord: Optional[datetime] = None
    date_retrait: Optional[datetime] = None


class ConsentementTexteLegalDetail(ConsentementDetail):
    """Détail avec le texte légal complet — pour la modale de lecture."""
    texte_legal: str


class ConsentementBascule(BaseModel):
    """Requête de bascule d'un consentement."""
    accorder: bool


class ListeConsentements(BaseModel):
    """Réponse listant tous les consentements de l'utilisateur."""
    consentements: list[ConsentementDetail]
    total: int
    accordes: int
