# Notebooks d'analyse et d'entraînement DigiID

Ce dossier contient les notebooks Jupyter utilisés pour :

- Générer des données synthétiques d'utilisateurs
- Entraîner les modèles de scoring (régression linéaire, Random Forest, XGBoost)
- Évaluer les performances
- Exporter les modèles pour usage en production

## Notebooks disponibles

| Notebook                                       | Rôle                                          |
| ---------------------------------------------- | --------------------------------------------- |
| `01_entrainement_modele_scoring.ipynb`         | Pipeline complet d'entraînement du scoring    |

## Comment exécuter

### Depuis le container Docker

```bash
docker compose exec backend pip install jupyter matplotlib seaborn scikit-learn xgboost faker joblib
docker compose exec backend jupyter nbconvert --to notebook --execute notebooks/01_entrainement_modele_scoring.ipynb --output 01_resultats.ipynb
```

### Depuis ton environnement Python local

```powershell
cd E:\NOUVEAU_PROJET_MEMOIRE\DIGI_ID\digiid\backend
pip install jupyter matplotlib seaborn scikit-learn xgboost faker joblib
jupyter notebook notebooks/01_entrainement_modele_scoring.ipynb
```

## Sortie attendue

Après exécution, tu trouveras :

- `../modeles_entraines/scoring_v1.joblib` — le modèle XGBoost entraîné, prêt à être chargé par le backend
- Graphiques de distribution du score
- Comparaison des performances des 3 modèles
- Importance des variables (interprétabilité)

## Spécifications du dataset

- **10 000 profils synthétiques** générés avec `numpy.random` (seed=42 pour reproductibilité)
- **12 variables comportementales** : ancienneté SIM, transactions mobile money,
  régularité, stabilité géographique, réseau de contacts, etc.
- **Variable cible** : score 0-100 calculé selon la formule pondérée du Cahier des Charges
  (25% SIM, 35% mobile money, 20% géographie, 20% réseau)
- **Distributions calibrées** sur les données ANSD (Sénégal) et GSMA Mobile Money 2024

## Métriques typiques obtenues

| Modèle              | MAE test | R² test | Commentaire                          |
| ------------------- | -------- | ------- | ------------------------------------ |
| Régression linéaire | ~2.5     | ~0.96   | Baseline interprétable               |
| Random Forest       | ~1.0     | ~0.99   | Capture les non-linéarités           |
| XGBoost             | ~0.7     | ~0.99   | Meilleure performance générale       |

## Roadmap

- ✅ Phase 3 : génération synthétique + entraînement de base
- 🔜 Phase 4 : intégration SHAP pour explicabilité par utilisateur
- 🔜 Phase 6 : ré-entraînement périodique sur données réelles collectées
- 🔜 Phase 6 : monitoring de la dérive du modèle (concept drift)
