# DigiID — Backend

API Python FastAPI pour le système d'identité numérique DigiID.

## Stack technique

- **Python 3.11+**
- **FastAPI 0.110** — framework web asynchrone
- **SQLAlchemy 2.0** — ORM
- **PostgreSQL 16** — base de données
- **Redis 7** — cache + sessions + file de tâches
- **Alembic** — migrations de base de données
- **Argon2id** — hachage des mots de passe
- **AES-256-GCM** — chiffrement des données sensibles
- **JWT (HS256)** — authentification stateless
- **Loguru** — journalisation structurée

## Architecture des dossiers

```
backend/
├── src/
│   ├── config/                  # Paramètres centralisés (.env via Pydantic)
│   ├── noyau/                   # Chiffrement, journal, exceptions
│   ├── modeles/                 # Tables SQLAlchemy (un fichier par table)
│   ├── schemas/                 # Validation Pydantic
│   ├── modules/                 # Un dossier par fonctionnalité
│   │   ├── authentification/
│   │   ├── utilisateurs/
│   │   ├── admin/
│   │   ├── super_admin/
│   │   └── monitoring/
│   ├── middleware/              # CORS, sécurité, journalisation
│   ├── api/v1/                  # Assemblage des routeurs
│   ├── base_donnees/            # Session, seed
│   └── main.py                  # Point d'entrée FastAPI
├── alembic/                     # Migrations
├── tests/                       # Tests pytest
└── requirements.txt
```

## Principes appliqués

- **Une seule responsabilité par fichier** — pas de fichier qui fait tout
- **Service séparé des routes** — la logique métier n'est jamais dans une route
- **Tout en français** — variables, fonctions, classes, commentaires
- **Aucun secret en dur** — tout passe par `.env`
- **Trois rôles strictement séparés** — utilisateur, administrateur, super administrateur
- **Audit immuable** — chaque action sensible enregistrée

## Démarrage rapide en local

Voir le README à la racine du projet (`/digiid/README.md`).

## Tests

```bash
docker compose exec backend pytest -v
```

## Documentation interactive de l'API

Une fois le backend démarré : http://localhost:8000/docs
