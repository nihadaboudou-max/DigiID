# =============================================================================
# DigiID — Backend Dockerfile
# Image Python 3.11 légère, multi-étapes pour optimiser la taille.
# =============================================================================

# --- Étape 1 : construction des dépendances ---
FROM python:3.11-slim AS constructeur

# Variables d'environnement Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Dépendances système nécessaires à la compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libffi-dev \
    libsodium-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /installation
COPY backend/requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# --- Étape 2 : image finale légère ---
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PATH=/home/digiid/.local/bin:$PATH

# Dépendances runtime minimales
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libsodium23 \
    libgl1 \
    libglib2.0-0 \
    curl \
    tesseract-ocr \
    tesseract-ocr-fra \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/bash digiid

WORKDIR /app
RUN mkdir -p /app/logs && chown digiid:digiid /app/logs

USER digiid

# Copier les dépendances installées depuis le constructeur
COPY --from=constructeur --chown=digiid:digiid /root/.local /home/digiid/.local

# Copier le code applicatif (backend uniquement)
COPY --chown=digiid:digiid backend/ .

# Exposer le port API
EXPOSE 8000

# Vérification de santé
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/sante-leger || exit 1

# Lancement de l'application — applique les migrations puis demarre le serveur
# Les migrations sont gérées par env.py qui auto-stamp la base si les tables
# existent déjà (créées par un précédent create_all) sans alembic_version.
# Cela évite les DuplicateTableError sur chaque migration.
CMD alembic upgrade head && uvicorn src.main:application --host 0.0.0.0 --port ${PORT:-8000}
