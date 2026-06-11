#!/bin/bash
# =============================================================================
# DigiID — Entrypoint pour Render
# 1. Crée le super admin si les variables d'env sont définies
# 2. Lance l'API FastAPI
# =============================================================================

set -e

echo "=== DigiID — Démarrage ==="

# Créer le super admin si les identifiants sont fournis
if [ -n "$SEED_SUPER_ADMIN_EMAIL" ] && [ -n "$SEED_SUPER_ADMIN_MOT_DE_PASSE" ]; then
    echo "→ Création du super administrateur..."
    python -m src.base_donnees.seed || echo "⚠️  Seed ignoré (admin existe peut-être déjà)"
fi

echo "→ Lancement de l'API..."
exec uvicorn src.main:application --host 0.0.0.0 --port "${PORT:-8000}"
