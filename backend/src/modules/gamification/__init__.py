# -*- coding: utf-8 -*-
"""
Module Gamification — tracking quotidien, badges, recommandations, parrainage, notifications.
Tout ce qui rend l'usage de DigiID engageant et progressif.
"""
from src.modules.gamification.routes import routeur_gamification
from src.modules.gamification import (
    service_badges,
    service_engagement,
    service_notifications,
    service_parrainage,
    service_recommandations,
    service_tracking,
)

__all__ = [
    "routeur_gamification",
    "service_badges",
    "service_engagement",
    "service_notifications",
    "service_parrainage",
    "service_recommandations",
    "service_tracking",
]
