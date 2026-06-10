# -*- coding: utf-8 -*-
"""
Noyau de l'application DigiID — composants transversaux utilisés partout.
"""
from src.noyau.chiffrement import (
    hacher_mot_de_passe,
    verifier_mot_de_passe,
    chiffrer_donnee,
    dechiffrer_donnee,
    generer_token_aleatoire,
)
from src.noyau.journal import journal, configurer_journal
from src.noyau.exceptions import (
    ErreurDigiID,
    ErreurAuthentification,
    ErreurAutorisation,
    ErreurValidation,
    ErreurRessourceIntrouvable,
    ErreurFraudeDetectee,
)

__all__ = [
    "hacher_mot_de_passe", "verifier_mot_de_passe",
    "chiffrer_donnee", "dechiffrer_donnee", "generer_token_aleatoire",
    "journal", "configurer_journal",
    "ErreurDigiID", "ErreurAuthentification", "ErreurAutorisation",
    "ErreurValidation", "ErreurRessourceIntrouvable", "ErreurFraudeDetectee",
]
