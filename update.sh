#!/bin/bash
set -e

echo "🚀 Mise à jour incrémentale de DigiID..."
cd ~/DigiID

# Ollama EXCLU : image de 15-20 Go, incompatible avec un disque de 38 Go
SERVICES_APP="backend worker_celery beat_celery frontend nginx"

# ────────────────────────────────────────────────────────────────
# 0. Pré-vol : disque (garde-fou anti "no space left")
# ────────────────────────────────────────────────────────────────
echo "🧪 Espace disque :"
df -h / | tail -1

ESPACE=$(df -P / | awk 'NR==2 {print $4}')
if [ "$ESPACE" -lt 8388608 ]; then
    echo "⚠️  < 8 Go libres → nettoyage SÉCURISÉ (volumes JAMAIS supprimés)..."
    docker builder prune -af || true
    docker image prune -f || true
    docker container prune -f || true
    ESPACE=$(df -P / | awk 'NR==2 {print $4}')
fi
if [ "$ESPACE" -lt 5242880 ]; then
    echo "❌ Moins de 5 Go libres. Mise à jour annulée pour protéger la base."
    exit 1
fi

# ────────────────────────────────────────────────────────────────
# 1. Récupération du code
# ────────────────────────────────────────────────────────────────
echo "📥 Récupération des modifications..."
echo "   ⚠️  git reset --hard écrase les corrections faites directement sur le VPS."
git fetch origin
git reset --hard origin/main

# ────────────────────────────────────────────────────────────────
# 2. Infrastructure d'abord (db + redis), sans Ollama
# ────────────────────────────────────────────────────────────────
echo "🗄️  Démarrage de db + redis..."
docker compose up -d db redis

echo "⏳ Attente de la base (max 90 s)..."
ETAT="absent"
for i in $(seq 1 18); do
    ETAT=$(docker inspect -f '{{.State.Health.Status}}' digiid_db 2>/dev/null || echo "absent")
    [ "$ETAT" = "healthy" ] && break
    echo "   ... état = $ETAT ($i/18)"
    sleep 5
done
if [ "$ETAT" != "healthy" ]; then
    echo "❌ Base non healthy. Logs :"
    docker compose logs --tail=40 db
    exit 1
fi
echo "   ✅ Base healthy"

# ────────────────────────────────────────────────────────────────
# 3. Backend : rebuild UNIQUEMENT si requirements.txt a changé
# ────────────────────────────────────────────────────────────────
echo "🔍 Vérification des dépendances backend..."
CURRENT_HASH=$(md5sum backend/requirements.txt | awk '{print $1}')
LAST_HASH_FILE=".last_requirements_hash"
LAST_HASH=""
[ -f "$LAST_HASH_FILE" ] && LAST_HASH=$(cat "$LAST_HASH_FILE")

BACKEND_REBUILT=0
NO_CACHE=""
[ "${FORCE_NO_CACHE:-0}" = "1" ] && NO_CACHE="--no-cache"

if [ "$CURRENT_HASH" != "$LAST_HASH" ] || [ "${FORCE_NO_CACHE:-0}" = "1" ]; then
    echo "⚠️  Dépendances modifiées → reconstruction du backend..."
    docker builder prune -f || true
    docker compose build $NO_CACHE backend worker_celery beat_celery
    echo "$CURRENT_HASH" > "$LAST_HASH_FILE"
    BACKEND_REBUILT=1
else
    echo "✅ Dépendances inchangées — pas de rebuild (gain de temps et de disque)."
fi

# ────────────────────────────────────────────────────────────────
# 4. Migrations Alembic (--no-deps : ne démarre PAS Ollama)
# ────────────────────────────────────────────────────────────────
echo "🗄️  Migrations Alembic..."
docker compose run --rm --no-deps backend alembic upgrade head \
    || echo "⚠️  Migrations échouées — vérifier : docker compose exec backend alembic heads"

# ────────────────────────────────────────────────────────────────
# 5. Backend : recréation si image OU .env a changé, sinon restart
# ────────────────────────────────────────────────────────────────
ENV_HASH=$(md5sum .env 2>/dev/null | awk '{print $1}') || ENV_HASH=""
LAST_ENV_HASH_FILE=".last_env_hash"
LAST_ENV_HASH=""
[ -f "$LAST_ENV_HASH_FILE" ] && LAST_ENV_HASH=$(cat "$LAST_ENV_HASH_FILE")

if [ "$BACKEND_REBUILT" = "1" ] || [ "$ENV_HASH" != "$LAST_ENV_HASH" ]; then
    echo "🔄 Nouvelle image ou .env modifié → recréation des conteneurs backend..."
    docker compose up -d --force-recreate --no-deps backend worker_celery beat_celery
    echo "$ENV_HASH" > "$LAST_ENV_HASH_FILE"
else
    echo "🔄 Redémarrage du backend + workers (code monté en volume)..."
    docker compose restart backend worker_celery beat_celery
fi

# ────────────────────────────────────────────────────────────────
# 6. Frontend : rebuild si les sources ont changé
# ────────────────────────────────────────────────────────────────
echo "🔍 Vérification des sources frontend..."
FRONT_HASH=$(find frontend -type f -print0 \
    | grep -zv -E '/(node_modules|\.next)/' \
    | sort -z | xargs -0 md5sum 2>/dev/null | md5sum | awk '{print $1}') || FRONT_HASH=""
LAST_FRONT_HASH_FILE=".last_frontend_hash"
LAST_FRONT_HASH=""
[ -f "$LAST_FRONT_HASH_FILE" ] && LAST_FRONT_HASH=$(cat "$LAST_FRONT_HASH_FILE")

if [ "${FORCER_FRONTEND:-0}" = "1" ] || [ "$FRONT_HASH" != "$LAST_FRONT_HASH" ]; then
    echo "🏗️  Sources frontend modifiées → reconstruction..."
    rm -rf frontend/.next 2>/dev/null || true
    docker builder prune -f || true
    docker compose build $NO_CACHE frontend
    docker compose up -d --force-recreate --no-deps frontend
    echo "$FRONT_HASH" > "$LAST_FRONT_HASH_FILE"
    echo "✅ Frontend reconstruit. Recharge le navigateur : Ctrl+Shift+R"
else
    echo "✅ Aucune modification frontend."
    echo "   (Forcer : FORCER_FRONTEND=1 ./update.sh)"
fi

# nginx (config rechargée si besoin)
docker compose up -d --no-deps nginx

# ────────────────────────────────────────────────────────────────
# 7. Health check (90 s : TensorFlow est lent à charger)
# ────────────────────────────────────────────────────────────────
echo "⏳ Vérification de la santé du backend (max 90 s)..."
OK=0
for i in $(seq 1 30); do
    if docker compose exec -T backend sh -c \
        'curl -sf http://localhost:8000/api/v1/sante-leger >/dev/null 2>&1 || \
         python -c "import urllib.request;urllib.request.urlopen(\"http://localhost:8000/api/v1/sante-leger\",timeout=5)" >/dev/null 2>&1'; then
        OK=1
        break
    fi
    echo "   ... démarrage ($i/30)"
    sleep 3
done

if [ "$OK" = "1" ]; then
    echo "✅ DigiID opérationnel !"
else
    echo "❌ Backend non joignable. Logs :"
    docker compose logs --tail=40 backend
fi

echo ""
echo "📋 État des services :"
docker compose ps --format "table {{.Names}}\t{{.Status}}"
echo ""
df -h / | tail -1