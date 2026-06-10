# Phase 2 — Modules métier livrés

## Vue d'ensemble

La Phase 2 ajoute trois modules métier au backend qui transforment les pages
frontend de Phase 5 en interfaces avec de vraies données :

| Module           | Endpoints API                              | Page frontend                  |
| ---------------- | ------------------------------------------ | ------------------------------ |
| Profil           | `/api/v1/utilisateur/profil/*`             | `/profil`                      |
| Consentements    | `/api/v1/utilisateur/consentements/*`      | `/consentements`               |
| Scoring          | `/api/v1/utilisateur/score/*`              | `/score`, `/tableau-de-bord`   |

## Endpoints exposés

### Profil

| Méthode | Chemin                            | Description                       |
| ------- | --------------------------------- | --------------------------------- |
| GET     | `/api/v1/utilisateur/profil`      | Mon profil complet (déchiffré)    |
| PATCH   | `/api/v1/utilisateur/profil`      | Modification partielle            |
| GET     | `/api/v1/utilisateur/profil/export` | Export RGPD (JSON portabilité)  |
| DELETE  | `/api/v1/utilisateur/profil`      | Suppression définitive du compte  |

### Consentements

| Méthode | Chemin                                              | Description                         |
| ------- | --------------------------------------------------- | ----------------------------------- |
| GET     | `/api/v1/utilisateur/consentements`                 | Liste tous mes consentements        |
| GET     | `/api/v1/utilisateur/consentements/{categorie}`     | Détail + texte légal complet        |
| PATCH   | `/api/v1/utilisateur/consentements/{categorie}`     | Accorder/retirer                    |

Catégories disponibles : `cgu` (obligatoire), `donnees_mobile_money`,
`geolocalisation`, `anciennete_sim`, `verification_personnes_recherchees`, `marketing`.

### Scoring

| Méthode | Chemin                                          | Description                       |
| ------- | ----------------------------------------------- | --------------------------------- |
| GET     | `/api/v1/utilisateur/score`                     | Score actuel + facteurs           |
| POST    | `/api/v1/utilisateur/score/recalculer`          | Forcer un recalcul                |
| GET     | `/api/v1/utilisateur/score/historique`          | Historique des calculs            |

## Migration de base requise

Une nouvelle table `score_historique` a été ajoutée. Pour la créer :

```bash
docker compose exec backend alembic revision --autogenerate -m "phase2_score_historique"
docker compose exec backend alembic upgrade head
```

## Méthode de calcul du score

Le score 0-100 est calculé selon la pondération du Cahier des Charges :

| Famille                    | Poids | Composantes                                              |
| -------------------------- | ----- | -------------------------------------------------------- |
| Ancienneté & stabilité SIM | 25    | Ancienneté (60%) + stabilité opérateur (30%) + changements (10%) |
| Régularité mobile money    | 35    | Fréquence (40%) + régularité (40%) + diversité (20%)     |
| Stabilité géographique     | 20    | Constance ville (70%) + changements quartier (30%)       |
| Réseau de contacts         | 20    | Taille (40%) + anciens (40%) + recoupement DigiID (20%)  |

L'approche est **100% explicable** (pas de boîte noire ML). En Phase 4,
un modèle XGBoost sera ajouté en complément pour les interactions non linéaires.

## Données comportementales

Tant qu'on n'a pas branché les vraies API opérateurs (Wave, Orange Money),
le module `generateur_donnees.py` produit des valeurs **déterministes**
par utilisateur :

- Le même `utilisateur_id` produit toujours les mêmes valeurs
- Les valeurs sont plausibles pour le contexte ouest-africain
- L'âge du compte influence le potentiel d'historique

En Phase 6, ce module sera remplacé par des connecteurs réels.

## Sécurité et conformité

- Toutes les actions sensibles (modification profil, suppression compte,
  modification consentement, calcul score, consultation profil) sont tracées
  dans le journal d'audit avec date, IP, et données contextuelles.
- Les données personnelles restent chiffrées en base (AES-256-GCM).
- Le déchiffrement n'a lieu qu'à la frontière du service, jamais en couche basse.
- Les consentements retirés ne sont pas supprimés en base — seule la
  `date_retrait` est mise à jour. C'est la preuve historique en cas de litige.
- Le droit à l'oubli (DELETE /profil) efface immédiatement les données
  chiffrées personnelles ; une purge complète est programmée sous 30 jours.

## Test rapide une fois les migrations appliquées

```bash
# 1. Se connecter (récupérer le token d'accès)
curl -X POST http://localhost:8000/api/v1/auth/connexion \
  -H "Content-Type: application/json" \
  -d '{"email":"ton.email","mot_de_passe":"TonMotDePasse2026!"}'

# 2. Récupérer son profil
curl http://localhost:8000/api/v1/utilisateur/profil \
  -H "Authorization: Bearer TON_TOKEN"

# 3. Calculer son score
curl http://localhost:8000/api/v1/utilisateur/score \
  -H "Authorization: Bearer TON_TOKEN"

# 4. Lister ses consentements
curl http://localhost:8000/api/v1/utilisateur/consentements \
  -H "Authorization: Bearer TON_TOKEN"
```

## Frontend : passage des données démo aux vraies

Une fois la migration appliquée et le backend redémarré, le frontend peut
être branché. Les services à créer dans `frontend/src/services/` :

```ts
// services/profil.ts
import { clientAPI } from "./client_api";
export const obtenirMonProfil = () =>
  clientAPI.get("/api/v1/utilisateur/profil", { authentifie: true });
export const modifierMonProfil = (donnees: any) =>
  clientAPI.patch("/api/v1/utilisateur/profil", donnees, { authentifie: true });
// etc.
```

Ensuite, dans les pages frontend, remplacer les données de démo par les
appels à ces services. Les composants ne changent pas — seules les sources
de données changent.
