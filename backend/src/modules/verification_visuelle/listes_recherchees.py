# -*- coding: utf-8 -*-
"""Vérification contre des listes officielles de personnes recherchées."""
from typing import Optional

from src.config.parametres import parametres


def verifier_listes_officielles(
    nom: Optional[str],
    pays: Optional[str],
) -> list[dict]:
    """Simule une vérification contre les listes officielles si activée."""
    if not parametres.activer_liste_personnes_recherchees:
        return []

    # Pour l'instant, cette implémentation est un placeholder.
    # Elle peut être remplacée par un vrai connecteur vers OFAC/ONU/Interpol.
    return []
