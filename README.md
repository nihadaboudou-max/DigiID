# DigiID — Prototype

> Système d'Identité Numérique Africaine par Big Data
> Mémoire de fin d'études — Mastère Stratégie Digitale — ISM Dakar 2025-2026
> ABOUDOU TRAORE Nihad

---

## Vision

DigiID est un système d'identité numérique pour les populations sous-documentées d'Afrique de l'Ouest. À partir des traces numériques produites au quotidien (mobile money, ancienneté SIM, stabilité géographique, réseau de contacts), un algorithme construit un identifiant numérique fiable accompagné d'un score de confiance entre 0 et 100.

Voir le `Business Plan` et le `Cahier des Charges` à la racine du dossier projet pour le contexte complet.

---

## Architecture du prototype

```
digiid/
├── backend/                # API Python FastAPI (port 8000)
├── frontend/               # Application Next.js (port 3000) — Phase 5
├── infrastructure/         # Docker Compose, configuration
├── documentation/          # Documents techniques détaillés
└── scripts/                # Scripts utilitaires
```

### Stack technique

| Couche             | Technologie                              | Pourquoi                              |
| ------------------ | ---------------------------------------- | ------------------------------------- |
| API                | Python 3.11 + FastAPI 0.110              | Asynchrone, doc OpenAPI auto, mature  |
| Base de données    | PostgreSQL 16                            | Production-ready, fiable, libre       |
| Cache              | Redis 7                                  | Sessions, rate-limit, file de tâches  |
| Index vectoriel    | ChromaDB                                 | RAG du chatbot (Phase 3)              |
| LLM (dev)          | Ollama + Mistral 7B / Llama 3.2          | Local, gratuit                        |
| LLM (prod)         | Groq / OpenRouter (API gratuites)        | Bascule par variable d'environnement  |
| Tâches asynchrones | Celery                                   | Calculs ML, envoi emails              |
| Monitoring         | Prometheus + Grafana + Loki + Sentry     | Métriques, logs, erreurs              |
| Frontend           | Next.js 14 + TypeScript + Tailwind       | (à venir — Phase 5)                   |

### Séparation stricte des rôles

Trois espaces totalement isolés :

| Rôle                    | URL frontend             | Endpoints API                  |
| ----------------------- | ------------------------ | ------------------------------ |
| Utilisateur             | `/`                      | `/api/v1/utilisateur/*`        |
| Administrateur          | `/admin`                 | `/api/v1/admin/*`              |
| Super Administrateur    | `/super-admin`           | `/api/v1/super-admin/*`        |

Chaque rôle a ses propres middlewares d'autorisation. Un utilisateur ne peut jamais appeler un endpoint admin, même en forgeant un token.

---

## Démarrage rapide

### 1. Prérequis

Installer sur votre machine :
- **Docker Desktop** (Windows / Mac / Linux) — https://www.docker.com/products/docker-desktop
- **Git** — pour cloner le dépôt (si applicable)
- **Python 3.11+** — pour exécuter les scripts utilitaires

### 2. Configuration initiale

```bash
# Aller dans le dossier backend
cd digiid/backend

# Copier le modèle de configuration
cp .env.exemple .env

# Générer les clés secrètes
cd ..
python scripts/generer_cles.py

# Copier les deux clés affichées dans backend/.env
# (CLE_SECRETE_JWT et CLE_CHIFFREMENT_DONNEES)
```

### 3. Démarrer tous les services

```bash
cd digiid/infrastructure
docker compose up -d
```

Cela démarre :
- PostgreSQL (port 5432)
- Redis (port 6379)
- ChromaDB (port 8001)
- Ollama (port 11434)
- API DigiID (port 8000)
- Worker Celery

Vérifier que tout est OK :
```bash
docker compose ps
```

### 4. Appliquer les migrations de base de données

```bash
docker compose exec backend alembic revision --autogenerate -m "schema initial"
docker compose exec backend alembic upgrade head
```

### 5. Créer le super administrateur initial

```bash
docker compose exec backend python -m src.base_donnees.seed
```

Le script demande :
- Email du super admin
- Mot de passe (minimum 12 caractères, complexité requise)

### 6. Tester

Ouvrir la documentation interactive :
```
http://localhost:8000/docs
```

Endpoints clés à tester en premier :
- `GET /api/v1/sante` — santé du système
- `POST /api/v1/auth/connexion` — se connecter avec le super admin
- `GET /api/v1/super-admin/tableau-de-bord` — vue technique du système

---

## État d'avancement

| Phase | Description                                  | Statut          |
| ----- | -------------------------------------------- | --------------- |
| 1     | Squelette + authentification multi-rôles     | ✅ En cours     |
| 2     | Modules métier (profil, scoring, monitoring) | À venir         |
| 3     | Chatbot LangChain + RAG                      | À venir         |
| 4     | Reconnaissance faciale + détection fraude    | À venir         |
| 5     | Frontend Next.js complet                     | À venir         |
| 6     | Déploiement + monitoring complet             | À venir         |

---

## Sécurité — résumé

- Mots de passe : **Argon2id** (paramètres OWASP 2024)
- Données sensibles : **AES-256-GCM** (chiffrement authentifié)
- Communications : **TLS 1.3** (Let's Encrypt en prod)
- Jetons : **JWT HS256** courte durée + refresh token rotatif
- Limitation de débit : **slowapi** (par IP et par utilisateur)
- Headers de sécurité : **HSTS, CSP, X-Frame-Options, etc.**
- Audit immuable : **chaque action sensible tracée**
- 2FA obligatoire pour admin / super admin

Voir `documentation/SECURITE.md` (à venir).

---

## Tests

```bash
# Tous les tests
docker compose exec backend pytest

# Avec couverture
docker compose exec backend pytest --cov=src --cov-report=term-missing

# Un test spécifique
docker compose exec backend pytest tests/test_chiffrement.py -v
```

---

## Arrêt et nettoyage

```bash
# Arrêter les services
docker compose down

# Arrêter ET supprimer les volumes (perte de données !)
docker compose down -v
```

---

## Conformité légale

Le système est conçu en conformité avec :
- **Loi 2008-12 du Sénégal** sur la protection des données personnelles
- **Code numérique du Bénin** (loi 2017-20)
- **Convention de Malabo** (Union africaine)
- **Acte additionnel CEDEAO** sur la protection des données

Documentation du traitement préparée pour la CDP (Sénégal) et l'APDP (Bénin).

---

## Contact

ABOUDOU TRAORE Nihad
ISM Dakar — Mastère Stratégie Digitale
2025-2026
