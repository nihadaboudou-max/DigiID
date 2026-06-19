# DigiID — Accès au prototype & Scénario utilisateur

> Document destiné au correcteur du mémoire  
> **ABOUDOU TRAORE Nihad** — Mastère Stratégie Digitale — ISM Dakar 2025-2026  
> *Système d'Identité Numérique Africaine par Big Data*

---

## 1. Accès au prototype

### 1.1. URLs

| Composant   | URL locale (dev)                    | URL déployée (Render)                     |
|-------------|-------------------------------------|-------------------------------------------|
| **Frontend** | `http://localhost:3000`             | `https://digiid-frontend.onrender.com`    |
| **Backend API** | `http://localhost:8000`             | `https://digiid-backend.onrender.com`     |
| **Swagger (docs API)** | `http://localhost:8000/docs`  | `https://digiid-backend.onrender.com/docs` |
| **Redoc (docs alternatives)** | `http://localhost:8000/redoc` | `https://digiid-backend.onrender.com/redoc` |
| **Health check** | `http://localhost:8000/api/v1/sante` | `https://digiid-backend.onrender.com/api/v1/sante` |

### 1.2. Identifiants de connexion

#### Super Administrateur (accès complet au système)

| Champ         | Valeur                    |
|---------------|---------------------------|
| **Email**     | `admin@digiid.africa`     |
| **Mot de passe** | `Admin@DigiID2025!`    |

> ⚠️ **Note importante** : La 2FA (authentification à deux facteurs) est **désactivée par défaut** pour le super administrateur, afin de faciliter la démonstration. En production, elle serait obligatoire. Une fois connecté, le super admin peut l'activer depuis son profil.

#### Comptes de démonstration supplémentaires

Lors de l'évaluation, vous pouvez créer des comptes de test via la page d'inscription (`/inscription`) pour tester les différents rôles. Le système supporte 7 rôles :

| Rôle                    | Espace URL                 | Description                                    |
|-------------------------|----------------------------|------------------------------------------------|
| **Citoyen** (défaut)    | `/tableau-de-bord`         | Utilisateur standard DigiID                     |
| **Agent**               | `/agent/dashboard`         | Agent d'administration publique                 |
| **Médecin**             | `/medecin`                 | Professionnel de santé habilité                 |
| **Police**              | `/police`                  | Forces de l'ordre                               |
| **ONG**                 | `/ong`                     | Organisation non gouvernementale partenaire     |
| **Administrateur**      | `/admin`                   | Administrateur système (vue pseudonymisée)      |
| **Super Administrateur**| `/super-admin/tableau-de-bord` | Accès complet au système                     |

---

## 2. Démarrage en local (si le déploiement Render est inactif)

```powershell
# Depuis la racine du projet DigiID

# 1. Lancer tous les services Docker
.\lancer_digiid.ps1

# 2. Dans un second terminal, lancer le frontend
cd frontend
npm run dev

# 3. Ouvrir http://localhost:3000 dans le navigateur
```

---

## 3. Scénario utilisateur guidé

Ce scénario parcourt les fonctionnalités principales du prototype, dans l'ordre logique pour un correcteur.

---

### 🟢 Étape 1 : Découverte de la page d'accueil

**Action** : Ouvrir le frontend (`http://localhost:3000` ou l'URL Render).

**Ce qui s'affiche** :
- La page d'accueil avec le **pitch** du projet : *"Ton téléphone devient ton identité"*
- Les **chiffres clés** : 540M de personnes sans identité, 1/3 des enfants non enregistrés...
- Les **4 étapes** expliquant le fonctionnement : Inscription → Consentement → Calcul → Usage
- Un **exemple de score** (76/100) avec ses facteurs (ancienneté SIM, régularité Wave, etc.)

**Boutons disponibles** : *"Créer mon DigiID"* et *"J'ai déjà un compte"*.

---

### 🟢 Étape 2 : Inscription d'un nouveau citoyen

**Action** : Cliquer sur **"Créer mon DigiID"**.

**Formulaire à remplir** :
- **Prénom** : ex. `Amadou`
- **Nom** : ex. `Diallo`
- **Email** : (un email valide pour recevoir le code de vérification, ou utiliser `amadou@test.com`)
- **Téléphone** (facultatif) : ex. `+221 77 123 45 67`
- **Mot de passe** : minimum 12 caractères (ex. `Test@DigiID2025!`)
- **Ville** : ex. `Dakar`
- **Code de parrainage** : laisser vide (facultatif)
- **CGU** : cocher la case d'acceptation

**Action** : Cliquer sur **"Créer mon compte"**.

**Résultat attendu** :
- ✅ Message de succès *"Compte créé !"*
- ✅ Affichage du **DigiID public** (identifiant unique de 16 caractères)
- ✅ Redirection automatique vers la page de **vérification d'identité**

---

### 🟢 Étape 3 : Vérification de l'identité (email)

**Action** : Sur la page `/verification`, un code à 6 chiffres est envoyé par email.

> 💡 **En mode développement** : Le code de vérification s'affiche directement dans l'interface (encadré orange "Mode développement"). Cela évite d'avoir à configurer un serveur SMTP.

**Action** : Saisir le code à 6 chiffres et cliquer sur **"Confirmer mon email"**.

**Résultat attendu** :
- ✅ *"Email confirmé !"*
- ✅ Passage à l'étape 2 (vérification téléphone)

**Action** : Cliquer sur **"Passer pour l'instant"** (ou vérifier le téléphone de la même manière).

---

### 🟢 Étape 4 : Découverte du tableau de bord utilisateur

**Action** : Se rendre sur `/tableau-de-bord` (ou cliquer sur *"Accéder à mon espace"*).

**Ce qui s'affiche** :
- **Identité civile** : prénom, nom, email, téléphone, ville (modifiable)
- **Identifiant DigiID** : code unique de 16 caractères partageable
- **État du compte** : statut Actif, rôle Citoyen, email vérifié, 2FA désactivée
- **Mes vérifications d'identité** : email, téléphone, CNI, reconnaissance faciale
- **Actions possibles** : modifier le profil, exporter ses données, gérer les consentements, supprimer le compte

---

### 🟢 Étape 5 : Consultation du score DigiID

**Action** : Aller sur `/score`.

**Ce qui s'affiche** :
- **Niveau de confiance** : *Débutant* / *Établi* / *Fiable* / *Expert*
- **Jauge de progression** visuelle vers le niveau supérieur
- **Décomposition par facteurs** :
  - Ancienneté SIM
  - Régularité des transactions mobile money
  - Stabilité géographique
  - Réseau de contacts
  - Attestations communautaires (bonus)
- **Interprétation** du niveau actuel
- **Conseils personnalisés** pour améliorer son score

**Action** : Cliquer sur **"Recalculer maintenant"** pour déclencher un nouveau calcul en temps réel.

---

### 🟢 Étape 6 : Gestion des consentements

**Action** : Aller sur `/consentements`.

**Ce qui s'affiche** :
- Liste des catégories de données avec interrupteurs :
  - Données d'identité (obligatoire)
  - Données de localisation
  - Données de transactions
  - Données biométriques
  - Partage avec les partenaires
- Possibilité d'activer/désactiver chaque consentement facultatif
- Texte légal complet pour chaque catégorie

**Action** : Basculer un consentement facultatif pour voir la notification de confirmation.

---

### 🟢 Étape 7 : Espace Super Administrateur

> 🔐 Cette étape nécessite de se déconnecter du compte citoyen, puis de se connecter avec le super administrateur.

**Action** :
1. Aller sur `/connexion`
2. Se connecter avec : `admin@digiid.africa` / `Admin@DigiID2025!`
3. Vous êtes redirigé vers `/super-admin/tableau-de-bord`

**Ce qui s'affiche** (tableau de bord super admin) :
- **KPIs en haut** : nombre d'utilisateurs, actifs, 2FA activée, sessions, audits du jour
- **Cartes technologiques** rectangulaires pour chaque module :
  - 👤 Administrateurs (CRUD, RBAC, Sessions)
  - 🛡️ Gestion des droits (matrice RBAC complète)
  - 🎛️ Matrice des droits UI (modules par rôle)
  - 📊 Statistiques système (métriques, KPIs, CSV)
  - 📜 Journal d'audit (traçabilité immuable)
  - ⚙️ Configuration système (feature flags)
  - 📸 Reconnaissance faciale (vérification visuelle)
  - 🪪 OCR & CNI (scan de documents)
  - 👤 Mon profil (sécurité, export)

**Actions possibles depuis le super admin** :
- **Gestion des administrateurs** (`/super-admin/administrateurs`) : créer, suspendre, réactiver
- **Gestion des droits** (`/super-admin/droits`) : configurer la matrice RBAC
- **Journal d'audit** (`/super-admin/audit`) : consulter l'historique immuable
- **Statistiques** (`/super-admin/statistiques`) : métriques détaillées
- **Configuration** (`/super-admin/configuration`) : basculer les feature flags
- **Monitoring** (`/super-admin/monitoring`) : santé du système

---

### 🟢 Étape 8 (optionnelle) : Autres fonctionnalités remarquables

| Fonctionnalité | URL | Description |
|---|---|---|
| **Chatbot** | `/chatbot` | Assistant IA basé sur les documents uploadés (RAG) |
| **Documents** | `/documents` | Upload de PDF/TXT/MD pour enrichir le chatbot |
| **Badges & Gamification** | `/badges` | Système de badges, streak, parrainage |
| **Recommandations** | `/recommandations` | Suggestions personnalisées |
| **Notifications** | `/notifications` | Centre de notifications en temps réel |
| **Historique** | `/historique` | Traçabilité des actions |
| **Partage d'identité** | `/partage` | Partager son DigiID avec un tiers |
| **Parrainage** | `/parrainage` | Programme de parrainage |
| **Vérification CNI** | `/verification-cni` | Scan et OCR de carte d'identité |
| **Vérification visuelle** | `/verification-visuelle` | Reconnaissance faciale |
| **Vérification email** | `/verification-email` | Vérification email |
| **CGU** | `/cgu` | Conditions générales |
| **Confidentialité** | `/confidentialite` | Politique de confidentialité |

---

## 4. Résumé des scénarios par rôle

| Rôle | Parcours recommandé |
|------|---------------------|
| **Citoyen** | Inscription → Vérification → Profil → Score → Consentements → Documents → Chatbot |
| **Super Admin** | Connexion admin → Tableau de bord → Gestion utilisateurs → Droits → Audit → Statistiques |
| **Administrateur** | Connexion admin → Tableau de bord → Statistiques agrégées → Modération attestations |
| **Agent** | Connexion agent → Dashboard → Recherche citoyens → Vérifications |
| **Médecin** | Connexion médecin → Dossier médical → Recherche patient |
| **Police** | Connexion police → Recherche identité → Vérification |
| **ONG** | Connexion ONG → Programmes → Recherche bénéficiaires |

---

## 5. API Backend (pour test technique)

Les endpoints clés de l'API sont documentés via Swagger :

| Endpoint | Description | Documentation |
|---|---|---|
| `POST /api/v1/auth/connexion` | Connexion | `POST /api/v1/auth/connexion` (Swagger) |
| `POST /api/v1/auth/inscription` | Inscription | (Swagger) |
| `POST /api/v1/auth/rafraichir` | Rafraîchir token | (Swagger) |
| `GET /api/v1/auth/moi` | Profil connecté | (Swagger) |
| `GET /api/v1/sante` | Santé du système | (Swagger) |
| `GET /api/v1/super-admin/tableau-de-bord` | Stats super admin | (Swagger) |

---

*Document rédigé pour accompagner la correction du prototype DigiID.*  
*Avril 2025 — Mastère Stratégie Digitale — ISM Dakar*
