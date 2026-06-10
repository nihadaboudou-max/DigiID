# Architecture DigiID — Document de référence

## Principes directeurs

### 1. Séparation des préoccupations
Chaque module a une responsabilité unique et bien définie. Le code de logique métier (services) ne dépend pas du framework web. Les routes ne contiennent pas de logique métier — elles orchestrent.

### 2. Trois rôles strictement isolés
**Utilisateur**, **Administrateur**, **Super Administrateur** ont chacun :
- Leur propre préfixe d'URL (`/utilisateur`, `/admin`, `/super-admin`)
- Leurs propres middlewares d'autorisation
- Leurs propres endpoints
- Leur propre interface (frontend)

Aucun chevauchement. Un utilisateur qui essaie d'appeler un endpoint admin reçoit 403, même avec un token valide.

### 3. Sécurité multi-couches
La sécurité n'est pas une couche, c'est une discipline appliquée partout :
- **Mots de passe** : Argon2id (jamais en clair, jamais MD5/SHA1)
- **Données personnelles** : chiffrées avant insertion en base (AES-256-GCM)
- **Communications** : TLS 1.3
- **Jetons** : JWT courte durée + refresh rotatif
- **Audit** : append-only, signature cryptographique
- **Détection de fraude** : règles + ML, score de risque par action

### 4. Tout en français
Variables, fonctions, classes, commentaires, dossiers. Cohérence linguistique pour qu'un mémoire en français reste lisible bout en bout.

### 5. Aucun secret en dur
Toutes les valeurs sensibles (clés, mots de passe DB, API keys) passent par `.env`, lu une seule fois par Pydantic Settings.

### 6. Scalabilité préparée dès le début
- Stateless : l'API peut tourner en N instances derrière un load balancer
- Sessions : stockées en base (PostgreSQL), pas en mémoire
- Cache : Redis partagé entre instances
- File de tâches : Celery + Redis pour les traitements asynchrones
- Migrations : Alembic versionnées dans Git

## Flux d'une requête typique

```
1. Client envoie : POST /api/v1/auth/connexion
                   Authorization: Bearer <token>

2. → Middleware CORS (autorisation d'origine)
3. → Middleware HeadersSecurite (CSP, HSTS, etc.)
4. → Middleware JournalRequetes (génère request_id, logue)
5. → Limiteur de débit (slowapi)
6. → Route /connexion → Dépendance obtenir_session() → AsyncSession SQLAlchemy
7. → Service authentifier_utilisateur() (logique métier pure)
8. → Modèles : SELECT Utilisateur WHERE email_hash = ...
9. → Chiffrement : vérifier_mot_de_passe()
10. → Audit : enregistrer dans JournalAudit
11. → Réponse JSON typée (UtilisateurReponse + JetonsReponse)
12. ← Middleware ajoute X-Request-ID au header
13. ← Middleware logue la sortie avec durée
14. ← Client reçoit la réponse
```

## Bases de données

### PostgreSQL — données structurées
- `utilisateur` : tous les comptes (tous rôles)
- `role` : référentiel des rôles
- `session_authentification` : sessions actives (un par appareil connecté)
- `journal_audit` : événements immuables (1 an de rétention)
- `consentement` : consentements RGPD-like, datés et versionnés

### Redis — éphémère
- Cache des objets lus fréquemment
- Sessions volatiles
- File Celery
- Compteurs de rate limiting

### ChromaDB — vectoriel
- Index vectoriel partagé `chat_savoir_commun` (documentation, FAQ)
- Index par utilisateur `chat_user_<uuid>` (données privées du chatbot)

## Évolution prévue

**Phase 2** : modules profil, scoring (ML), monitoring (Prometheus, alertes).

**Phase 3** : chatbot avec LangChain — chaîne RAG, mémoire conversationnelle, séparation des index personnels et communs.

**Phase 4** : module reconnaissance faciale (InsightFace), comparaison embeddings, listes de personnes recherchées, détection deepfake.

**Phase 5** : frontend Next.js complet avec trois espaces séparés.

**Phase 6** : déploiement (VPS ou Render/Railway pour le free tier), monitoring complet, scripts de sauvegarde.
