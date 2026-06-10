# 🚀 Guide de migration Phase 5 → Super Admin amélioré

Ce document guide le processus de déploiement des améliorations super admin.

---

## 📋 Prérequis

Avant de commencer, vérifier que vous avez :

- [ ] Node.js 18+ installé
- [ ] Python 3.11+ pour le backend
- [ ] Docker et Docker Compose
- [ ] Git avec permissions push
- [ ] Accès à la branche `develop` ou `main`
- [ ] Tests en local qui passent

---

## 🔄 Étapes de migration

### Phase 1 : Préparation (1 jour)

#### 1.1 Créer une branche de travail
```bash
cd digiid
git checkout develop
git pull origin develop
git checkout -b feature/super-admin-phase5
```

#### 1.2 Copier les nouveaux fichiers frontend

```bash
# Pages créées
cp frontend/src/app/super-admin/administrateurs/[id]/page.tsx \
   frontend/src/app/super-admin/administrateurs/[id]/page.tsx

cp frontend/src/app/super-admin/administrateurs/[id]/sessions/page.tsx \
   frontend/src/app/super-admin/administrateurs/[id]/sessions/page.tsx

cp frontend/src/app/super-admin/tableau-de-bord/page-new.tsx \
   frontend/src/app/super-admin/tableau-de-bord/page.tsx

cp frontend/src/app/super-admin/audit/page-v2.tsx \
   frontend/src/app/super-admin/audit/page.tsx

cp frontend/src/app/super-admin/configuration/page-new.tsx \
   frontend/src/app/super-admin/configuration/page.tsx

cp frontend/src/app/super-admin/statistiques/page.tsx \
   frontend/src/app/super-admin/statistiques/page.tsx

# Services
cp frontend/src/services/super_admin_v2.ts \
   frontend/src/services/super_admin_v2.ts

# Composants
cp frontend/src/composants/commun/ModalConfirmation.tsx \
   frontend/src/composants/commun/ModalConfirmation.tsx
```

#### 1.3 Installer les dépendances
```bash
cd frontend
npm install
cd ../backend
pip install -r requirements.txt
```

#### 1.4 Valider la structure des fichiers
```bash
# Frontend
ls -la frontend/src/app/super-admin/
ls -la frontend/src/services/
ls -la frontend/src/composants/commun/

# Backend
ls -la backend/src/modules/super_admin/
```

---

### Phase 2 : Tests locaux (2 jours)

#### 2.1 Démarrer les services Docker

```bash
cd infrastructure
docker compose up -d

# Vérifier que tout est OK
docker compose ps
docker compose logs -f backend
```

#### 2.2 Tester le frontend

```bash
cd frontend
npm run dev

# Aller à http://localhost:3000/super-admin/tableau-de-bord
# Vérifier chaque page :
# - Tableau de bord
# - Administrateurs (liste)
# - Administrateur (détails) — si backend prêt
# - Audit
# - Configuration
# - Statistiques
```

#### 2.3 Valider les pages

**Pages à tester** :

```
✓ /super-admin/tableau-de-bord
  - KPI affichés correctement
  - Graphiques remplis (barres répartition)
  - Derniers événements affichés
  
✓ /super-admin/administrateurs
  - Liste avec recherche
  - Boutons "Voir"
  - Boutons "Suspendre/Réactiver"
  - Création nouveau admin (modale)
  
✓ /super-admin/administrateurs/{id}
  - Affichage détails (si API implémentée)
  - Formulaire édition (désactivé Phase 5)
  - Boutons sécurité (désactivés Phase 5)
  
✓ /super-admin/administrateurs/{id}/sessions
  - Liste sessions (si API implémentée)
  - Boutons révocation (désactivés Phase 5)
  
✓ /super-admin/audit
  - Filtrage par type
  - Filtrage par dates
  - Recherche textuelle
  - Pagination (50 par page)
  - Reset filtres
  
✓ /super-admin/configuration
  - Affichage paramètres système
  - Feature flags par phase
  - Roadmap visible
  
✓ /super-admin/statistiques
  - Graphiques barres
  - Indicateurs santé
  - Recommandations
```

#### 2.4 Tester avec les données de développement

```bash
# Créer un super admin de test
cd backend
python -c "
from src.base_donnees.seed import creer_super_admin
import asyncio
asyncio.run(creer_super_admin(
    email='test@digiid.africa',
    mot_de_passe='TestPassword123!'
))
"

# Se connecter avec test@digiid.africa
```

---

### Phase 3 : Intégration API (3 jours) — Backend

Cette phase dépend de l'implémentation des endpoints.

#### 3.1 Endpoints à créer (Backend)

**Routes nouvelles** dans `backend/src/modules/super_admin/routes.py` :

```python
# Détails d'un administrateur
@routeur_super_admin.get("/administrateurs/{admin_id}")
async def obtenir_admin_detail(admin_id: UUID, ...):
    """Retourne les détails complets d'un admin."""
    pass

# Sessions actives
@routeur_super_admin.get("/administrateurs/{admin_id}/sessions")
async def lister_sessions_admin(admin_id: UUID, ...):
    """Retourne les sessions actives d'un admin."""
    pass

# Audit avec pagination
@routeur_super_admin.get("/audit")
async def lister_audit(page: int = 1, limite: int = 50, ...):
    """Retourne les événements d'audit avec pagination."""
    pass

# Statistiques
@routeur_super_admin.get("/statistiques")
async def obtenir_statistiques(...):
    """Retourne les statistiques détaillées."""
    pass
```

#### 3.2 Mettre à jour les services

Dans `backend/src/modules/super_admin/service.py` :

```python
async def obtenir_admin_detail(session, admin_id):
    """Récupère un admin avec tous ses détails."""
    pass

async def lister_sessions_admin(session, admin_id):
    """Liste les sessions actives d'un admin."""
    pass

async def lister_audit(session, page=1, limite=50, filtres=None):
    """Audit avec pagination et filtres."""
    pass
```

#### 3.3 Tester les endpoints

```bash
# Avec curl
curl -H "Authorization: Bearer {token}" \
     http://localhost:8000/api/v1/super-admin/audit?page=1&limite=50

# Ou accéder à /docs pour Swagger
http://localhost:8000/docs
```

---

### Phase 4 : Connecter frontend ↔ backend (2 jours)

#### 4.1 Mettre à jour `super_admin_v2.ts`

Remplacer les `TODO` par des appels API réels :

```typescript
// Avant (placeholder)
export const obtenirAdminDetail = (adminId: string) =>
  clientAPI.get<AdminDetail>(`${PREFIXE}/administrateurs/${adminId}`, 
    { authentifie: true });

// Après (fonctionnel)
export const obtenirAdminDetail = (adminId: string) =>
  clientAPI.get<AdminDetail>(
    `${PREFIXE}/administrateurs/${adminId}`, 
    { authentifie: true }
  );
```

#### 4.2 Implémenter la page détails

Dans `frontend/src/app/super-admin/administrateurs/[id]/page.tsx` :

```typescript
// Avant
const charger = async () => {
  const reponse = await listerAdmins();
  const found = reponse.administrateurs.find((a) => a.id === adminId);
  setAdmin(found);
};

// Après (avec API dédiée)
const charger = async () => {
  const detail = await obtenirAdminDetail(adminId);
  setAdmin(detail);
};
```

#### 4.3 Tester chaque interaction

```
✓ Charger un admin → vérifier les détails
✓ Cliquer "Suspendre" → vérifier la modale + action
✓ Cliquer "Réactiver" → vérifier la modale + action
✓ Chercher audit → vérifier le filtrage
✓ Changer page audit → vérifier pagination
```

---

### Phase 5 : Tests complets (2 jours)

#### 5.1 Tests unitaires frontend

```bash
cd frontend
npm run test

# Ou avec coverage
npm run test -- --coverage
```

#### 5.2 Tests d'intégration

```bash
# E2E avec Cypress (si configuré)
npm run cypress:open

# Ou Playwright
npm run test:e2e
```

#### 5.3 Tests de sécurité

```
✓ Non-super-admin ne peut pas accéder à /super-admin/*
✓ Super-admin ne peut pas se suspendre soi-même
✓ Chaque action tracée dans l'audit
✓ Pas de fuites de données sensibles
✓ Rate limiting fonctionne
```

#### 5.4 Tests de performance

```bash
# Auditer 1000 événements — pagination OK ?
# Recharger la page 100 fois — pas de lag ?
# Filtrer sur 10000 événements — temps réponse < 2s ?
```

---

### Phase 6 : Préparation production (1 jour)

#### 6.1 Créer les variables d'environnement prod

**`.env` production** :
```bash
ENVIRONNEMENT=production
FOURNISSEUR_LLM=groq
ACTIVER_METRIQUES_PROMETHEUS=true
ACTIVER_2FA_OBLIGATOIRE_ADMIN=true
```

#### 6.2 Build production

```bash
# Frontend
cd frontend
npm run build
npm run start

# Vérifier que rien ne casse
curl http://localhost:3000/super-admin/tableau-de-bord
```

#### 6.3 Migrer la base de données (si nécessaire)

```bash
cd backend
alembic revision --autogenerate -m "phase5_super_admin"
alembic upgrade head
```

#### 6.4 Préparer le rollback

```bash
# Garder la version précédente
git tag v4.0.0-before-phase5
git push origin v4.0.0-before-phase5
```

---

### Phase 7 : Déploiement (1 jour)

#### 7.1 Déploiement en staging

```bash
# Pusher la branche
git push origin feature/super-admin-phase5

# Créer une PR
# Faire la revue de code
# Merger dans develop

# Déployer en staging
ssh staging-server
cd /var/www/digiid
git pull origin develop
docker compose up -d --build
docker compose logs -f backend frontend

# Tester en staging
# http://staging.digiid.africa/super-admin/tableau-de-bord
```

#### 7.2 Déploiement en production

```bash
# Après validation staging (24h minimum)
# Créer une PR develop → main
# Revue finale
# Merger

# Production
ssh prod-server
cd /var/www/digiid
git pull origin main
docker compose up -d --build

# Santé checks
curl http://digiid.africa/api/v1/sante
curl http://digiid.africa/super-admin/tableau-de-bord

# Vérifier les logs
docker compose logs -f --tail=100
```

#### 7.3 Notification utilisateurs

Email au super admin :
```
Sujet : DigiID v5.0 — Super Admin amélioré 🚀

Cher super administrateur,

Nous avons déployé les améliorations Phase 5 :
- Page détails administrateur
- Gestion des sessions
- Audit avec pagination
- Tableau de bord visuel
- Statistiques détaillées

Voir le guide complet : [lien]
Support : support@digiid.africa
```

---

## 🔄 Rollback (en cas de problème)

```bash
# Revert le merge
git revert -m 1 {commit-hash}
git push origin main

# Redéployer
docker compose down
git checkout v4.0.0-before-phase5
docker compose up -d --build

# Notifier le team
```

---

## ✅ Checklist déploiement

### Avant le déploiement
- [ ] Tous les tests passent
- [ ] Code review approuvé
- [ ] Pas de secrets dans le code
- [ ] Documentation mise à jour
- [ ] Version API incrémentée
- [ ] CHANGELOG complété

### Pendant le déploiement
- [ ] Monitoring activé
- [ ] Personne disponible pour supporter
- [ ] Slack #incidents actif
- [ ] DB backup fait
- [ ] Rollback testé

### Après le déploiement
- [ ] Smoke tests passent
- [ ] Logs d'erreur vérifiés
- [ ] Performance acceptable
- [ ] Utilisateurs notifiés
- [ ] Documentation actualisée

---

## 📊 Métriques de succès

Après déploiement, vérifier :

```
✓ Uptime : 99.9%+
✓ Temps de réponse moyen : < 200ms
✓ 0 erreur 500 (sauf bugs backend)
✓ Taux d'adoption super admin : 100%
✓ Pas de régression UI/UX
✓ Tous les KPI visibles et exacts
```

---

## 📝 Documentation mise à jour

Après déploiement, générer :

- [ ] `CHANGELOG.md` — Résumé des changements
- [ ] `API.md` — Nouveaux endpoints
- [ ] `SUPER_ADMIN_GUIDE_UTILISATEUR.md` — Guide final
- [ ] `SCREENSHOT_BEFORE_AFTER.md` — Comparaison visuelle

---

## 🎓 Apprentissages

### Qu'on a appris
- ✓ Structure Next.js scalable
- ✓ Services API en TypeScript
- ✓ Composants réutilisables
- ✓ Pagination et filtrage côté client
- ✓ Design system cohérent

### Points d'amélioration
- Ajouter des tests automatisés
- Documenter les API avec OpenAPI
- Mettre en cache les requêtes
- Optimiser les images
- Ajouter des graphiques interactifs

---

## 🚀 Prochaines étapes (Phase 6)

- [ ] Implémenter les endpoints backend manquants
- [ ] Ajouter les graphiques (recharts)
- [ ] Exporter en CSV/JSON
- [ ] Modification feature flags en temps réel
- [ ] Réinitialiser mot de passe admin
- [ ] Gestion du 2FA

---

**Déploiement estimé** : 1 semaine complète
**Équipe nécessaire** : 2-3 développeurs + 1 DevOps
**Risque** : Faible (surtout du frontend, backend statique)
