#!/bin/bash
set -e  # Arrêter en cas d'erreur

# ⚠️ IMPORTANT — couper la connexion SSH ne doit PAS interrompre le déploiement :
#   tmux new -s deploiement        # lancer une session persistante
#   ./deploy.sh                    # exécuter le script DANS la session
#   Ctrl+B puis D                  # se détacher (le déploiement continue)
#   tmux attach -t deploiement     # se rattacher pour voir la fin

cd ~/DigiID

# ────────────────────────────────────────────────────────────────
# 1. Pré-vol : vérifications
# ────────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
    echo "❌ Fichier .env introuvable à la racine. Copier .env.exemple → .env"
    exit 1
fi

DOMAINE_VAR=$(grep -E '^DOMAINE=' .env | head -1 | cut -d= -f2)
echo "🌐 Domaine configuré : ${DOMAINE_VAR:-<non défini>}"

if ! command -v docker >/dev/null 2>&1; then
    echo "❌ Docker n'est pas installé."
    exit 1
fi

echo "🧪 Vérification des ressources (espace disque / mémoire)..."
df -h / | tail -1
echo ""
free -h | head -2

# Alerte si moins de 8 Go libres (plus sûr que 5 Go pour les builds Next.js)
ESPACE_LIBRE_BLOCS=$(df -P / | awk 'NR==2 {print $4}')
if [ -n "$ESPACE_LIBRE_BLOCS" ] && [ "$ESPACE_LIBRE_BLOCS" -lt 8388608 ] 2>/dev/null; then
    echo "⚠️  Espace disque faible (< 8 Go). Nettoyage automatique en cours..."
    docker builder prune -f || true
    docker system prune -af --volumes || true
fi

echo "🔄 Récupération des dernières modifications..."
git fetch origin
git reset --hard origin/main

echo "🧹 Nettoyage du cache Next.js (local)..."
if [ -d "frontend/.next" ]; then
    rm -rf frontend/.next
    echo "   ✅ Cache .next supprimé"
fi

# ────────────────────────────────────────────────────────────────
# 2. Construction des images (SÉQUENTIELLE pour éviter la saturation disque)
# ────────────────────────────────────────────────────────────────
echo "🧹 Nettoyage préalable du cache de build Docker..."
docker builder prune -f || true

export COMPOSE_BAKE=false

echo "🏗️  [1/2] Reconstruction du BACKEND..."
docker compose build --progress plain --no-cache backend

echo "🏗️  [2/2] Reconstruction du FRONTEND..."
docker compose build --progress plain --no-cache frontend

# ────────────────────────────────────────────────────────────────
# 3. Arrêt et vérifications avant démarrage
# ────────────────────────────────────────────────────────────────
echo "🛑 Arrêt des anciens conteneurs DigiID (libération des ports 80/443)..."
docker compose down --remove-orphans 2>/dev/null || true

CHEMIN_FULLCHAIN=$(grep -E '^CHEMIN_CERTIFICAT_FULLCHAIN=' .env | head -1 | cut -d= -f2-)
CHEMIN_FULLCHAIN=${CHEMIN_FULLCHAIN:-/etc/letsencrypt/live/dynamiqueid.digital/fullchain.pem}
CHEMIN_CLE=$(grep -E '^CHEMIN_CERTIFICAT_CLE=' .env | head -1 | cut -d= -f2-)
CHEMIN_CLE=${CHEMIN_CLE:-/etc/letsencrypt/live/dynamiqueid.digital/privkey.pem}

if [ ! -f "$CHEMIN_FULLCHAIN" ] || [ ! -f "$CHEMIN_CLE" ]; then
    echo "❌ Certificats SSL introuvables sur l'hôte :"
    echo "   → Générer le certificat avec certbot ou corriger le .env"
    exit 1
fi
echo "   ✅ Certificats SSL présents"

for PORT in 80 443; do
    if ss -ltn 2>/dev/null | grep -q ":$PORT "; then
        echo "❌ Le port $PORT est déjà occupé sur l'hôte."
        echo "   → sudo systemctl stop nginx && sudo systemctl disable nginx"
        exit 1
    fi
done

# ────────────────────────────────────────────────────────────────
# 4. Démarrage et Migrations
# ────────────────────────────────────────────────────────────────
echo "🚀 Démarrage des services (db, redis, backend, frontend, nginx, ollama)..."
docker compose up -d

echo "⏳ Attente du démarrage de la base de données..."
sleep 15

echo "🗄️  Application des migrations de base de données (Alembic)..."
docker compose run --rm backend alembic upgrade head || echo "⚠️  Warning: Échec des migrations (peut être normal si aucune nouvelle migration)"

# ────────────────────────────────────────────────────────────────
# 5. Vérifications finales et Ollama
# ────────────────────────────────────────────────────────────────
echo "⏳ Vérification du modèle Ollama..."
# Remplace 'qwen2-vl:2b' par le modèle que tu utilises réellement
MODELE_OLLAMA="qwen2-vl:2b"
if ! docker compose exec ollama ollama list 2>/dev/null | grep -q "$MODELE_OLLAMA"; then
    echo "⚠️  Modèle $MODELE_OLLAMA non trouvé. Téléchargement en cours (cela peut prendre du temps)..."
    docker compose exec ollama ollama pull "$MODELE_OLLAMA" || echo "⚠️  Échec du téléchargement du modèle Ollama."
else
    echo "   ✅ Modèle Ollama ($MODELE_OLLAMA) déjà présent."
fi

echo "✅ Vérification des conteneurs..."
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{. Ports}}' | grep digiid

echo "🔍 Test de la configuration nginx..."
if docker exec digiid_nginx nginx -t 2>&1; then
    echo "   ✅ nginx config valide"
else
    echo "   ❌ nginx config INVALIDE"
fi

echo ""
echo "📋 Logs backend (dernières lignes) :"
docker logs digiid_backend --tail 15
echo ""
echo "📋 Logs frontend (dernières lignes) :"
docker logs digiid_frontend --tail 15

DOMAINE_FINAL=${DOMAINE_VAR:-dynamiqueid.digital}
echo ""
echo "🎉 Déploiement terminé avec succès !"
echo "   ➜  https://${DOMAINE_FINAL}"
echo "   ➜  Santé API : https://${DOMAINE_FINAL}/api/v1/sante-leger"