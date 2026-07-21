# -*- coding: utf-8 -*-
"""Schémas Pydantic pour la recherche faciale médicale."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class PersonneRecherchee(BaseModel):
    """Données de la personne trouvée par reconnaissance faciale."""
    id: str
    nom: str
    prenom: Optional[str] = None
    date_naissance: Optional[str] = None
    groupe_sanguin: Optional[str] = None
    telephone: Optional[str] = None
    contact_urgence: Optional[str] = None
    photo: Optional[str] = None
    antecedents: list[str] = []
    allergies: list[str] = []
    digiid: Optional[str] = None


class ResultatRechercheFaciale(BaseModel):
    """Réponse d'une recherche faciale."""
    trouve: bool
    personne: Optional[PersonneRecherchee] = None
    score_confiance: float = Field(..., ge=0.0, le=100.0)
    temps_analyse_ms: int = Field(..., ge=0)
    mode_developpement: bool = Field(
        default=False,
        description="⚠️ True = la reconnaissance faciale n'est pas encore implémentée. "
                    "Le résultat est un placeholder de développement.",
    )


class HistoriqueRechercheItem(BaseModel):
    """Un élément de l'historique des recherches faciales."""
    id: UUID
    date_recherche: datetime
    score_confiance: float
    personne_trouvee_id: Optional[UUID] = None


class ListeRecherchesFaciales(BaseModel):
    """Liste paginée de l'historique des recherches faciales."""
    historique: list[HistoriqueRechercheItem]
    total: int
