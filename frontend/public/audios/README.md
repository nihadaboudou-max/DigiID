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

## ⚙️ Interrupteur à activer après l'enregistrement

Tant que les `.mp3` n'existent pas, le préchargement reste coupé pour éviter des
erreurs 404 en console. **Le jour où les fichiers sont déposés ici**, ouvrir :

`src/i18n/config.ts`

et passer :

```ts
// avant
ACTIVER_PREACHARGEMENT_AUDIO = false;
// après
ACTIVER_PREACHARGEMENT_AUDIO = true;
```

C'est le **seul** changement à faire : le hook `useLangue` branche déjà le
préchargement quand l'interrupteur est à `true`.
