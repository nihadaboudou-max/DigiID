#!/bin/bash
# =============================================================================
# DigiID — Entrypoint pour Render
# 1. Applique les migrations Alembic
# 2. Crée le super admin si les variables d'env sont définies
# 3. Lance l'API FastAPI
# =============================================================================

set -e

echo "=== DigiID — Démarrage ==="

# -------------------------------------------------------------------
# Étape 1 : Appliquer les migrations
# -------------------------------------------------------------------
echo "→ Application des migrations Alembic..."
python migrer.py
echo "✅ Migrations terminées"

# -------------------------------------------------------------------
# Étape 2 : Créer le super admin si les identifiants sont fournis
# -------------------------------------------------------------------
if [ -n "$SEED_SUPER_ADMIN_EMAIL" ] && [ -n "$SEED_SUPER_ADMIN_MOT_DE_PASSE" ]; then
    echo "→ Création du super administrateur..."
    python -m src.base_donnees.seed || echo "⚠️  Seed ignoré (admin existe peut-être déjà)"
fi

# -------------------------------------------------------------------
# Étape 3 : Lancer l'API (OBLIGATOIRE !)
# -------------------------------------------------------------------
echo "→ Lancement de l'API sur le port ${PORT:-8000}..."
exec uvicorn src.main:application --host 0.0.0.0 --port "${PORT:-8000}"
