#!/bin/bash
set -e  # Arrêter en cas d'erreur

# ⚠️ IMPORTANT — couper la connexion SSH ne doit PAS interrompre le déploiement :
#   tmux new -s deploiement        # lancer une session persistante
#   ./deploy.sh                    # exécuter le script DANS la session
#   Ctrl+B puis D                  # se détacher (le déploiement continue)
#   tmux attach -t deploiement     # se rattacher pour voir la fin

cd ~/DigiID

# ────────────────────────────────────────────────────────────────
# Pré-vol : vérifier que tout est en place AVANT de lancer le build
# (le build backend pèse plusieurs Go — mieux vaut échouer tôt)
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

# Alerte si moins de 5 Go libres (l'image backend ~6 Go doit tenir)
# df -P renvoie des blocs de 1 Ko → 5 Go = 5*1024*1024 = 5242880 blocs
ESPACE_LIBRE_BLOCS=$(df -P / | awk 'NR==2 {print $4}')
if [ -n "$ESPACE_LIBRE_BLOCS" ] && [ "$ESPACE_LIBRE_BLOCS" -lt 5242880 ] 2>/dev/null; then
    echo "⚠️  Espace disque faible (< 5 Go). Nettoyage Docker recommandé :"
    echo "    docker system prune -af"
fi

echo "🔄 Récupération des dernières modifications..."
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
# --progress plain : logs en flux continu (évite l'impression de blocage SSH)
# --no-cache force une reconstruction propre sans utiliser le cache Docker
docker compose build --progress plain --no-cache backend frontend

# Vérifier que les ports 80/443 sont libres AVANT de démarrer nginx Docker
# (sinon : "failed to bind host port 0.0.0.0:80/tcp: address already in use")
for PORT in 80 443; do
    if ss -ltn 2>/dev/null | grep -q ":$PORT "; then
        echo "❌ Le port $PORT est déjà occupé sur l'hôte."
        echo "   → Identifier le processus : sudo ss -ltnp | grep :$PORT"
        echo "   → Si c'est l'ancien nginx système, l'arrêter définitivement :"
        echo "       sudo systemctl stop nginx && sudo systemctl disable nginx"
        echo "   → Puis relancer : ./deploy.sh"
        exit 1
    fi
 done

echo "🚀 Démarrage des services (db, redis, backend, frontend, nginx)..."
docker compose up -d

echo "⏳ Attente du démarrage..."
sleep 30

echo "✅ Vérification des conteneurs..."
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep digiid

echo "🔍 Test de la configuration nginx..."
if docker exec digiid_nginx nginx -t 2>&1; then
    echo "   ✅ nginx config valide"
else
    echo "   ❌ nginx config INVALIDE — vérifier le certificat et le template"
fi

echo ""
echo "📋 Logs backend (dernières lignes) :"
docker logs digiid_backend --tail 10
echo ""
echo "📋 Logs frontend (dernières lignes) :"
docker logs digiid_frontend --tail 10

DOMAINE_FINAL=${DOMAINE_VAR:-dynamiqueid.digital}
echo ""
echo "🎉 Déploiement terminé !"
echo "   ➜  https://${DOMAINE_FINAL}"
echo "   ➜  Santé API : https://${DOMAINE_FINAL}/api/v1/sante-leger"