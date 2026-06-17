# -*- coding: utf-8 -*-
"""Schémas Pydantic du module scoring."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


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
    """Reponse listant l'historique des scores d'un utilisateur."""
    historique: list[HistoriqueScore]
    nombre_points: int


# ============================================================================
# Evaluation contextuelle (score asymetrique par cas d'usage)
# ============================================================================

class DemandeEvaluationContextuelle(BaseModel):
    """
    Requete d'evaluation contextuelle du score.

    Permet de verifier si un utilisateur est eligible pour un cas d'usage
    specifique sans exposer le score brut.

    Cette API transforme le projet de "systeme d'identite"
    en "infrastructure de decision", beaucoup plus vendable aux institutions.
    """
    digiid: str = Field(
        ...,
        min_length=8,
        max_length=50,
        description="DigiID public de l'utilisateur a evaluer",
        examples=["DIGIID-A1B2C3D4"],
    )
    contexte: str = Field(
        ...,
        description="Contexte de la demande",
        examples=["acces_credit", "aide_humanitaire", "verification_identite", "location_vehicule"],
    )
    montant_estime: Optional[float] = Field(
        default=None,
        ge=0,
        description="Montant estime (ex: montant du credit), permet d'affiner le seuil",
    )


class SeuilContexte(BaseModel):
    """Seuil requis et description pour un contexte donne."""
    contexte: str
    libelle: str
    seuil_requis: int
    score_utilisateur: int
    eligible: bool
    message: str


class ResultatEvaluationContextuelle(BaseModel):
    """
    Reponse a une demande d'evaluation contextuelle.

    Exemple:
      {
        "digiid": "DIGIID-A1B2C3D4",
        "score": 45,
        "contextes": [
          {
            "contexte": "acces_credit",
            "libelle": "Acces au microcredit",
            "seuil_requis": 65,
            "score_utilisateur": 45,
            "eligible": false,
            "message": "Score insuffisant pour un microcredit. Seuil requis : 65/100."
          },
          {
            "contexte": "aide_humanitaire",
            "libelle": "Aide humanitaire ONG",
            "seuil_requis": 30,
            "score_utilisateur": 45,
            "eligible": true,
            "message": "Eligible a l'aide humanitaire."
          }
        ]
      }
    """
    digiid: str
    score: int
    contextes: list[SeuilContexte]
