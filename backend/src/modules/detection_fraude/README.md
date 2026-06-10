# Module Détection de Fraude — Phase 4

Détection en temps réel des comportements suspects, combinant règles métier
explicables et apprentissage automatique non supervisé.

## Fichiers prévus

| Fichier               | Rôle                                                      |
| --------------------- | --------------------------------------------------------- |
| `service.py`          | Orchestration : règles + ML, calcul du score de risque    |
| `regles.py`           | Règles métier explicites (vélocité, géo, IP, etc.)        |
| `modele_anomalies.py` | Isolation Forest pour anomalies non vues par les règles   |
| `scoring_risque.py`   | Combinaison règles + ML → score 0-100                     |
| `alertes.py`          | Génération d'alertes et notification admin                |
| `routes.py`           | Endpoints internes (utilisés par auth, profil, etc.)      |

## Règles métier (couche 1)

| Règle                              | Seuil               | Action       |
| ---------------------------------- | ------------------- | ------------ |
| Tentatives de connexion échouées   | ≥ 5 en 15 min       | Verrouillage |
| Changement de pays IP              | < 1h entre 2 pays   | Alerte       |
| Vélocité d'inscription             | > 10 comptes / IP / heure | Blocage |
| Score qui change brutalement       | > 20 points / mois  | Revue manuelle |
| Téléphone associé à un compte sanctionné | match exact   | Blocage      |

## Modèle ML (couche 2)

Isolation Forest entraîné sur les comportements normaux. Détecte ce que
les règles ne voient pas : combinaisons subtiles d'indicateurs.

Variables : nombre de connexions/jour, heures de connexion, diversité d'IP,
patterns de transactions, vitesse de remplissage du profil, etc.

## Score de risque final

```
score_risque = max(score_regles, score_ml * 0.7)
```

| Score   | Niveau     | Action                                         |
| ------- | ---------- | ---------------------------------------------- |
| 0-30    | Faible     | Aucune action                                  |
| 31-60   | Modéré     | Surveillance accrue                            |
| 61-80   | Élevé      | Alerte admin, action loguée mais autorisée     |
| 81-100  | Critique   | Action bloquée, recours humain obligatoire     |
