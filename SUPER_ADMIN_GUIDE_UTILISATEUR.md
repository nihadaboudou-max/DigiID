# 📖 Guide d'utilisation — Super administrateur DigiID

Bienvenue ! Ce guide vous aide à maîtriser toutes les fonctionnalités de l'espace super administrateur.

---

## 🔐 Accès et sécurité

### Se connecter
1. Aller à `https://digiid.local/connexion` (ou l'URL de votre déploiement)
2. Entrer votre email et mot de passe
3. **Obligatoire** : Entrer votre code 2FA (6 chiffres depuis votre authenticator)
4. Cliquer "Se connecter"

### Points importants
- ⚠️ Le 2FA est **obligatoire** pour tous les super administrateurs
- 🔒 Vos actions sont tracées de manière immuable dans le journal d'audit
- 🚫 Vous ne pouvez pas vous auto-suspendre ni vous auto-supprimer
- 📍 Chaque connexion est enregistrée avec IP et User-Agent

---

## 📊 Tableau de bord

**Accès** : `/super-admin/tableau-de-bord` (page par défaut)

### Qu'y voir ?

#### 1. KPI en haut (5 cartes)
```
👥 Utilisateurs        — Nombre total d'utilisateurs dans le système
✓ Actifs              — Utilisateurs avec au moins une activité récente
🔐 2FA                — Utilisateurs ayant activé la double authentification
✉️ Emails vérifiés     — Utilisateurs ayant confirmé leur adresse email
📋 Audits auj.        — Événements sensibles d'aujourd'hui
```

**Comment les interpréter** :
- Les % indiquent le ratio par rapport au total
- Vert = bon, Orange = à améliorer, Rouge = critique

#### 2. Configuration système
Voir les paramètres actuels :
- Environnement (dev/prod)
- Fournisseur LLM
- 2FA obligatoire pour admins (oui/non)
- Métriques Prometheus actives
- Version API

#### 3. Répartition par rôle
Graphique en barres montrant :
- Nombre d'utilisateurs
- Nombre d'administrateurs
- Nombre de super administrateurs

#### 4. Derniers événements d'audit
Les 5 événements les plus récents. Cliquer "Voir complet" pour l'historique entier.

#### 5. Boutons d'accès rapide
- **Gérer les admins** — Créer/suspendre/réactiver des administrateurs
- **Voir l'audit** — Journal complet des événements
- **Voir configuration** — Paramètres système et feature flags

---

## 👥 Gestion des administrateurs

**Accès** : `/super-admin/administrateurs`

### Lister les admins

Vous voyez un tableau avec :
- Nom et email
- Rôle (Admin / Super admin)
- Date de création
- Dernière connexion
- Statut 2FA
- Statut (Actif / Suspendu)

#### Recherche
Taper dans le champ "Rechercher email, prénom, nom..." :
- Cherche en temps réel
- Case insensitive
- Filtre l'affichage sans recharger

#### Actions
- **Voir** — Ouvrir la page de détails
- **Suspendre / Réactiver** — Basculer l'accès (voir ci-dessous)

---

### Créer un nouvel administrateur

#### Étapes
1. Cliquer **"+ Nouvel administrateur"** (en haut à droite)
2. Remplir le formulaire :
   - **Prénom** : au moins 2 caractères
   - **Nom** : au moins 2 caractères
   - **Email** : email valide (unique dans le système)
   - **Mot de passe initial** : 
     - ⚠️ Minimum **12 caractères**
     - Doit contenir : majuscule + minuscule + chiffre + caractère spécial
     - Exemple : `MyP@ssw0rd2025`
   - **Ville** : optionnel (par défaut "Dakar")

3. Cliquer **"Créer l'administrateur"**

#### ⚠️ Après création
- ✓ Le compte est créé et actif immédiatement
- ✓ L'email n'a **pas besoin** de confirmation (vous êtes super admin)
- ⚠️ **Communiquer le mot de passe par un canal sécurisé** :
  - ❌ Jamais par email
  - ✓ SMS, appel téléphonique, ou en main propre
  - ✓ Le nouvel admin doit le changer à sa première connexion

---

### Page détails d'un administrateur

**Accès** : `/super-admin/administrateurs/{id}` ou cliquer "Voir"

#### Section haut (badges)
- **Rôle** : Admin ou Super Admin
- **Statut** : Actif ou Suspendu
- **2FA** : Activée ou Désactivée

#### Section "Dates"
- Quand le compte a été créé
- Dernière connexion (ou "Jamais" s'il ne s'est pas connecté)

#### Section "Profil"
Modifier le profil (Phase 6) :
- Prénom
- Nom
- Ville

**Limitation** : l'email ne peut pas être changé (sécurité)

#### Section "Sécurité"
- **Mot de passe** — Réinitialiser (Phase 6)
- **2FA** — Activer/Désactiver (Phase 6)

#### Section "Sessions actives"
Voir les appareils connectés (Phase 6).

#### Boutons d'action
- **Suspendre / Réactiver** — Basculer l'accès
- **Supprimer** — Suppression logique définitive (Phase 6)

---

### Suspendre un administrateur

**Situation** : Un admin est compromis, part de l'entreprise, ou viole la politique.

#### Étapes
1. Ouvrir la page détails de l'admin
2. Cliquer **"Suspendre"**
3. Confirmer dans la modale
4. ✓ L'admin est immédiatement déconnecté
5. ✓ Il ne peut plus se connecter
6. ✓ L'action est tracée dans l'audit

#### Conséquences
- Toutes les sessions actives sont révoquées
- Les endpoints API refusent les requêtes avec son JWT
- Les logs d'audit gardent l'historique

---

### Réactiver un administrateur

**Situation** : Un admin suspendu doit revenir.

#### Étapes
1. Ouvrir la page détails
2. Cliquer **"Réactiver"**
3. Confirmer
4. ✓ L'admin peut se connecter à nouveau

---

## 📋 Journal d'audit

**Accès** : `/super-admin/audit`

### Qu'est-ce que l'audit ?

Journal **immuable** de tous les événements sensibles :
- Connexions (réussies et échouées)
- Créations de comptes
- Suspensions/réactivations
- Modifications de droits
- Calculs de score
- Vérifications 2FA
- Etc.

### Caractéristiques
- ✓ Immuable : impossible de supprimer ou modifier
- ✓ Signé cryptographiquement
- ✓ Conservé 1 an minimum
- ✓ Conforme CDP/RGPD

---

### Filtrer l'audit

#### 1. Recherche textuelle
Champ en haut : cherche dans :
- Type d'événement
- Description
- Email utilisateur
- Adresse IP

#### 2. Type d'événement
Dropdown "Type d'événement" : sélectionner un type spécifique
- `connexion_reussie` — Connexion validée
- `connexion_echouee` — Mauvais mot de passe
- `inscription` — Nouvel utilisateur
- `creation_admin` — Nouvel administrateur créé
- Etc.

#### 3. Plage de dates
- **Du** : date de début (optionnel)
- **Au** : date de fin (optionnel)
- Sélectionner avec le date picker

#### 4. Réinitialiser
Bouton **"↻ Réinitialiser tous les filtres"** — remet à zéro

### Pagination

Si plus de 50 événements :
- Affichage par pages de 50
- Boutons **← Précédent** et **Suivant →**
- Numérotation : [1] [2] [3] ... [10]

### Lire un événement

Chaque ligne affiche :
- **Badge coloré** : type d'événement (rouge=erreur, bleu=connexion, etc.)
- **ID court** : premiers 8 caractères
- **Horodatage** : date et heure précises
- **Description** : détail de l'événement
- **IP** : adresse de la requête
- **Utilisateur** : ID si applicable

---

## ⚙️ Configuration système

**Accès** : `/super-admin/configuration`

### Section "Paramètres d'exécution"

Affichage de la configuration courante :
- Environnement
- Fournisseur LLM
- 2FA obligatoire
- Métriques Prometheus
- Version API

**Status** : Lecture seule (Phase 5). Modification en Phase 6.

### Section "Répartition par rôle"

Graphique montrant :
- Nombre total d'utilisateurs
- Nombre d'admins
- Nombre de super admins

Utile pour la planification.

### Section "Feature flags"

État des fonctionnalités par phase :

```
Phase 2 — Modules métier
  ☐ Calcul automatique du score
  ☐ Notifications email

Phase 3 — Chatbot & RAG
  ☐ Chatbot LangChain

Phase 4 — Reconnaissance faciale
  ☐ Reconnaissance faciale
  ☐ Comparaison aux listes officielles

Production — Sécurité
  ☑ 2FA obligatoire pour admins
```

**Status** : Lecture seule (Phase 5). Modification activable/désactivable en Phase 6.

### Section "Roadmap super admin"

**Phase 5 (en cours)** ✓
- Page détails admin avec édition
- Pagination et filtrage audit
- Dashboard avec statistiques
- Gestion des sessions

**Phase 6 (à venir)**
- Modification feature flags
- Réinitialisation mot de passe
- Gestion 2FA
- Export audit CSV/JSON
- Graphiques

---

## 📊 Statistiques détaillées

**Accès** : `/super-admin/statistiques`

### Utilisateurs

#### Vue d'ensemble
- **Total** : tous les utilisateurs
- **Actifs** : avec activité récente + pourcentage
- **Inactifs** : jamais connectés ou longtemps inactifs

#### Répartition par rôle
Pour chaque rôle :
- Nombre absolu
- Barre de progression
- Pourcentage du total

---

### Sécurité

#### Double authentification (2FA)
- Activée : nombre et %
- Désactivée : nombre et %
- **Taux d'activation** affiché en gros

**Interprétation** :
- ✓ > 80% = excellent
- ⚠️ 50-80% = à améliorer
- 🔴 < 50% = critique

#### Vérification d'email
- Vérifiés : nombre et %
- Non vérifiés : nombre et %
- **Taux de vérification** affiché

**Interprétation** :
- ✓ > 70% = bon
- ⚠️ 40-70% = à améliorer
- 🔴 < 40% = problématique

---

### Activité d'audit

**Événements d'audit aujourd'hui** :
- Nombre absolu
- Estimation moyenne par mois

Utile pour :
- Détecter les pics d'activité
- Planifier la capacité
- Détecter les anomalies

---

### Score de santé global

**3 indicateurs colorés** :

1. **Activation 2FA**
   - Si ≥ 80% → "Excellent"
   - Sinon → "À améliorer"

2. **Vérification email**
   - Si ≥ 70% → "Bon"
   - Sinon → "À améliorer"

3. **Activité utilisateurs**
   - Si ≥ 60% → "Sain"
   - Sinon → "Faible"

---

### Recommandations automatiques

Le système affiche des alertes contextuelles :

```
⚠️ Augmenter l'activation 2FA
   Seulement 65% des utilisateurs ont 2FA activé.
   → Envisager une campagne de sensibilisation

✉️ Améliorer la vérification email
   35% des utilisateurs n'ont pas vérifié.
   → Envoyer des rappels

📊 Faible activité utilisateurs
   240 utilisateurs inactifs.
   → Analyser les raisons, améliorer l'engagement
```

---

## 🔧 Sessions actives (Phase 6)

**Accès** : Page détails admin → bouton "Sessions"

Voir tous les appareils actuellement connectés :
- IP
- Type d'appareil (User-Agent)
- Date/heure connexion
- Dernière utilisation
- Bouton "Révoquer" pour forcer déconnexion

---

## 🎯 Scénarios courants

### Scénario 1 : Un utilisateur se plaint que son compte est compromis

1. Aller à **Audit**
2. Filtrer par l'email de l'utilisateur
3. Chercher des connexions anormales
   - IP inhabituelle
   - Heure inhabituelle
   - Plusieurs `connexion_echouee` rapides
4. Si compromise : suspendre le compte
5. L'utilisateur doit réinitialiser son mot de passe

### Scénario 2 : Un administrateur doit partir

1. Aller à **Administrateurs**
2. Trouver l'admin
3. Cliquer **"Voir"**
4. Cliquer **"Suspendre"**
5. Ses sessions sont révoquées immédiatement
6. Son compte reste en base (audit historique)

### Scénario 3 : Vérifier l'activité du système

1. Aller à **Statistiques**
2. Voir les indicateurs de santé
3. Lire les recommandations
4. Agir si critique (ex: 2FA trop bas)

### Scénario 4 : Auditer les actions d'un admin

1. Aller à **Audit**
2. Chercher par email de l'admin
3. Voir tous ses `creation_admin`, `suspension_admin`, etc.
4. Vérifier que les actions sont légitimes

### Scénario 5 : Créer un nouvel administrateur

1. Aller à **Administrateurs**
2. Cliquer **"+ Nouvel administrateur"**
3. Remplir le formulaire (voir section plus haut)
4. Cliquer **"Créer"**
5. **Communiquer le mot de passe en dehors de l'app**
6. L'admin peut se connecter et changer son mot de passe

---

## ⚠️ Bonnes pratiques

### Sécurité

- ✓ Changez votre mot de passe régulièrement
- ✓ Gardez votre 2FA à jour
- ✓ Ne partagez jamais vos identifiants
- ✓ Verrouillez votre appareil après utilisation
- ✓ Utilisez des WiFi sécurisés (jamais publics)

### Audit

- ✓ Vérifiez régulièrement le journal d'audit
- ✓ Alertez immédiatement si vous voyez des connexions suspectes
- ✓ Documentez les décisions (suspensions, créations)
- ✓ Conservez les preuves d'incidents

### Gestion des admins

- ✓ Créez des admins avec des mots de passe forts
- ✓ Activez obligatoirement 2FA
- ✓ Réactivez immédiatement un compte compromis
- ✓ Révisez régulièrement la liste des admins
- ✓ Enlevez les accès dès que ce n'est plus nécessaire

### Monitoring

- ✓ Consultez régulièrement les statistiques
- ✓ Agissez sur les recommandations
- ✓ Signalez les anomalies à votre équipe technique
- ✓ Maintenez le système à jour

---

## 🆘 Besoin d'aide ?

### Erreurs courantes

**"Erreur : Email déjà utilisé"**
→ L'email existe déjà. Utiliser un autre email ou chercher l'admin existant.

**"Erreur : Mot de passe insuffisamment complexe"**
→ Le mot de passe doit avoir :
  - Au moins 12 caractères
  - Une majuscule (A-Z)
  - Une minuscule (a-z)
  - Un chiffre (0-9)
  - Un caractère spécial (!@#$%^&*)

**"Erreur : 2FA invalide"**
→ Le code 2FA a expiré ou est incorrect. Essayer le code suivant.

**"Erreur : Session expirée"**
→ Se reconnecter. Votre session de 15 minutes a expiré.

**"Erreur : Accès refusé"**
→ Vous n'êtes pas super administrateur. Contacter un super admin.

### Contact technique

Pour les problèmes techniques :
- Email : support@digiid.africa
- Slack : #support-backend
- Ticket : [Jira link]

---

## 📚 Documents connexes

- `SUPER_ADMIN_AMELIORATIONS.md` — Détail technique des nouvelles fonctionnalités
- `DIAGNOSTIC_SUPER_ADMIN.md` — Analyse initiale
- `ARCHITECTURE.md` — Vue d'ensemble technique
- `SECURITE.md` — Politique de sécurité

---

**Dernière mise à jour** : Phase 5
**Version API** : 1.0.0
**Auteur** : ABOUDOU TRAORE Nihad
