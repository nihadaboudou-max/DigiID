# -*- coding: utf-8 -*-
"""
Package racine de l'application DigiID.

Tout le code applicatif est sous `src.` :
  src.config       — paramètres et constantes
  src.noyau        — chiffrement, journal, exceptions
  src.modeles      — tables SQLAlchemy
  src.schemas      — validation Pydantic
  src.modules      — fonctionnalités métier (un dossier par fonctionnalité)
  src.middleware   — middlewares FastAPI
  src.api          — assemblage des routeurs
  src.base_donnees — sessions et migrations
  src.main         — point d'entrée FastAPI
"""

__version__ = "1.0.0"
