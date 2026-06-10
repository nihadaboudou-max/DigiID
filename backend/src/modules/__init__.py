# -*- coding: utf-8 -*-
"""
Modules métier de DigiID — un dossier par fonctionnalité.

Convention : chaque module contient au minimum :
  - service.py       : logique métier pure (testable sans FastAPI)
  - routes.py        : endpoints FastAPI
  - schemas.py       : modèles Pydantic spécifiques au module (optionnel)
  - repository.py    : accès base de données (optionnel)

Aucun import ici — chaque module est chargé explicitement par
src/api/v1/routeur_principal.py.
"""
