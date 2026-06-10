# Module Scoring — Phase 2

Calcul du score de confiance DigiID (0-100) pour chaque utilisateur.

## Fichiers prévus

| Fichier        | Rôle                                                         |
| -------------- | ------------------------------------------------------------ |
| `service.py`   | Orchestration du calcul, déclenchement périodique            |
| `features.py`  | Extraction des variables comportementales depuis la base     |
| `modele_ml.py` | Entraînement et prédiction Scikit-learn + XGBoost            |
| `interpretabilite.py` | Calcul des contributions SHAP par facteur             |
| `routes.py`    | Endpoints `/api/v1/utilisateur/score/*`                      |
| `schemas.py`   | Pydantic : ReponseScore, FacteurScore, etc.                  |

## Algorithme

Modèle d'ensemble combinant :
- Régression logistique (interprétable) pour les facteurs SHAP
- XGBoost (précis) pour la décision finale
- Score = 0.4 × LR + 0.6 × XGBoost, recalibré sur 0-100

## Variables prises en compte

| Famille                       | Poids | Variables                                          |
| ----------------------------- | ----- | -------------------------------------------------- |
| Ancienneté & stabilité SIM    | 25 %  | Date activation, changements, opérateur stable     |
| Régularité mobile money       | 35 %  | Fréquence, montant moyen, régularité, partenaires  |
| Stabilité géographique        | 20 %  | Constance ville/quartier, distance déplacements    |
| Réseau de contacts            | 20 %  | Taille répertoire, ancienneté, recoupement DigiID  |

## Données synthétiques pour la Phase 2

Génération de 10 000 profils via `Faker`, distribution calibrée sur les
données ANSD (Sénégal) et GSMA 2024. Permet l'entraînement initial sans
attendre les vrais partenariats opérateurs.
