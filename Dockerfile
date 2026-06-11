# =============================================================================
# DigiID — Dockerfile racine pour Render
# Construit l'image du backend FastAPI depuis la racine du dépôt.
# =============================================================================

FROM python:3.11-slim AS constructeur

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libffi-dev \
    libsodium-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /installation
COPY backend/requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/home/digiid/.local/bin:$PATH

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libsodium23 \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/bash digiid

WORKDIR /app

USER digiid

COPY --from=constructeur --chown=digiid:digiid /root/.local /home/digiid/.local

# Copier UNIQUEMENT le dossier backend
COPY --chown=digiid:digiid backend/ .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD curl -f http://localhost:8000/api/v1/sante || exit 1

CMD uvicorn src.main:application --host 0.0.0.0 --port ${PORT:-8000}
