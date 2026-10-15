# Audios d'accessibilité DigiID (S5)

Ce dossier contient les **audios pré-enregistrés** du guidage vocal
(voix humaines, dans chaque langue).

## Arborescence

```
public/audios/
├── fr/       # Français
├── fon/      # Fon
├── dendi/    # Dendi
└── bariba/   # Bariba
```

## Convention de nommage

Le nom de fichier correspond à la **clé de traduction** en remplaçant les
points `.` par des underscores `_`, avec l'extension `.mp3`.

Exemples :

| Clé de traduction           | Fichier attendu                         |
| --------------------------- | --------------------------------------- |
| `accueil.bienvenue`         | `accueil_bienvenue.mp3`                 |
| `btn.enregistrer_colis`     | `btn_enregistrer_colis.mp3`             |
| `btn.continuer`             | `btn_continuer.mp3`                     |

Le registre complet est défini dans `src/i18n/audios.ts`.

## Repli automatique

Tant qu'un fichier est **absent**, l'application bascule automatiquement sur la
**synthèse vocale** (TTS) du navigateur, en lisant la traduction écrite
(`src/i18n/*.json`). Si aucune voix n'est disponible pour la langue, c'est la
voix française qui prend le relais, sinon le son est simplement coupé avec un
avertissement en console.

➡️ Pour une démo « voix humaine » complète, faire enregistrer les fichiers par
des locuteurs natifs (Fon, Dendi, Bariba) et les déposer ici.

## ⚙️ Interrupteurs à activer après l'enregistrement

Tant que les `.mp3` n'existent pas, le préchargement reste coupé pour éviter des
erreurs 404 en console. **Le jour où les fichiers sont déposés ici**, ouvrir
`src/i18n/config.ts` et passer **les deux** valeurs à `true` :

```ts
// avant
ACTIVER_PREACHARGEMENT_AUDIO = false;
AUDIOS_ENREGISTRES = false;
// après
ACTIVER_PREACHARGEMENT_AUDIO = true;
AUDIOS_ENREGISTRES = true;
```

C'est le **seul** changement à faire :

- `ACTIVER_PREACHARGEMENT_AUDIO` branche le préchargement des fichiers
  (déjà câblé dans `useLangue`) ;
- `AUDIOS_ENREGISTRES` fait que **le français aussi** cherche d'abord le
  `.mp3` au lieu d'aller directement à la synthèse vocale. Tant qu'il est à
  `false`, parler français démarre immédiatement (aucun 404), ce qui sert le
  parti pris « **le français d'abord** » du guide vocal.

## 🇫🇷 Où sont écrites les phrases du guide

Le guide vocal global (`src/i18n/guide_vocal.ts` + `GuideVocal.tsx`) est rédigé
en **français clair**, volontairement :

- les phrases sont courtes et à l'impératif (« Touchez… », « Entrez… ») ;
- `gestionnaire_audio.ts` les **prépare pour la voix** (`franciser()`) : emojis
  retirés, `#` → `dièse`, `n°` → `numéro`, `FCFA` → `francs CFA`, sigles
  épelés (`QR` → `Q R`), chemins d'écran (`/receveur/colis`) remplacés par
  « l'écran indiqué » ;
- les lectures longues sont **découpées** (`decouperEnMorceaux`) car les
  navigateurs coupent la parole au bout d'un moment.

Une page peut fournir son propre texte parlé avec les attributs :

| Attribut HTML           | Effet                                                        |
| ----------------------- | ------------------------------------------------------------ |
| `data-vocal-zone`       | Délimite la zone à raconter (pages sans `<main>`)             |
| `data-vocal-annonce`    | Phrase d'introduction (remplace la lecture passive du décor) |
| `data-vocal-texte`      | Phrase d'explication lue à la fin                            |
| `data-vocal`            | Libellé parlé d'un bouton (`<BoutonVocal>`)                   |
| `data-vocal-ignorer`    | Zone que la voix ne doit jamais lire                         |
