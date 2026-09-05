#!/bin/bash
set -e  # Arrêter le script en cas d'erreur

echo "🚀 Démarrage de la mise à jour incrémentale de DigiID..."
cd ~/DigiID

# ────────────────────────────────────────────────────────────────
# 1. Récupération du code (Source de vérité : Git)
# ────────────────────────────────────────────────────────────────
echo "📥 Récupération des dernières modifications..."
git fetch origin
git reset --hard origin/main  # Écrase les modifications locales pour garantir la propreté

# ────────────────────────────────────────────────────────────────
# 2. Détection intelligente des changements de dépendances
# ────────────────────────────────────────────────────────────────
echo "🔍 Vérification des dépendances backend..."
CURRENT_HASH=$(md5sum backend/requirements.txt | awk '{print $1}')
LAST_HASH_FILE=".last_requirements_hash"

if [ -f "$LAST_HASH_FILE" ]; then
    LAST_HASH=$(cat "$LAST_HASH_FILE")
    if [ "$CURRENT_HASH" != "$LAST_HASH" ]; then
        echo "⚠️  Changement détecté dans requirements.txt. Reconstruction du backend en cours..."
        docker compose build --no-cache backend
        echo "$CURRENT_HASH" > "$LAST_HASH_FILE"
    else
        echo "✅ Aucune modification de dépendance. Le backend sera juste redémarré (gain de temps massif)."
    fi
else
    # Premier lancement du script
    echo "$CURRENT_HASH" > "$LAST_HASH_FILE"
fi

# ────────────────────────────────────────────────────────────────
# 3. Mise à jour de la Base de Données (Alembic)
# ────────────────────────────────────────────────────────────────
echo "🗄️  Application des migrations de base de données (si nécessaire)..."
# Cette commande est sans danger : si aucune nouvelle migration n'existe, elle ne fait rien.
docker compose run --rm backend alembic upgrade head || echo "ℹ️  Aucune nouvelle migration à appliquer."

# ────────────────────────────────────────────────────────────────
# 4. Redémarrage à chaud des services
# ────────────────────────────────────────────────────────────────
echo "🔄 Redémarrage des services..."
# 'restart' est beaucoup plus rapide et fluide que 'down' puis 'up'
docker compose restart backend

# Gestion du Frontend (Optionnelle mais recommandée si code modifié)
echo "💡 Le frontend est en mode production (Next.js Standalone)."
echo "   Si vous avez modifié du code React/TypeScript, il doit être reconstruit."
read -p "Voulez-vous reconstruire le frontend maintenant ? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🏗️  Reconstruction du frontend en cours..."
    docker compose build --no-cache frontend
    docker compose restart frontend
else
    echo "ℹ️  Frontend non reconstruit. Les changements de code backend sont déjà actifs."
fi

# ────────────────────────────────────────────────────────────────
# 5. Vérification de santé (Health Check robuste)
# ────────────────────────────────────────────────────────────────
echo "⏳ Vérification de la santé du système..."

# On vérifie depuis l'intérieur du conteneur pour éviter les problèmes de ports exposés
# On tente jusqu'à 5 fois (10 secondes max) pour laisser le temps au backend de démarrer
for i in {1..5}; do
    if docker compose exec -T backend curl -s -f http://localhost:8000/api/v1/sante-leger > /dev/null 2>&1; then
        echo "✅ Système DigiID mis à jour avec succès et opérationnel !"
        break
    else
        if [ $i -eq 5 ]; then
            echo "❌ Attention : Le backend ne répond pas après 10 secondes."
            echo "   Consultez les logs avec : docker compose logs --tail=30 backend"
        else
            echo "⏳ Attente du démarrage du backend... (essai $i/5)"
            sleep 2
        fi
    fi
done

echo ""
echo "📋 Résumé de l'état des services :"
docker compose ps --format "table {{.Names}}\t{{.Status}}"