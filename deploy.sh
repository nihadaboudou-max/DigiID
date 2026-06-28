#!/bin/bash
set -e  # Arrêter en cas d'erreur

echo "🔄 Récupération des dernières modifications..."
cd ~/DigiID
git fetch origin
git reset --hard origin/main  # Force la synchronisation (écrase les modifs locales)

echo "🏗️  Reconstruction du backend..."
export COMPOSE_BAKE=false
docker compose build --no-cache backend

echo "🚀 Redémarrage des services..."
docker compose up -d

echo " Attente du démarrage..."
sleep 30

echo "✅ Vérification..."
docker ps | grep backend
docker logs digiid_backend --tail 10

echo "🎉 Déploiement terminé !"