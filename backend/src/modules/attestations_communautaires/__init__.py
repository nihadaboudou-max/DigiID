# -*- coding: utf-8 -*-
"""
Module Attestations Communautaires — Étape 4.

Permet aux utilisateurs de DigiID d'attester de la confiance
et de l'identité des membres de leur communauté.

Chaque attestation est un lien de confiance qui :
  1. Renforce le score de l'utilisateur attesté
  2. Crée un réseau de confiance vérifiable
  3. Permet la vérification sociale décentralisée

Sous-modules :
  - schemas.py     : Modèles Pydantic (requêtes / réponses)
  - service.py     : Logique métier (création, approbation, refus, listing)
  - routes.py      : Endpoints FastAPI protégés par rôle
  - repository.py  : Accès base de données (requêtes SQLAlchemy)

Cycle de vie :
  EN_ATTENTE → APPROUVEE | REFUSEE | EXPIREE
"""
from src.modules.attestations_communautaires.routes import routeur_attestations

__all__ = ["routeur_attestations"]
