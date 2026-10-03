# DigiID — Architecture FRONTEND « Plan B : Pivot Logistique »

> **Document de structure d'interface — à valider AVANT codage.**
> Complément du document `ARCHITECTURE_PLAN_B_LOGISTIQUE.md` (section 7).
> Objectif : décrire **chaque écran, chaque rôle, chaque parcours** et les
> **composants adaptés** au terrain, en réutilisant le design system existant.

---

## 0. Rappel du design system existant (à réutiliser tel quel)

**Palette « Terre & Lagune »** (`tailwind.config.ts`) :

| Token | Usage |
|-------|-------|
| `lagune` (#1B4965) | couleur principale, navigation, titres |
| `ocre` (#E8A857) | accent, badges, éléments actifs logistique |

| `terre` (#C44536) | alertes, police, danger |
| `sable` / `sable-clair` | fonds, cartes |
| `ardoise` / `ardoise-clair` | texte |
| `succes` (vert) | validation |

**Composants communs réutilisables** (`composants/commun/`) :
`Carte` (variantes standard/accent/pointillés/danger), `Tableau<T>` (colonnes typées + rendu),
`Bouton` (primaire/secondaire/ghost/danger/succes), `ChampSaisie`, `ChampRecherche`,
`Modal`, `ModalConfirmation`, `Alerte`, `Badge`, `BarreProgression`, `Icones`, `Logo`.

**Squelette de mise en page** (déjà en place) :
`layout.tsx` → `ConteneurLayout` → `BarreLaterale` (switch par rôle) + `EnTete` + `MenuMobile` + `main`.

**Protection de route** : `EnvelopperEspaceProtege rolesAutorises={[...]}`.

**Pattern de routing** : un dossier par espace `app/<espace>/layout.tsx` (layout + garde de rôle)
puis `app/<espace>/<module>/page.tsx`.

---

## 1. Principes d'interface

1. **Mobile-first terrain** : 80 % de l'usage se fait sur téléphone (receveur, chauffeur).
   Boutons larges, gros texte, usage à une main, zones tactiles ≥ 44 px.
2. **Hors-ligne d'abord** : bandeau d'état réseau permanent, actions qui restent possibles
   et qui se synchronisent ensuite.
3. **Une action = un écran clair** : parcours en 2-3 étapes max, feedback immédiat.
4. **Le ticket est roi** : après toute action de guichet, on peut **imprimer** (thermique)
   ou **afficher/partager** un QR + numéro en clair.
5. **Réutilisation maximale** : on n'invente pas de nouveaux styles, on compose avec l'existant.
6. **Rôles strictement isolés** : comme le reste de l'app, un espace ne montre que ses écrans.
7. **Accessible aux non-lecteurs** : pictogrammes + **guidage audio au clic** + **4 langues**
   (Dendi, Bariba, Fon, Français). Détail : `ARCHITECTURE_ACCESSIBILITE_VOCALE.md`.
   Conséquence concrète : sur les écrans terrain, on utilise **`BoutonVocal`** (au lieu de
   `Bouton`) et des **pictogrammes**, pas du texte seul.

---

## 2. Cartographie globale des espaces & écrans

| Espace (URL) | Rôle | Écrans (pages) |
|--------------|------|----------------|
| `/receveur` | Receveur de gare | dashboard, `colis/nouveau`, `bagage/nouveau`, `tickets`, `scan`, `cagnotte` |
| `/chauffeur` | Chauffeur | `dashboard`, `voyages`, `voyages/[id]`, `scan`, `score` |
| `/commercant` | E-commerce | `dashboard`, `expedier`, `colis`, `colis/[id]`, `abonnement`, `factures` |
| `/gare` | Gérant de gare | `dashboard`, `gares`, `lignes`, `vehicules`, `acteurs`, `litiges`, `statistiques` |
| `/suivi` | Famille / public | `suivi/[code]` (public, sans connexion) |
| `/citoyen` | Citoyen | + `mes-envois` (colis reçus), `ma-famille` |
| `/inspection` | Citoyen/agent | refonte **par type** de document |
| `/admin`·`/super-admin` | Admin | + `logistique/*`, `paiements/*` |

---

## 3. Navigation — ajouts dans `BarreLaterale.tsx`

On ajoute des blocs de liens, exactement sur le modèle des rôles existants.

```ts
// receveur
{ href: "/receveur/dashboard",  libelle: "Tableau de bord",  Icone: IconeAccueil }
{ href: "/receveur/colis/nouveau", libelle: "Enregistrer colis", Icone: IconeEnvoyer }
{ href: "/receveur/bagage/nouveau", libelle: "Enregistrer bagage", Icone: IconeIdentite }
{ href: "/receveur/tickets",    libelle: "Tickets du jour",  Icone: IconeJournal }
{ href: "/receveur/scan",       libelle: "Scanner / Livrer", Icone: IconeScan }
{ href: "/receveur/cagnotte",   libelle: "Ma cagnotte",      Icone: IconeScore }

// chauffeur
{ href: "/chauffeur/dashboard", libelle: "Tableau de bord",  Icone: IconeAccueil }
{ href: "/chauffeur/voyages",   libelle: "Mes voyages",       Icone: IconeEnvoyer }
{ href: "/chauffeur/scan",      libelle: "Scanner (route)",   Icone: IconeScan }
{ href: "/chauffeur/score",     libelle: "Mon score",         Icone: IconeScore }

// commercant
{ href: "/commercant/dashboard", libelle: "Tableau de bord", Icone: IconeAccueil }
{ href: "/commercant/expedier",  libelle: "Expédier un colis", Icone: IconeEnvoyer }
{ href: "/commercant/colis",     libelle: "Mes colis",        Icone: IconeJournal }
{ href: "/commercant/abonnement",libelle: "Abonnement",       Icone: IconeCle }
{ href: "/commercant/factures",  libelle: "Factures",         Icone: IconeStatistique }

// gerant_gare
{ href: "/gare/dashboard",   libelle: "Tableau de bord", Icone: IconeAccueil }
{ href: "/gare/gares",       libelle: "Gares & lignes",  Icone: IconeIdentite }
{ href: "/gare/vehicules",   libelle: "Véhicules",       Icone: IconeStatistique }
{ href: "/gare/acteurs",     libelle: "Receveurs & chauffeurs", Icone: IconeUtilisateur }
{ href: "/gare/litiges",     libelle: "Litiges",         Icone: IconeAlerte }
```
Icônes : réutiliser `composants/commun/Icones.tsx` ; ajouter au besoin
`IconeColis`, `IconeBagage`, `IconeCamion`, `IconeTicket`, `IconeWallet`, `IconeSynchronisation`.

---

## 4. Espace RECEVEUR (guichet) — détaillé

### 4.1 Tableau de bord guichet (`/receveur/dashboard`)

```
┌───────────────────────────────────────────────┐
│  Bonjour Awa 👋            🟢 En ligne         │
│  Guichet Gare Cotonou — 12 colis aujourd'hui   │
├───────────────┬───────────────┬────────────────┤
│ Colis (12)    │ Bagages (7)   │ Cagnotte        │
│ ↑ +3 ce matin │ ↑ +1          │ 1 250 FCFA      │
├───────────────┴───────────────┴────────────────┤
│ [ ➕ Enregistrer un colis ]  (bouton large)      │
│ [ 🎒 Enregistrer un bagage ]                     │
│ [ 📷 Scanner / Livrer ]                          │
├─────────────────────────────────────────────────┤
│ 🕒 Derniers tickets                              │
│  PK-000123  • Parakou • 5 000 F • ✅ livré      │
│  PK-000124  • Bohicon • 2 500 F • 🚚 en transit │
└─────────────────────────────────────────────────┘
```
Composants : `Carte`, `Tableau`, `Bouton`, `Badge`. États en `Badge` (couleur par statut).

### 4.2 Enregistrer un colis (`/receveur/colis/nouveau`) — assistant 3 étapes

```
Étape 1/3 — Expéditeur & destinataire      ●○○
┌─────────────────────────────────────────┐
│ Expéditeur : [ nom complet          ]    │
│ Téléphone  : [ +229 …               ]    │
│ Destinataire : [ nom complet        ]    │
│ Téléphone  : [ +229 …               ]    │
│                  [ Continuer → ]          │
└─────────────────────────────────────────┘

Étape 2/3 — Détails du colis                ●●○
┌─────────────────────────────────────────┐
│ Description : [ vêtements           ]    │
│ Poids (kg)  : [ 3.5 ]  Valeur : [20000]  │
│ Départ : [Cotonou ▼]  Arrivée : [Parakou▼]│
│ Voyage : [AB-123 · 09:30 ▼]               │
│ Frais : 100 FCFA (fixe) · Commission 25 F │
│                  [ Continuer → ]          │
└─────────────────────────────────────────┘

Étape 3/3 — Paiement & ticket               ●●●
┌─────────────────────────────────────────┐
│ Montant total : 100 FCFA                  │
│ Moyen : ( ) Mobile Money  (•) Espèces     │
│ [ ✅ Enregistrer & imprimer le ticket ]   │
└─────────────────────────────────────────┘
```
→ À la validation : appel `POST /logistique/colis` → génère `code_clair` + QR →
écran **Ticket** (`/receveur/tickets/[id]`) avec boutons **Imprimer** / **Partager**.

### 4.3 Enregistrer un bagage passager (`/receveur/bagage/nouveau`)
Formulaire court : voyageur (nom/tél), voyage, description, poids → étiquette + QR.
Bouton **« Imprimer l'étiquette »** (autocollant).

### 4.4 Ticket / étiquette imprimable (`/receveur/tickets/[id]`)

```
┌──────────────────────────────┐   ← zone d'impression (ESC/POS 58 mm)
│        DIGIID LOGISTIQUE      │
│      Gare Cotonou → Parakou   │
│  ┌────────┐                   │
│  │  QR    │   PK-2026-000123  │   ← QR dynamique + numéro EN CLAIR
│  └────────┘                   │
│  Colis : vêtements · 3.5 kg   │
│  Dest. : Moussa (+229 …)      │
│  Frais : 100 FCFA             │
│  09:30 · 12/02/2026           │
└──────────────────────────────┘
  [ 🖨️ Imprimer ]  [ 📤 Partager ]
```
Composant `TicketImprimable` (rendu écran + payload ESC/POS).

### 4.5 Scanner / Livrer (`/receveur/scan`)

```
┌───────────────────────────────────────────┐
│  📷 Scanner un QR                         │
│  ┌───────────────────────────────────┐    │
│  │        (aperçu caméra)            │    │
│  └───────────────────────────────────┘    │
│  QR illisible ? Saisir le N° en clair :    │
│  [ PK-2026-______ ]  [ Rechercher ]        │
├───────────────────────────────────────────┤
│  Résultat :                                │
│  ✅ PK-000123 — Moussa — Cotonou→Parakou  │
│  Statut actuel : 🚚 en transit             │
│  [ ✅ Confirmer la livraison ]             │
├───────────────────────────────────────────┤
│  ⚠️ Si déjà livré : "DÉJÀ LIVRÉ le 12/02" │
└───────────────────────────────────────────┘
```
Branche `POST /logistique/scans` (idempotent). En cas de doublon → `Modal` d'alerte.

### 4.6 Ma cagnotte (`/receveur/cagnotte`)
`PortefeuilleCard` (solde) + `Tableau` des mouvements (commission par colis) +
bouton **« Virer vers Mobile Money »** (seuil).

---

## 5. Espace CHAUFFEUR

### 5.1 Dashboard (`/chauffeur/dashboard`)
Résumé : voyages du jour, nb colis/bagages à bord, score actuel.

### 5.2 Mes voyages (`/chauffeur/voyages` → `/chauffeur/voyages/[id]`)
```
Voyage Cotonou → Parakou · Bus AB-123 · 09:30
┌───────────────────────────────────────────┐
│ 🧳 Colis à bord (12)   [ Voir la liste ]   │
│ 👤 Passagers (28)      [ Voir la liste ]   │
│ 🎒 Bagages (7)         [ Voir la liste ]   │
│ [ 📷 Scanner au départ ] [ ✅ Clôturer ]   │
└───────────────────────────────────────────┘
```

### 5.3 Scan en route (`/chauffeur/scan`)
Identique à 4.5 mais **mode hors-ligne** : chaque scan va dans la file locale,
badge « 4 en attente de synchronisation ».

### 5.4 Mon score (`/chauffeur/score`)
Jauge `BarreProgression` + détail 40/30/20/10 + conseils (réutilise le style du score citoyen).

---

## 6. Espace COMMERÇANT (e-commerce)

### 6.1 Dashboard (`/commercant/dashboard`)
Colis du mois, taux de livraison, abonnement en cours, alerte quota.

### 6.2 Expédier (`/commercant/expedier`)
Formulaire (destinataire, description, valeur) → génère un **code d'envoi** à communiquer
au receveur, ou impression directe si guichet partenaire. Décompte du quota d'abonnement.

### 6.3 Mes colis (`/commercant/colis` → `/commercant/colis/[id]`)
`Tableau` + `SuiviTimeline` (enregistré → en transit → arrivé → livré).

### 6.4 Abonnement (`/commercant/abonnement`)
`SouscriptionAbonnement` : 2 cartes de plans (Starter / Premium) + `PaiementMobileMoney`.

### 6.5 Factures (`/commercant/factures`)
`Tableau` des transactions + `RecuPaiement` téléchargeable.

---

## 7. Espace GÉRANT DE GARE

| Page | Contenu |
|------|---------|
| `/gare/dashboard` | KPIs gare (volume, recettes, litiges) |
| `/gare/gares` | CRUD gares + lignes (avec carte des gares) |
| `/gare/vehicules` | CRUD véhicules |
| `/gare/acteurs` | Inviter/gérer receveurs & chauffeurs (réutilise le module `invitations`) |
| `/gare/litiges` | Traiter les litiges (impact score) |
| `/gare/statistiques` | Graphiques volume/recettes (réutilise les composants de stats existants) |

---

## 8. Espace FAMILLE / suivi public

### `/suivi/[code]` (PUBLIC, sans connexion)
```
┌──────────────────────────────────────────┐
│  🧒 Suivi de Fatou (7 ans)                │
│  Cotonou → Parakou · Bus AB-123           │
│  ● Départ confirmé   09:30                 │
│  ○ Arrivée             —                   │
│  4 personnes notifiées par SMS            │
│  [ M'alerter par SMS ]  (n° : +229 …)     │
└──────────────────────────────────────────┘
```
Sécurité : accès par **code clair** + vérification du numéro du parent.

---

## 9. Espaces ADMIN / SUPER-ADMIN (enrichissement)

Nouveaux sous-menus logistique & paiement dans les espaces existants :
```
/admin/logistique/{colis,voyages,litiges,chauffeurs}
/admin/paiements/{transactions,commissions,mobile-money,abonnements}
/super-admin/logistique/{gares,cles-api,configuration}
```
Réutilise `Tableau`, `Carte`, `Modal`, les patterns de `admin`/`super_admin` existants.

---

## 10. Refonte INSPECTION (rendu par type)

Aujourd'hui `ExtractionResults` affiche les champs **génériquement**. Cible :

```ts
export const CHAMPS_PAR_TYPE: Record<string, { key: string; libelle: string }[]> = {
  carte_grise: [
    { key: "numero_immatriculation", libelle: "Immatriculation" },
    { key: "numero_chassis",         libelle: "N° châssis (VIN)" },
    { key: "marque",                 libelle: "Marque" },
    { key: "energie",                libelle: "Énergie" },
    { key: "titulaire_nom",          libelle: "Titulaire" },
    /* … */
  ],
  carte_sejour: [ /* … */ ],
  consulaire:   [ /* … */ ],
  // + cni, passeport, permis, assurance
};
```
- `DocumentTypeSelector` : cartes cliquables (existant) + ajout carte grise/consulaire (fait).
- `ExtractionResults` : lit `CHAMPS_PAR_TYPE[type]`, affiche **les libellés métier**,
  et propose **correction manuelle** d'un champ (nouveau : `CorrectionChamp`).
- Vue `recto/verso` pour CNI avec fusion des deux faces.

---

## 11. Catalogue de composants

### Réutilisés
`Carte`, `Tableau<T>`, `Bouton`, `ChampSaisie`, `ChampRecherche`, `Modal`,
`ModalConfirmation`, `Alerte`, `Badge`, `BarreProgression`, `Icones`.

### Nouveaux — `composants/logistique/`

| Composant | Rôle | Props principales |
|-----------|------|-------------------|
| `EnregistrementColis` | Assistant 3 étapes | `voyages`, `onCree(colis)` |
| `EnregistrementBagage` | Formulaire bagage | `voyage`, `onCree(etiquette)` |
| `TicketImprimable` | Rendu ticket + payload ESC/POS | `ticket`, `onImprimer()` |
| `EtiquetteColis` | Autocollant (nom, adresse, QR, code) | `colis` |
| `QRScanner` | Caméra + saisie code clair | `onScan(code)`, `mode: "qr"\|"clair"` |
| `SuiviTimeline` | Frise des événements | `evenements` |
| `ScanOffline` | File locale + état de synchro | `acteurId` |
| `ListeVoyageColis` | Liste colis d'un voyage | `voyageId` |
| `BarreHorsLigne` | Bandeau réseau + compteur file | — |
| `JaugeScore` | Score chauffeur (40/30/20/10) | `score` |

### Nouveaux — `composants/paiement/`

| Composant | Rôle |
|-----------|------|
| `PortefeuilleCard` | Solde wallet + actions |
| `PaiementMobileMoney` | Choix opérateur + numéro + validation |
| `ChoixMoyenPaiement` | Radio Mobile Money / Espèces |
| `RecuPaiement` | Reçu affichable/partageable |
| `SouscriptionAbonnement` | Cartes de plans + tunnel |

### Nouveaux — `composants/accessibilite/` (non-lecteurs)

| Composant | Rôle |
|-----------|------|
| `BoutonVocal` | `Bouton` + audio au clic/focus (`cleAudio`) |
| `AssistantVocal` | Guidage pas-à-pas parlé |
| `SelecteurLangue` | Choix de langue **à l'oreille** (Dendi/Bariba/Fon/FR) |
| `Pictogrammes` | Jeu d'icônes pleines et lisibles |
| `BoutonMuet` | Couper/réactiver la voix (persistant) |
| `MessageVocal` | Message de statut affiché + parlé (OK/Attention/Erreur) |

---

## 12. Offline-first · PWA · impression thermique

- **PWA** : `manifest.json` + service worker (`next-pwa`), installable sur Android.
- **File locale** : IndexedDB via **Dexie** — table `file_evenements`
  `{ id, idempotency_key, type, payload, cree_le, statut }`.
- **Hook** `useFileSync()` : pousse la file par lots vers
  `POST /logistique/synchronisation/lot` quand le réseau revient.
- **Composant** `BarreHorsLigne` : 🟢 en ligne / 🟠 N en attente / 🔴 hors-ligne.
- **Impression** : `WebBluetooth` (ESC/POS, imprimante 58 mm) ; fallback
  **partage/PDF** si non supporté. Génération du payload côté client, QR côté backend.
- **Cache** : la liste des voyages/lignes du jour est mise en cache pour le départ sans réseau.

---

## 13. Couche services & types

```
services/logistiqueApi.ts   creerColis, creerBagage, genererTicket, scannerToken,
                            synchroLot, listerVoyages, obtenirScoreChauffeur,
                            creerSuiviFamilial, suivreParCode
services/paiementApi.ts     initierPaiement, verifierStatut, soldePortefeuille,
                            mouvements, souscrireAbonnement, telechargerRecu
types/logistique.ts         Colis, Bagage, Ticket, Voyage, Scan, SuiviFamilial, ScoreChauffeur
types/paiement.ts           Portefeuille, Transaction, Abonnement, Recu
```
Patterns : réutiliser `services/client_api.ts` (`clientAPI.get/post/delete`, option `authentifie`).
Upload de fichiers : suivre le pattern XMLHttpRequest de `inspectionApi.ts`.

---

## 14. Responsive & terrain

- **Mobile-first** : le receveur/chauffeur travaille sur téléphone → formulaires courts,
  boutons pleine largeur, `Bouton` taille `grand`, clavier numérique sur les champs tél/montants.
- **Desktop** : les vues gérant/admin utilisent `Tableau`.
- **Accessibilité** : contrastes de la palette, labels explicites, focus visibles.
- **Performance** : impression et scans ne bloquent jamais l'UI (file d'attente locale).

---

## 15. Arborescence frontend cible

```
frontend/src/
  app/
    receveur/   layout.tsx  dashboard/  colis/nouveau/  bagage/nouveau/
                tickets/  tickets/[id]/  scan/  cagnotte/
    chauffeur/  layout.tsx  dashboard/  voyages/  voyages/[id]/  scan/  score/
    commercant/ layout.tsx  dashboard/  expedier/  colis/  colis/[id]/
                abonnement/  factures/
    gare/       layout.tsx  dashboard/  gares/  vehicules/  acteurs/  litiges/  statistiques/
    suivi/[code]/   page.tsx          (public)
    citoyen/    mes-envois/  ma-famille/
  composants/
    logistique/    (cf. §11)
    paiement/      (cf. §11)
    accessibilite/ (cf. §11 — BoutonVocal, AssistantVocal, SelecteurLangue…)
  i18n/            fr.json  fon.json  dendi.json  bariba.json  audios.ts  useLangue.ts
  services/        logistiqueApi.ts  paiementApi.ts
  types/           logistique.ts  paiement.ts
  public/
    manifest.json  (PWA)
    audios/        fr/  fon/  dendi/  bariba/   (guidage audio)
```

---

## 16. Décisions frontend à valider

1. **Impression** : WebBluetooth (navigateur) ou application mobile native dédiée ?
2. **PWA** : installation sur Android acceptable pour les receveurs ? Ou app native ?
3. **Scanner QR** : caméra via navigateur (`getUserMedia`) — OK sur le matériel ciblé ?
4. **Suivi public** `/suivi/[code]` : accès libre par code clair + contrôle du n° du parent ?
5. **Langue** : le frontend reste 100 % français (ou prévoir wolof/fon plus tard) ?
6. **Correction manuelle OCR** (§10) : autorisée pour le citoyen ou uniquement les agents ?

---

*Fin du document frontend. Aucun code écrit : en attente de validation.*
