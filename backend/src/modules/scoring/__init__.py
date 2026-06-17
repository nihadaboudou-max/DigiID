# -*- coding: utf-8 -*-
"""Module Scoring — calcul du score de confiance DigiID."""
from src.modules.scoring.routes import routeur_scoring
from src.modules.scoring.service import declencher_recalcul_score

# Version du modele de scoring utilisee
# v1 = ponderee (anciennete 25, mobile_money 35, geographie 20, reseau 20)
# v2 = ponderee_attestations (anciennete 25, mobile_money 25, geographie 20, reseau 15, attestations 15)
VERSION_SCORING = "v2_attestations"

__all__ = ["routeur_scoring", "declencher_recalcul_score", "VERSION_SCORING"]
