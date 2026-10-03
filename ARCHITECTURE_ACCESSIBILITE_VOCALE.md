# DigiID — Accessibilité, Guidance vocale & Multilingue

> **Document de structure — à valider AVANT codage.**
> Public cible : **personnes peu ou pas scolarisées** (receveurs, chauffeurs,
> commerçants, citoyens). L'interface doit être **moderne, simple, parlante**.
> Langues supportées : **Dendi, Bariba (Baatonum), Fon, Français**.

---

## 0. Objectif & population cible

Les utilisateurs ne lisent pas (ou peu) le français écrit. La conception ne peut donc
**pas reposer sur le texte**. Trois canaux, combinés, remplacent la lecture :

| Canal | Rôle |
|-------|------|
| 🖼️ **Pictogramme / couleur** | rendre l'action reconnaissable d'un coup d'œil |
| 🔊 **Voix (audio)** | expliquer l'action — déclenchée au clic sur un bouton |
| 👆 **Geste simple** | un seul geste par écran, gros boutons |

Le texte reste présent (pour ceux qui lisent) mais **jamais indispensable**.

---

## 1. Principes d'interface « sans lecture » (low-literacy design)

1. **Une action = 1 pictogramme + 1 couleur + 1 voix.** Jamais de texte seul.
2. **Le son explique.** Quand on clique sur un bouton, une voix dit ce qui va se passer.
3. **Un écran = une décision.** Pas de menus profonds ; chemin linéaire, toujours
   « suivant » ou « retour », avec voix.
4. **Confirmation triple** : visuelle (couleur/icône) + sonore (parole/bip) + haptique (vibration).
5. **Jamais la couleur seule** : toujours couleur **+ icône + forme** (daltonisme, écrans usés).
6. **Gros éléments tactiles** : boutons ≥ 56 px de haut, espaces larges, texte ≥ 18 px.
7. **Chiffres parlés** : montants, poids, numéros de ticket énoncés vocalement.
8. **Feedback immédiat** : chaque clic produit un retour instantané (son + animation).
9. **Langue choisissable à l'oreille** : l'utilisateur choisit sa langue en **écoutant**
   un échantillon, pas en lisant.
10. **Mode guidé vocal** : un assistant pas-à-pas qui parle (voir §3.7).

---

## 2. Multilingue (i18n) — 4 langues

### 2.1 Langues & codes

| Langue | Code | Écriture | Sens | Échantillon audio |
|--------|------|----------|------|-------------------|
| Français | `fr` | Latin | ⟶ | requis |
| Fon | `fon` | Latin | ⟵ | requis |
| Dendi | `ddn` | Latin | ⟵ | requis |
| Bariba / Baatonum | `bba` | Latin | ⟵ | requis |

> Toutes les langues sont **LTR** (écriture latine) → pas de gestion RTL à prévoir.
> Jeu **par défaut** = `fr`, mais l'onboarding invite à choisir (Dendi en tête pour le Nord,
> Fon au Sud, etc. — ordre paramétrable par région).

### 2.2 Librairie

- **`react-i18next`** (déjà envisagé dans `documentation/PHASES.md`) OU un **mini-moteur**
  maison (dictionnaire JSON + hook `useLangue()`). Recommandé : **mini-moteur** pour rester
  léger et maîtriser le couplage avec l'audio (une clé de traduction = une clé audio).
- Contexte : `ContexteLangue` (au-dessus de `ContexteAuthentification`).
- Persistance : `localStorage` (`digiid.langue`) + préférence serveur (profil utilisateur).
- **Fallback** : si une clé manque dans `fon/ddn/bba` → repli sur `fr`.

### 2.3 Fichiers de traduction

```
frontend/src/i18n/
  fr.json   fon.json   dendi.json   bariba.json     (textes)
  audios.ts                                          (registre audio)
  useLangue.ts                                       (hook + provider)
```
Exemple de clé commune **texte + audio** :
```jsonc
// fr.json
{ "btn.enregistrer_colis": "Enregistrer un colis",
  "colis.etape1.titre": "Qui envoie le colis ?" }
```

### 2.4 Sélecteur de langue

Écran d'accueil (avant connexion), 4 grandes cartes **avec haut-parleur** :
```
┌───────────────┬───────────────┐
│   🔊 Fon      │   🔊 Dendi    │
├───────────────┼───────────────┤
│   🔊 Bariba   │   🔊 Français │
└───────────────┴───────────────┘
   ▶ cliquez pour écouter puis choisir
```
Chaque carte joue un message d'accueil dans la langue (« Bienvenue sur DigiID »).
Accessible aussi dans **Paramètres** (changement à tout moment).

### 2.5 Note

`documentation/PHASES.md` mentionnait « FR / Wolof / Fon ». À **aligner** :
remplacer par **FR / Fon / Dendi / Bariba** (Wolof en option ultérieure).

---

## 3. Guidance audio — le cœur du dispositif

### 3.1 Principe

> **Tout bouton parlant possède un audio.** Quand l'utilisateur clique (ou survole en
> desktop, ou reste 1 s sur mobile), l'application **dit à voix haute** ce qui va se passer.
> Ex. : bouton « 📦 Enregistrer un colis » → voix : *« Pour ajouter un nouveau colis,
> touchez ici. »*

### 3.2 Deux stratégies (recommandé : hybride)

| Stratégie | Avantages | Limites | Usage |
|-----------|-----------|---------|-------|
| **A. Audio pré-enregistré** (`.mp3`/`.ogg`) | excellente qualité, marche **hors-ligne**, prononciation correcte en langues locales | doit être enregistré (voix humaine) | **obligatoire** pour Fon/Dendi/Bariba |
| **B. Synthèse vocale (TTS)** | pas d'enregistrement, dynamique | **Web Speech API ne gère pas** Fon/Dendi/Bariba ; qualité FR variable | **repli** pour le français / textes dynamiques |

→ **Décision proposée** : **audios pré-enregistrés** pour les messages clés (les 4 langues) ;
**TTS navigateur** en repli pour le français uniquement (nombres, contenus dynamiques).

### 3.3 Registre audio (clé → 4 fichiers)

Un **registre central** associe chaque clé utilisée à un fichier par langue :

```ts
// i18n/audios.ts
export const AUDIOS: Record<string, Partial<Record<Langue, string>>> = {
  "btn.enregistrer_colis": {
    fr: "/audios/fr/btn_enregistrer_colis.mp3",
    fon: "/audios/fon/btn_enregistrer_colis.mp3",
    dendi: "/audios/dendi/btn_enregistrer_colis.mp3",
    bariba: "/audios/bariba/btn_enregistrer_colis.mp3",
  },
  "colis.etape1.titre": { /* … */ },
  "confirm.livraison.ok": { /* … */ },
  // …
};
```
Arborescence statique (repli local / PWA) :
```
frontend/public/audios/
  fr/     fon/     dendi/     bariba/
    btn_enregistrer_colis.mp3
    colis_etape1_titre.mp3
    confirm_livraison_ok.mp3
    …
```

### 3.4 Déclenchement au clic

- Composant **`BoutonVocal`** : wrapper de `Bouton` existant + propriété `cleAudio`.
  ```
  <BoutonVocal cleAudio="btn.enregistrer_colis" onClick={...}>
     📦 Enregistrer un colis
  </BoutonVocal>
  ```
  Comportement : au **clic** (et au **focus**), joue l'audio de la langue courante,
  **puis** exécute l'action (ou l'action d'abord, l'audio en feedback).
- Propriété `quand` : `"avant" | "apres" | "sur-clic"` (par défaut `sur-clic`).
- Empêche le déclenchement multiple : un seul audio à la fois (voir AudioManager).

### 3.5 Hook & gestionnaire audio

```ts
// useVoix() — expose l'API de lecture
const { jouer, arreter, muet, basculerMuet, enFile } = useVoix();
```
**`GestionnaireAudio`** (singleton) :
- un seul élément `<Audio>` courant ; **interrompt** l'ancien si on joue un nouveau ;
- respecte la préférence **muet** (`localStorage`) — bouton 🔊/🔇 permanent ;
- **précharge** le pack de la langue courante ;
- file d'attente optionnelle pour les guides pas-à-pas ;
- si fichier manquant → TTS (fr) sinon silence + `console.warn`.

### 3.6 Comportements attendus

- **Bouton Muet** global (persistant) — utile en environnement bruyant.
- **Volume** réglable ; **rejouer** (petite flèche ↻ sur chaque message).
- **Ne pas bloquer** l'action par l'audio (audio en parallèle sauf mode guidé).
- **Desktop** : lecture à la prise de focus (survol) — aide les personnes non lectrices.

### 3.7 Mode guidé vocal (assistant pas-à-pas)

Composant **`AssistantVocal`** : enchaîne des étapes, chacune = un pictogramme + un audio
+ mise en évidence de la zone à toucher.
```
AssistantVocal etapes={[
  { cleAudio: "guide.colis.1", cible: "#champ-expediteur",   icone: "👤" },
  { cleAudio: "guide.colis.2", cible: "#champ-destinataire", icone: "👥" },
  { cleAudio: "guide.colis.3", cible: "#bouton-payer",       icone: "💰" },
]}
```
Idéal pour : enregistrer un colis, scanner un ticket, choisir un moyen de paiement.

---

## 4. UI adaptée basse littératie

### 4.1 Pictogrammes
Jeu d'icônes dédié (`composants/commun/Pictogrammes.tsx`) : colis 📦, bagage 🎒, camion/bus 🚌,
argent 💰, téléphone 📱, personne 👤, groupe 👥, ticket 🎟️, scan 📷, OK ✅, attention ⚠️.
Icônes **pleines, colorées, lisibles** (pas de lignes fines).

### 4.2 Gros boutons & tickets
- Hauteur min **56-64 px**, texte **≥ 18 px**, icône **≥ 32 px**.
- Un **seul bouton principal** par écran (très visible, couleur `ocre`/`lagune`).

### 4.3 Couleur + icône + voix (jamais couleur seule)
| Statut | Couleur | Icône | Son |
|--------|---------|-------|-----|
| OK | vert | ✅ | ding aigu |
| Attention | ocre | ⚠️ | ding double |
| Erreur / déjà livré | terre | ⛔ | bip grave + voix |

### 4.4 Écrans simplifiés
- **Grandes zones** plutôt que tableaux denses pour le terrain (les tableaux restent
  pour gérant/admin).
- **Cartes visuelles** au lieu de listes textuelles pour receveur/chauffeur.

### 4.5 Onboarding vocal
Premier lancement : petit tutoriel **parlé** (3 écrans, langue choisie à l'oreille).

---

## 5. Backend — contenus linguistiques & audio

Nouveau module **`i18n`** : `backend/src/modules/i18n/`.

### 5.1 Tables
```
langues(id, code UNIQUE, libelle, actif, ordre)
traductions(id, cle, langue_code, texte, actif, maj_le,
            UNIQUE(cle, langue_code))
audios_guidage(id, cle, langue_code, url, duree_ms, taille_octets,
               enregistre_le, enregistre_par_id, actif,
               UNIQUE(cle, langue_code))
```
Les fichiers audio sont stockés dans le **stockage objet** (`noyau/stockage_photos`
étendu, ou S3/Volume) et servis par URL (CDN si possible).

### 5.2 Endpoints
```
GET  /api/v1/i18n/langues                     → liste des langues actives
GET  /api/v1/i18n/{langue}/traductions        → dictionnaire de la langue
GET  /api/v1/i18n/{langue}/audios             → manifest { cle: url }
```
Admins :
```
POST/PUT/DELETE /api/v1/admin/i18n/traductions        (super-admin / admin)
POST             /api/v1/admin/i18n/audios            (upload enregistrement)
```

### 5.3 Studio vocal (admin / super-admin)
Écran permettant de :
- lister les **clés manquantes** par langue (couverture de traduction & audio) ;
- **uploader** un fichier audio par clé (avec écoute + validation) ;
- suivre le **taux de couverture** (ex. « Fon : 128/150 audios »).
Réutilise `Tableau`, `Modal`, patterns super-admin existants.

---

## 6. Offline & performance

- **Packs de langue** (JSON traductions + manifest audio) **mis en cache** au choix de langue
  (Service Worker / Cache API), donc disponibles **hors-ligne**.
- **Audios préchargés** pour la langue active (les plus utilisés d'abord).
- Poids maîtrisé : audios courts (1-3 s), format `.ogg`/`.mp3` compressé ; lazy-load des
  audios hors parcours critique.
- Si un audio manque **et** hors-ligne → repli silencieux + indicateur.

---

## 7. Intégration aux espaces

| Espace | Usage de la voix |
|--------|------------------|
| `/receveur` | guidage vocal bout en bout (colis, bagage, scan, ticket) |
| `/chauffeur` | guidage scan, alertes parlées (« ce colis est déjà livré ») |
| `/commercant` | voix sur actions clés + récapitulatif parlé |
| `/suivi/[code]` | statut **énoncé** (familles) + langue au choix |
| `/citoyen` | assistance vocale des parcours (inspection, score) |
| Kiosque / guichet | mode **plein écran parlant** pour non-lecteurs |

---

## 8. Impact sur l'architecture existante

- **Frontend** : nouveau provider `ContexteLangue` + `useVoix`, composants
  `BoutonVocal`, `AssistantVocal`, `Pictogrammes`, `SelecteurLangue`, dossier `i18n/`.
  Toutes les pages terrain utilisent `BoutonVocal` au lieu de `Bouton`.
- **Backend** : module `i18n` + tables ci-dessus + upload audio + endpoints admin.
- **Noyau** : étendre `noyau/stockage_photos` (ou créer `stockage_medias`) pour les audios.
- **Rôles** : super-admin/admin gèrent le studio vocal ; personne d'autre n'upload d'audio.
- **Aucun module supprimé.** Le FR reste la langue de référence (repli).

---

## 9. Décisions à valider

1. **Voix humaines** : qui enregistre (voix off partenaires/langues locales) et budget ?
2. **TTS** : activer le TTS navigateur en **repli français** uniquement ? (les 3 langues
   locales dépendent des enregistrements)
3. **Ordre des langues** par région/zone (Dendi/Bariba au Nord, Fon au Sud).
4. **Couverture audio initiale** : quelles clés enregistrer en v1 (parcours colis/scan
   en priorité) ?
5. **Hébergement audio** : objet storage local vs CDN ?
6. **Mode kiosque** : prévu pour le guichet (plein écran, très gros boutons, parlant) ?
7. **Haptique** : vibration systématique sur confirmation (support mobile) ?
8. **Icônes** : jeu de pictogrammes existant à réutiliser ou créer ?

---

*Fin du document. Aucun code écrit : en attente de validation.*
