#!/bin/bash
set -e  # Arrêter en cas d'erreur

echo "🔄 Récupération des dernières modifications..."
cd ~/DigiID
git fetch origin
git reset --hard origin/main  # Force la synchronisation (écrase les modifs locales)

echo "🧹 Nettoyage du cache Next.js (frontend)..."
# Supprimer le cache Next.js pour forcer une reconstruction propre
if [ -d "frontend/.next" ]; then
    rm -rf frontend/.next
    echo "   ✅ Cache .next supprimé"
else
    echo "   ℹ️  Pas de cache .next à supprimer"
fi

# Supprimer aussi le cache node_modules de Next.js si nécessaire
if [ -d "frontend/node_modules/.cache" ]; then
    rm -rf frontend/node_modules/.cache
    echo "   ✅ Cache node_modules supprimé"
fi

echo "🏗️  Reconstruction complète (backend + frontend)..."
export COMPOSE_BAKE=false
# --no-cache force une reconstruction propre sans utiliser le cache Docker
docker compose build --no-cache backend frontend

echo "🚀 Redémarrage des services..."
docker compose up -d

echo "⏳ Attente du démarrage..."
sleep 30

echo "✅ Vérification..."
docker ps | grep -E "backend|frontend"
echo ""
echo "📋 Logs backend (dernières lignes) :"
docker logs digiid_backend --tail 10
echo ""
echo "📋 Logs frontend (dernières lignes) :"
docker logs digiid_frontend --tail 10

echo "🎉 Déploiement terminé !"