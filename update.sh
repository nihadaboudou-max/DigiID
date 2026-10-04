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
# 4. Backend — redémarrage (ou recréation si .env a changé)
# ────────────────────────────────────────────────────────────────
# ⚠️ Le code backend est monté en volume (./backend:/app) : un simple 'restart'
#    suffit pour le code. MAIS les variables d'environnement (.env) sont figées
#    à la CRÉATION du conteneur : 'restart' ne les recharge PAS.
#    (ex : ajouter SMTP_MOT_DE_PASSE pour que les emails d'invitation partent)
echo "🔍 Vérification du fichier .env..."
ENV_HASH=$(md5sum .env 2>/dev/null | awk '{print $1}') || ENV_HASH=""
LAST_ENV_HASH_FILE=".last_env_hash"
LAST_ENV_HASH=""
[ -f "$LAST_ENV_HASH_FILE" ] && LAST_ENV_HASH=$(cat "$LAST_ENV_HASH_FILE")

if [ "$ENV_HASH" != "$LAST_ENV_HASH" ]; then
    echo "🔄 .env modifié → recréation du backend pour recharger la configuration..."
    docker compose up -d --force-recreate backend
    echo "$ENV_HASH" > "$LAST_ENV_HASH_FILE"
else
    echo "🔄 Redémarrage du backend (code uniquement, .env inchangé)..."
    docker compose restart backend
fi

# ────────────────────────────────────────────────────────────────
# 5. Frontend — reconstruction AUTOMATIQUE si les sources ont changé
# ────────────────────────────────────────────────────────────────
# ⚠️ Le frontend tourne en build de PRODUCTION (Next.js standalone) :
#    le code React/TS est figé dans l'image Docker. Toute modification de
#    frontend/ exige donc : rebuild de l'image + RECRÉATION du conteneur.
#
# ⚠️⚠️ Un simple 'docker compose restart frontend' NE SUFFIT PAS : il relance
#    le conteneur existant, qui continue d'utiliser l'ANCIENNE image.
#    Il faut impérativement 'up -d --force-recreate frontend'.
echo "🔍 Vérification des sources frontend..."
FRONT_HASH=$(find frontend -type f -print0 \
    | grep -zv -E '/(node_modules|\.next)/' \
    | sort -z | xargs -0 md5sum 2>/dev/null | md5sum | awk '{print $1}') || FRONT_HASH=""
LAST_FRONT_HASH_FILE=".last_frontend_hash"
LAST_FRONT_HASH=""
[ -f "$LAST_FRONT_HASH_FILE" ] && LAST_FRONT_HASH=$(cat "$LAST_FRONT_HASH_FILE")

if [ "${FORCER_FRONTEND:-0}" = "1" ] || [ "$FRONT_HASH" != "$LAST_FRONT_HASH" ]; then
    echo "🏗️  Sources frontend modifiées → reconstruction de l'image..."
    docker compose build frontend
    # ⚠️ 'up -d --force-recreate' est OBLIGATOIRE (et non 'restart') :
    # sinon le conteneur repart avec l'ancienne image et le code reste inchangé.
    docker compose up -d --force-recreate frontend
    echo "$FRONT_HASH" > "$LAST_FRONT_HASH_FILE"
    echo "✅ Frontend reconstruit et conteneur recréé."
    echo "   Pensez à recharger le navigateur : Ctrl+Shift+R (cache JS)."
else
    echo "✅ Aucune modification frontend — reconstruction inutile."
    echo "   (Pour forcer malgré tout : FORCER_FRONTEND=1 ./update.sh)"
fi

# ────────────────────────────────────────────────────────────────
# 6. Vérification de santé (Health Check robuste)
# ────────────────────────────────────────────────────────────────
echo "⏳ Vérification de la santé du système..."

# On vérifie depuis l'intérieur du conteneur pour éviter les problèmes de ports exposés
# On tente jusqu'à 10 fois (20 secondes max) pour laisser le temps au backend de démarrer
for i in {1..10}; do
    if docker compose exec -T backend curl -s -f http://localhost:8000/api/v1/sante-leger > /dev/null 2>&1; then
        echo "✅ Système DigiID mis à jour avec succès et opérationnel !"
        break
    else
        if [ $i -eq 10 ]; then
            echo "❌ Attention : Le backend ne répond pas après 20 secondes."
            echo "   Consultez les logs avec : docker compose logs --tail=30 backend"
        else
            echo "⏳ Attente du démarrage du backend... (essai $i/10)"
            sleep 2
        fi
    fi
done

echo ""
echo "📋 Résumé de l'état des services :"
docker compose ps --format "table {{.Names}}\t{{.Status}}"