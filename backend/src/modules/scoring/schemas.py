# -*- coding: utf-8 -*-
"""Schémas Pydantic du module scoring."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class FacteurScore(BaseModel):
    """Un facteur explicatif du score, avec sa contribution."""
    nom: str
    libelle: str
    valeur: float          # Contribution effective (ex : 24 sur 25 max)
    poids_maximum: float   # Poids théorique maximum (ex : 25 pour SIM)
    pourcentage_utilisation: float  # % du poids effectivement utilisé


class ScoreDetail(BaseModel):
    """Détail complet du score actuel d'un utilisateur."""
    model_config = ConfigDict(from_attributes=True)

    utilisateur_id: UUID
    score_total: int
    niveau: str  # "Faible" | "Moyen" | "Élevé"
    interpretation: str
    facteurs: list[FacteurScore]
    methode: str
    date_calcul: datetime
    prochaine_mise_a_jour: Optional[datetime] = None


class HistoriqueScore(BaseModel):
    """Point d'historique du score d'un utilisateur."""
    model_config = ConfigDict(from_attributes=True)

    date_calcul: datetime
    score_total: int
    methode: str


class ListeHistoriqueScore(BaseModel):
    """Réponse listant l'historique des scores d'un utilisateur."""
    historique: list[HistoriqueScore]
    nombre_points: int
