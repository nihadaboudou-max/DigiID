# -*- coding: utf-8 -*-
"""Schemas Pydantic du module gamification."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


# ============================================================================
# Badges
# ============================================================================

class BadgeDetail(BaseModel):
    """Un badge debloque avec ses metadonnees."""
    code: str
    titre: str
    description: str
    icone: str
    bonus_score: int
    rarete: str
    est_debloque: bool
    date_obtention: Optional[datetime] = None


class ListeBadges(BaseModel):
    """Liste complete des badges (deja debloques + a debloquer)."""
    badges: list[BadgeDetail]
    total_debloques: int
    total_disponibles: int
    bonus_total: int


# ============================================================================
# Streak / Statistiques
# ============================================================================

class StatistiquesEngagement(BaseModel):
    """Vue d'ensemble de l'engagement de l'utilisateur."""
    streak_actuel: int
    streak_record: int
    jours_actifs_30j: int
    bonus_score_cumule: int
    bonus_streak_actuel: int     # Combien de points le streak actuel rapporte
    prochain_palier_streak: int  # Ex : 7 (si tu es a 5, il reste 2 jours)
    jours_jusqu_au_palier: int


# ============================================================================
# Recommandations
# ============================================================================

class RecommandationDetail(BaseModel):
    """Une suggestion concrete pour ameliorer son score."""
    code: str
    titre: str
    description: str
    icone: str
    gain_estime: int
    lien_action: str
    priorite: str


class ListeRecommandations(BaseModel):
    recommandations: list[RecommandationDetail]
    total: int
    gain_total_potentiel: int


# ============================================================================
# Notifications
# ============================================================================

class NotificationDetail(BaseModel):
    """Une notification a destination de l'utilisateur."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type_notification: str
    categorie: str
    titre: str
    message: str
    lien_action: Optional[str]
    est_lue: bool
    date_lecture: Optional[datetime]
    cree_le: datetime


class ListeNotifications(BaseModel):
    notifications: list[NotificationDetail]
    total: int
    non_lues: int


# ============================================================================
# Parrainage
# ============================================================================

class CodeParrainage(BaseModel):
    """Le code de parrainage de l'utilisateur connecte + statistiques."""
    code: str
    lien_invitation: str
    nombre_filleuls: int
    bonus_recus: int


class FilleulInfo(BaseModel):
    """Un filleul parrainage par l'utilisateur."""
    date_inscription: datetime
    a_atteint_score_50: bool
