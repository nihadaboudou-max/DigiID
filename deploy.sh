#!/bin/bash
set -e

# ⚠️ Couper le SSH ne doit PAS interrompre le déploiement :
#   tmux new -s deploiement
#   ./deploy.sh
#   Ctrl+B puis D
#   tmux attach -t deploiement

cd ~/DigiID

# Services applicatifs (Ollama EXCLU : image de 15-20 Go, incompatible avec 38 Go de disque)
SERVICES="db redis backend worker_celery beat_celery frontend nginx"

# ────────────────────────────────────────────────────────────────
# 1. Pré-vol
# ────────────────────────────────────────────────────────────────
[ -f .env ] || { echo "❌ .env introuvable. Copier .env.exemple → .env"; exit 1; }

DOMAINE_VAR=$(grep -E '^DOMAINE=' .env | head -1 | cut -d= -f2)
echo "🌐 Domaine : ${DOMAINE_VAR:-<non défini>}"

command -v docker >/dev/null 2>&1 || { echo "❌ Docker non installé."; exit 1; }

echo "🧪 Ressources :"
df -h / | tail -1
free -h | head -2
echo ""

# Nettoyage SÛR : jamais --volumes (ça supprimerait la base de données !)
ESPACE_LIBRE=$(df -P / | awk 'NR==2 {print $4}')
if [ "$ESPACE_LIBRE" -lt 8388608 ]; then
    echo "⚠️  Disque < 8 Go. Nettoyage SÉCURISÉ (volumes préservés)..."
    docker builder prune -af || true
    docker image prune -f || true          # images pendantes uniquement
    docker container prune -f || true
    ESPACE_LIBRE=$(df -P / | awk 'NR==2 {print $4}')
fi

# Garde-fou : on refuse de builder si toujours insuffisant
if [ "$ESPACE_LIBRE" -lt 5242880 ]; then
    echo "❌ Moins de 5 Go libres après nettoyage. Build annulé pour protéger la base."
    echo "   → Nettoie manuellement ou agrandis le disque."
    df -h /
    exit 1
fi

echo "🔄 Récupération du code (attention : écrase les modifs locales non commitées)..."
git fetch origin
git reset --hard origin/main

if [ -d "frontend/.next" ]; then
    rm -rf frontend/.next
    echo "   ✅ Cache .next supprimé"
fi

# ────────────────────────────────────────────────────────────────
# 2. Build séquentiel (cache activé par défaut, --no-cache optionnel)
# ────────────────────────────────────────────────────────────────
export COMPOSE_BAKE=false
NO_CACHE=""
[ "${FORCE_NO_CACHE:-0}" = "1" ] && NO_CACHE="--no-cache"

echo "🧹 Cache de build..."
docker builder prune -f || true

echo "🏗️  [1/2] BACKEND..."
docker compose build --progress plain $NO_CACHE backend worker_celery beat_celery

echo "🏗️  [2/2] FRONTEND..."
docker compose build --progress plain $NO_CACHE frontend

# ────────────────────────────────────────────────────────────────
# 3. Arrêt + vérifications
# ────────────────────────────────────────────────────────────────
echo "🛑 Arrêt des anciens conteneurs..."
docker compose down --remove-orphans 2>/dev/null || true
sleep 3   # laisse docker-proxy libérer les ports

CHEMIN_FULLCHAIN=$(grep -E '^CHEMIN_CERTIFICAT_FULLCHAIN=' .env | head -1 | cut -d= -f2-)
CHEMIN_FULLCHAIN=${CHEMIN_FULLCHAIN:-/etc/letsencrypt/live/dynamiqueid.digital/fullchain.pem}
CHEMIN_CLE=$(grep -E '^CHEMIN_CERTIFICAT_CLE=' .env | head -1 | cut -d= -f2-)
CHEMIN_CLE=${CHEMIN_CLE:-/etc/letsencrypt/live/dynamiqueid.digital/privkey.pem}

if [ ! -f "$CHEMIN_FULLCHAIN" ] || [ ! -f "$CHEMIN_CLE" ]; then
    echo "❌ Certificats SSL introuvables : $CHEMIN_FULLCHAIN"
    exit 1
fi
echo "   ✅ Certificats SSL présents"

for PORT in 80 443; do
    if ss -ltn 2>/dev/null | grep -q ":$PORT "; then
        echo "❌ Port $PORT occupé sur l'hôte :"
        ss -ltnp | grep ":$PORT " || true
        echo "   → sudo systemctl stop nginx && sudo systemctl disable nginx"
        exit 1
    fi
done

# ────────────────────────────────────────────────────────────────
# 4. Démarrage (sans Ollama) + migrations
# ────────────────────────────────────────────────────────────────
echo "🚀 Démarrage : $SERVICES"
docker compose up -d $SERVICES

echo "⏳ Attente de la base de données (max 90 s)..."
for i in $(seq 1 18); do
    ETAT=$(docker inspect -f '{{.State.Health.Status}}' digiid_db 2>/dev/null || echo "absent")
    if [ "$ETAT" = "healthy" ]; then
        echo "   ✅ Base healthy"
        break
    fi
    echo "   ... état = $ETAT ($i/18)"
    sleep 5
done

if [ "$ETAT" != "healthy" ]; then
    echo "❌ Base non healthy. Logs :"
    docker compose logs --tail=40 db
    exit 1
fi

echo "🗄️  Migrations Alembic..."
docker compose exec -T backend alembic upgrade head \
    || echo "⚠️  Migrations échouées (vérifier alembic heads)"

echo "✅ Conteneurs :"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep digiid

echo "🔍 Config nginx :"
docker exec digiid_nginx nginx -t && echo "   ✅ nginx valide" || echo "   ❌ nginx INVALIDE"

echo ""
echo "📋 Backend :"
docker logs digiid_backend --tail 15
echo ""
echo "📋 Frontend :"
docker logs digiid_frontend --tail 15

DOMAINE_FINAL=${DOMAINE_VAR:-dynamiqueid.digital}
echo ""
echo "🎉 Déploiement terminé !"
echo "   ➜ https://${DOMAINE_FINAL}"
echo "   ➜ https://${DOMAINE_FINAL}/api/v1/sante-leger"
df -h / | tail -1