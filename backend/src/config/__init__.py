# -*- coding: utf-8 -*-
"""
Module de configuration DigiID.
Toutes les variables d'environnement et constantes de l'application sont
centralisées ici, lues une seule fois et exposées en singleton.
"""
from src.config.parametres import parametres
from src.config.constantes import RolesUtilisateur, NiveauxRisque

__all__ = ["parametres", "RolesUtilisateur", "NiveauxRisque"]
