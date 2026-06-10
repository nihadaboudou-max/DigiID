# -*- coding: utf-8 -*-
"""Schéma standard de réponse d'erreur pour toute l'API DigiID."""
from typing import Optional

from pydantic import BaseModel


class ReponseErreur(BaseModel):
    """
    Format unifié des erreurs API DigiID.
    Toute erreur retournée au client suit ce format.
    """
    code_erreur: str
    message: str
    details: Optional[dict] = None
    request_id: Optional[str] = None
