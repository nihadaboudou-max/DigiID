# DigiID — Frontend

Interface web Next.js 14 du système DigiID. Branchée sur l'API backend FastAPI.

## Stack

- **Next.js 14** (App Router)
- **React 18** + **TypeScript**
- **Tailwind CSS** (palette Terre & Lagune)
- **Police Poppins** (chargée via `next/font/google`)
- **js-cookie** pour la gestion des jetons JWT

## Structure des dossiers

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx                        # Layout racine (Poppins, contextes)
│   │   ├── page.tsx                          # Accueil public
│   │   ├── (authentification)/               # Group route — pages publiques
│   │   │   ├── connexion/page.tsx
│   │   │   └── inscription/page.tsx
│   │   ├── (utilisateur)/                    # Group route — espace utilisateur
│   │   │   └── tableau-de-bord/page.tsx
│   │   ├── (admin)/                          # Group route — espace admin
│   │   │   └── tableau-de-bord/page.tsx
│   │   └── (super-admin)/                    # Group route — espace super admin
│   │       └── tableau-de-bord/page.tsx
│   ├── composants/
│   │   ├── commun/                           # Bouton, ChampSaisie, Logo, GarantieRole
│   │   └── layouts/                          # EnTete, PiedDePage
│   ├── services/
│   │   ├── client_api.ts                     # Wrapper fetch + gestion JWT
│   │   └── authentification.ts               # Appels API auth
│   ├── contextes/
│   │   └── authentification.tsx              # Contexte React global
│   ├── types/api.ts                          # Types TypeScript des objets API
│   └── styles/globaux.css                    # Tailwind + classes utilitaires
└── package.json
```

## Trois espaces séparés

| Espace                | URL                              | Rôle requis              |
| --------------------- | -------------------------------- | ------------------------ |
| Public                | `/`, `/connexion`, `/inscription` | Aucun                    |
| Utilisateur           | `/tableau-de-bord`               | utilisateur ou supérieur |
| Administrateur        | `/admin/tableau-de-bord`         | administrateur ou supérieur |
| Super Administrateur  | `/super-admin/tableau-de-bord`   | super_administrateur uniquement |

Chaque espace est protégé par le composant `GarantieRole` qui vérifie le rôle de l'utilisateur connecté et redirige sinon.

## Démarrage local

Le frontend a besoin que le backend tourne (port 8000).

```bash
# Aller dans le dossier frontend
cd E:\NOUVEAU_PROJET_MEMOIRE\DIGI_ID\digiid\frontend

# Configurer
copy .env.local.exemple .env.local

# Installer les dépendances (la première fois uniquement)
npm install

# Lancer en mode développement
npm run dev
```

Le frontend démarre sur **http://localhost:3000**.

Si tu as déjà créé ton super admin avec le seed du backend, tu peux te connecter avec ces identifiants et voir ton tableau de bord super admin réel.

## Conventions

- Tout en français : variables, composants, dossiers, commentaires
- Pas d'image distante : le logo est en SVG inline (composant `Logo`)
- Palette Tailwind personnalisée : `lagune`, `ocre`, `terre`, `sable`, `ardoise`
- Composants standardisés : `Bouton`, `ChampSaisie`, etc.
- Aucune logique métier dans les pages : on passe par les `services/`

## Phase actuelle

Phase 5 anticipée — version minimaliste fonctionnelle. Les vraies pages (profil, score détaillé, chatbot, etc.) seront ajoutées en Phase 2/3/4.
