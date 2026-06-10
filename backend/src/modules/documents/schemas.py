# -*- coding: utf-8 -*-
"""Schémas Pydantic du module documents."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DocumentDetail(BaseModel):
    """Représentation d'un document dans l'API (sans le contenu complet)."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nom_fichier: str
    type_mime: str
    taille_octets: int
    resume: str | None
    cree_le: datetime


class ListeDocuments(BaseModel):
    """Réponse listant les documents d'un utilisateur."""
    documents: list[DocumentDetail]
    total: int
    taille_totale_octets: int
