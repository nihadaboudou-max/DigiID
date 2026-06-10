# Phases de développement DigiID — plan détaillé

## Vue d'ensemble

Le prototype est livré en 6 phases. Chaque phase produit un ensemble cohérent qui peut tourner indépendamment des suivantes.

---

## Phase 1 — Squelette + authentification (✅ livrée)

**Objectif** : poser les fondations techniques solides et l'authentification des trois rôles.

**Livraisons** :
- Arborescence complète du projet
- Configuration centralisée (Pydantic Settings + .env)
- Noyau : chiffrement Argon2id + AES-256-GCM, journal Loguru, exceptions personnalisées
- Modèles SQLAlchemy 2.0 : Utilisateur, Role, SessionAuthentification, JournalAudit, Consentement
- Migrations Alembic configurées
- Module authentification complet : inscription, connexion JWT, rafraîchissement, déconnexion
- Dépendances FastAPI pour contrôle d'accès : `utilisateur_courant`, `admin_courant`, `super_admin_courant`
- Trois espaces séparés : `/api/v1/utilisateur`, `/api/v1/admin`, `/api/v1/super-admin`
- Middlewares : CORS, headers sécurité (CSP, HSTS), journal des requêtes
- Gestionnaires d'erreurs uniformes
- Docker Compose : PostgreSQL + Redis + ChromaDB + Ollama + backend + worker Celery
- Script seed pour créer le super admin initial
- Tests unitaires du module chiffrement
- README et documentation architecture

---

## Phase 2 — Modules métier (à venir)

**Objectif** : implémenter les fonctionnalités utilisateur réelles.

**À livrer** :
- Module `profil` : consultation et modification du profil utilisateur (avec chiffrement transparent)
- Module `consentements` : gestion granulaire des consentements (RGPD-like)
- Module `scoring` : algorithme ML de calcul du score DigiID
  - Génération de données synthétiques (Faker)
  - Pipeline Pandas + Scikit-learn + XGBoost
  - Interprétabilité SHAP
  - Score 0-100 + facteurs explicatifs
- Module `monitoring` complet : métriques Prometheus, health checks profonds, alertes
- Tâches asynchrones Celery : envoi emails, recalcul périodique des scores
- Tests d'intégration end-to-end

---

## Phase 3 — Chatbot LangChain + RAG (à venir)

**Objectif** : chatbot personnalisé répondant aux questions sur l'application.

**À livrer** :
- Abstraction `FournisseurLLM` : Ollama (dev) / Groq (prod) / OpenRouter (fallback)
- Indexation des documents de l'application dans ChromaDB
- Index commun : documentation, FAQ, règles publiques
- Index personnel par utilisateur : ses propres documents
- Chaîne LangChain RAG : récupération + génération avec prompt système
- Mémoire conversationnelle persistante par session
- Endpoints API : poser une question, lister l'historique, effacer une conversation
- Protection : un utilisateur ne reçoit jamais les données d'un autre, même en injection

---

## Phase 4 — Sécurité avancée + reconnaissance faciale (à venir)

**Objectif** : 2FA réelle, détection de fraude active, vérification visuelle.

**À livrer** :
- 2FA TOTP réelle (Google Authenticator compatible) avec QR code
- Module `detection_fraude` :
  - Règles métier explicites (vélocité, géolocalisation, tentatives répétées)
  - Modèle ML Isolation Forest pour détecter les anomalies non vues par les règles
  - Score de risque calculé pour chaque action sensible
  - Blocage automatique au-dessus du seuil + alerte admin
- Module `verification_visuelle` :
  - Détection de visage (face_recognition / InsightFace)
  - Embedding facial 512 dimensions
  - Anti-spoofing (détection photo d'écran)
  - Détection de doublons dans la base DigiID
  - Comparaison aux listes officielles (OFAC, ONU, Interpol) — sous consentement
- Signature cryptographique des entrées d'audit (intégrité prouvable)

---

## Phase 5 — Frontend Next.js complet (à venir)

**Objectif** : interface utilisateur professionnelle pour les trois rôles.

**À livrer** :
- Next.js 14 + TypeScript + Tailwind + Zustand + React Query
- Espace `/` (utilisateur) :
  - Connexion / inscription
  - Tableau de bord
  - Profil
  - Score DigiID
  - Chatbot
  - Paramètres + consentements
- Espace `/admin` (administrateur) :
  - Tableau de bord
  - Gestion utilisateurs (pseudonymisée)
  - Consultation alertes
  - Statistiques
- Espace `/super-admin` (super administrateur) :
  - Tableau de bord technique
  - Gestion administrateurs
  - Journal d'audit complet
  - Configuration système
- Internationalisation FR / Wolof / Fon (i18next)
- Charte graphique Terre & Lagune appliquée partout
- Composants accessibles WCAG 2.1 AA

---

## Phase 6 — Déploiement + monitoring complet (à venir)

**Objectif** : prototype en ligne, accessible, monitoré.

**À livrer** :
- Configuration Docker production (multi-stage, image légère)
- Stack monitoring : Prometheus + Grafana + Loki + Sentry
- Dashboards Grafana : métriques système, métriques métier, alertes
- Pipeline CI/CD GitHub Actions : tests + lint + build + déploiement
- Déploiement sur Render / Railway (free tier pour démarrer)
- Configuration Nginx + Let's Encrypt
- Bascule Ollama → Groq via variable d'environnement
- Scripts de sauvegarde automatique de la base
- Politique de rétention automatique (purge programmée)
- Documentation DEPLOIEMENT.md détaillée
