# -*- coding: utf-8 -*-
"""Calcul du score de risque et interprétation."""
from src.config.constantes import NiveauxRisque
from src.modules.detection_fraude.schemas import ScoreRisque, SignalFraude


def interpreter_score(score: int) -> str:
    niveau = NiveauxRisque.depuis_score(score)
    if niveau == NiveauxRisque.FAIBLE:
        return "Le risque est faible. Action autorisée avec surveillance normale."
    if niveau == NiveauxRisque.MODERE:
        return "Le risque est modéré. Des contrôles supplémentaires sont recommandés."
    if niveau == NiveauxRisque.ELEVE:
        return "Le risque est élevé. Il est conseillé de vérifier l'identité."
    return "Risque critique. L'action doit être bloquée et investiguée."


def calculer_score_risque(
    facteurs: list[SignalFraude],
    anomalie: float,
) -> ScoreRisque:
    score_regles = max((facteur.severite for facteur in facteurs), default=0)
    score_final = round(min(100, score_regles * 0.6 + anomalie * 100 * 0.4))

    return ScoreRisque(
        score_total=score_final,
        niveau=NiveauxRisque.depuis_score(score_final).value,
        interpretation=interpreter_score(score_final),
        facteurs=facteurs,
    )
