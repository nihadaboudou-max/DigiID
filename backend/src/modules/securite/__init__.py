# -*- coding: utf-8 -*-
"""
Module Sécurité — protections anti-usurpation, validation, détection de fraude.

Composants :
  - validation_email.py    : Validation des domaines email institutionnels
  - alerte_fraude.py       : Détection et enregistrement des tentatives d'usurpation
  - verification_role.py   : Vérifications liées aux changements de rôle
"""
from src.modules.securite.validation_email import valider_email_institutionnel
from src.modules.securite.alerte_fraude import (
    enregistrer_alerte_fraude,
    verifier_tentative_usurpation,
)

__all__ = [
    "valider_email_institutionnel",
    "enregistrer_alerte_fraude",
    "verifier_tentative_usurpation",
]
