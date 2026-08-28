# Guide de déploiement DigiID (VPS + domaine + HTTPS)

## Architecture

```
 Internet ──> https://dynamiqueid.digital
                  │
            [ nginx (80/443) ]   ← reverse proxy + TLS (conteneur Docker)
              │              │
     /api/v1/* │              │ /*
              ▼              ▼
      backend:8000      frontend:3000
      (FastAPI)          (Next.js)
              │
        db / redis
```

Tout est **dans le dépôt** : config nginx (`nginx/default.conf.template`),
orchestration (`docker-compose.yml`), script de déploiement (`deploy.sh`).
Le **nom de domaine et les chemins de certificat sont centralisés dans `.env`**
(`DOMAINE`, `CHEMIN_CERTIFICAT_FULLCHAIN`, `CHEMIN_CERTIFICAT_CLE`).

---

## Prérequis (serveur)
- Docker + Docker Compose plugin
- Git
- Accès SSH au VPS (OVH ici)

---

## Configuration initiale (À FAIRE UNE SEULE FOIS)

### 1. Pointez le DNS
Créez un enregistrement **A** : `dynamiqueid.digital` → `IP_DU_SERVEUR` (ex. `152.228.141.69`).

### 2. Certificat SSL
Vérifiez où se trouve votre certificat existant sur le serveur :
```bash
grep -r ssl_certificate /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null
```
Si vous utilisez certbot / Let's Encrypt, le chemin standard est :
```
/etc/letsencrypt/live/dynamiqueid.digital/fullchain.pem
/etc/letsencrypt/live/dynamiqueid.digital/privkey.pem
```
Reportez ces chemins dans `.env` (`CHEMIN_CERTIFICAT_*`).

### 3. ⚠️ Arrêtez l'ancien nginx de l'HÔTE (conflit ports 80/443)
Le nginx Docker doit occuper les ports 80/443. Si un nginx système tourne encore :
```bash
sudo systemctl stop nginx
sudo systemctl disable nginx
```

### 4. Fichier d'environnement `.env`
Depuis la racine du dépôt :
```bash
# Le .env n'est PAS versionné (secrets). Le créer/éditer manuellement.
# Variables minimales requises :
DOMAINE=dynamiqueid.digital
CHEMIN_CERTIFICAT_FULLCHAIN=/etc/letsencrypt/live/dynamiqueid.digital/fullchain.pem
CHEMIN_CERTIFICAT_CLE=/etc/letsencrypt/live/dynamiqueid.digital/privkey.pem
POSTGRES_MOT_DE_PASSE=...
CLE_SECRETE_JWT=...
CLE_CHIFFREMENT_DONNEES=...
SEED_SUPER_ADMIN_MOT_DE_PASSE=...
```
> Les URLs (`URL_FRONTEND`, `ORIGINES_AUTORISEES`, `NEXT_PUBLIC_URL_BACKEND`…)
> se dérivent automatiquement de `DOMAINE` — plus aucune IP en dur.

---

## Déploiement

### ⚠️ Toujours via `tmux` (anti-coupure SSH)
Le build backend pèse plusieurs Go (TensorFlow). Une coupure SSH pendant
l'export de l'image interrompt tout (`client_loop: send disconnect: Connection reset`).
**tmux garde le déploiement vivant même si SSH saute :**
```bash
tmux new -s deploiement
cd ~/DigiID && ./deploy.sh
# se détacher : Ctrl+B puis D   (le déploiement continue)
# se rattacher : tmux attach -t deploiement
```

### Le script `deploy.sh` fait :
1. Vérifie `.env` et les ressources disque/mémoire (alerte < 5 Go libres)
2. `git fetch` + `git reset --hard origin/main`
3. Nettoie le cache Next.js
4. `docker compose build --progress plain --no-cache backend frontend`
5. `docker compose up -d`
6. Teste la config nginx (`nginx -t`) et affiche les logs
7. Affiche l'URL finale : `https://dynamiqueid.digital`

### Déploiement à la main (optionnel)
```bash
cd ~/DigiID
git fetch origin && git reset --hard origin/main
docker compose build --progress plain --no-cache backend frontend
docker compose up -d
docker exec digiid_nginx nginx -t
```

---

## Vérifications après déploiement
```bash
docker ps | grep digiid
curl -k https://dynamiqueid.digital/api/v1/sante-leger   # API
curl -I https://dynamiqueid.digital                      # Frontend (200)
docker logs digiid_backend --tail 20
docker logs digiid_nginx --tail 20
```

---

## Renouvellement du certificat (Let's Encrypt)
La zone `/.well-known/acme-challenge/` est servie par le nginx Docker
(dossier partagé `nginx/certbot`). Côté hôte :
```bash
sudo certbot certonly --webroot -w ~/DigiID/nginx/certbot -d dynamiqueid.digital
sudo docker exec digiid_nginx nginx -s reload
```
Le montage en lecture seule des `.pem` dans le conteneur reflète le nouveau
certificat automatiquement (fichiers relus au reload).

---

## Dépannage

### `client_loop: send disconnect: Connection reset` pendant le build
- **Cause** : la session SSH est tombée (build long, ~128 s rien que pour exporter
  l'image backend de plusieurs Go ; possible manque de RAM/disque).
- **Solutions** :
  1. Relancer dans `tmux` (voir plus haut).
  2. Garder la connexion vivante : `ssh -o ServerAliveInterval=30 -o ServerAliveCountMax=4 root@IP`.
  3. Libérer de la place : `docker system prune -af` ; vérifier `df -h` et `free -h`.

### `502 Bad Gateway` sur le domaine
- `docker ps` : les conteneurs `digiid_backend` / `digiid_frontend` sont-ils `Up` ?
- `docker logs digiid_backend --tail 50` : erreur de démarrage ?
- Vérifier `docker exec digiid_nginx nginx -t`.

### nginx ne démarre pas
- Vérifier que les chemins de certificat dans `.env` existent sur l'hôte :
  ```bash
  ls -l /etc/letsencrypt/live/dynamiqueid.digital/
  ```
- Vérifier qu'aucun autre processus n'occupe 80/443 (`sudo ss -ltnp | grep -E ':80|:443'`).

### CORS bloqué côté navigateur
- `ORIGINES_AUTORISEES` dans `.env` doit contenir `https://dynamiqueid.digital` (sans slash final).
- Après modification du `.env` : `docker compose up -d backend` (redémarrage).