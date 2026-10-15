# Impression des tickets & étiquettes QR — correctif (S3)

> **Symptôme corrigé** : à l'impression, tous les tickets et toutes les étiquettes
> QR se retrouvaient **empilés au même endroit** de la première page — un seul
> restait visible, les autres semblaient « disparus ».
> Comportement attendu désormais : **une page par ticket, une page par étiquette QR.**

---

## 1. Pourquoi ça se superposait

Le CSS d'impression (`src/styles/globaux.css`) appliquait ceci à **chaque** zone à
imprimer :

```css
/* ❌ AVANT */
.ticket-principal,
.etiquette-bagage {
  position: absolute !important;   /* ← la cause */
  top: 0 !important;
  left: 0 !important;
  break-after: page !important;    /* ← sans effet, voir plus bas */
}
```

Trois conséquences, en cascade :

| # | Problème | Effet au guichet |
|---|----------|------------------|
| 1 | `position: absolute; top: 0` sur **tous** les blocs | ils s'empilent **les uns sur les autres** : seul le dernier (ou le premier, selon l'ordre de peinture) est lisible |
| 2 | Un élément **hors flux** n'accepte **aucun** saut de page (`break-after` / `page-break-after` sont ignorés) | tout reste sur la page 1, aucune page 2 pour les étiquettes |
| 3 | `body, body * { visibility: hidden }` sans condition | **toute** page sans ticket s'imprimait blanche (manifeste, export de rapports, carte DigiID…) — `visibility` réserve la place, d'où des pages vides en plus |

À cela s'ajoutait un piège réseau : les QR proviennent d'une **API d'images
distante** (`api.qrserver.com`). Si l'agent lance l'impression avant que les
images soient arrivées, la feuille sort avec des cadres vides.

---

## 2. Comment ça fonctionne maintenant

### 2.1 Côté CSS — le ticket reste **dans le flux**

```css
/* ✅ APRÈS (résumé) */
.zone-impression      { display: block; width: 100%; margin: 0; }   /* flux normal */
[data-impression-page],
.zone-impression ~ .zone-impression { break-before: page; }          /* 1 ticket = 1 page */
.ticket-principal,
.etiquette-bagage     { break-inside: avoid; }                       /* jamais coupé */
.etiquette-bagage     { min-height: 86vh; }                          /* centrée sur sa page */
```

Plus de `position: absolute`, plus de `visibility` globale. Le saut de page est
posé **avant** chaque zone suivante (`break-before`), et non après la dernière :
c'est ce qui évite la page blanche finale.

### 2.2 Côté JavaScript — ne garder que le ticket

Un ticket est **imbriqué** dans la page (layout, barre latérale, en-tête,
formulaires, notifications…). Pour que la feuille ne contienne que le ticket, il
faut donc savoir quoi masquer. C'est le rôle de `src/services/impression.ts` :

| Marquage | Posé sur | Rôle |
|----------|----------|------|
| `data-impression-visible` | le ticket, tout son contenu, **et la chaîne de ses parents** | seuls éléments conservés (`html[data-impression="1"] body *:not([data-impression-visible]) { display: none }`) |
| `data-impression-chemin` | les parents uniquement | on annule leur marge, leur fond, leur largeur max : le ticket part du haut de la feuille |
| `data-impression-page` | chaque ticket **après le premier** | saut de page garanti, `break-before: page` |
| `data-impression` | `<html>` | active les règles ; sans lui, aucune impression n'est modifiée |

Un écran **sans** ticket (manifeste, export, carte) n'est donc pas touché : plus
de « page blanche ».

### 2.3 Les deux façons d'imprimer sont couvertes

- **Boutons de l'application** → `imprimer()` (`services/impression.ts`) : attend
  les QR codes, marque la page, imprime, nettoie.
- **`Ctrl+P` / menu du navigateur** → `AssistantImpression` (monté une fois dans
  `app/layout.tsx`) écoute `beforeprint` / `afterprint` (+ la feuille de style
  média `print`, car Safari est capricieux) et fait le même travail.
- **Filet de sécurité** : si le JavaScript n'a pas pu marquer la page, une règle
  `:has()` en CSS produit le même résultat sur les navigateurs récents. Ignorée
  ailleurs — jamais de page blanche, au pire l'impression est un peu plus large.

### 2.4 Les QR codes sont attendus

`attendreImages()` guette les `<img>` des zones d'impression et **plafonne
l'attente à 2,5 s** : mieux vaut imprimer sans QR (le code en clair reste lisible
sur le ticket) que bloquer l'agent au guichet.

---

## 3. Ce qui sort sur le papier

| Écran | Page 1 | Pages suivantes |
|-------|--------|-----------------|
| Ticket colis (guichet, `/receveur/tickets/<code>`) | ticket du remettant | **une page par étiquette bagage** (colis parent rappelé en bas) |
| Ticket familial (enfant ou passager) | ticket de suivi | **une page par étiquette bagage** (passager rappelé) |
| Manifeste du voyage (`/chauffeur/…`) | manifeste complet (plusieurs pages autorisées) | — |
| Carte DigiID (`/identite/carte`) | la carte et son QR | — |
| Export de rapports (`/police/export`) | le rapport généré | — |

Le bouton « Imprimer le dossier complet » annonce la mise en page :
*« Le ticket principal sera sur la 1ère page, les étiquettes sur les suivantes. »*

---

## 4. Vérifier soi-même

1. **Sans papier** : ouvrir un ticket, puis dans Chrome `Ctrl+P` → dans l'aperçu,
   compter les pages en bas à droite (1 ticket + N sacs = N+1 pages).
2. `Ctrl+Maj+P` (**Émuler le média `print`** dans les DevTools) permet de voir le
   DOM imprimé : seule la carte du ticket doit rester visible.
3. Créer un colis avec **3 sacs** → 4 pages attendues, chacune avec **un** QR lisible.
4. Imprimer le **manifeste** et l'**export de rapports** : ils doivent contenir
   leur contenu (et non une page blanche).
5. Vérifier qu'après impression l'écran est **inchangé** (les marquages
   `data-impression-*` sont retirés par `terminerImpression()`).

---

## 5. Limites connues (à traiter plus tard)

1. **QR hors-ligne** : les QR sont des images d'une API publique
   (`api.qrserver.com`, voir `composants/logistique/format.ts`). Sans réseau, le
   ticket sort avec la mention « QR indisponible » — le **code en clair** reste
   imprimé, donc le colis reste identifiable et saisissable au scan. Solution
   cible : générer le QR côté backend (`/api/v1/logistique/qr/{code}.png`) ou
   embarquer une librairie QR locale (S16 / S13 offline-first).
2. **Imprimante thermique 58/80 mm (ESC/POS)** : l'impression actuelle est une
   mise en page A4/PDF. Le ticket thermique est prévu en **S14** ; le repère
   `@page` est déjà en place, il faudra une feuille de style dédiée
   (`size: 58mm auto`).
3. **Découpe** : les étiquettes sont centrées sur la page ; un massicot ou un
   gabarit d'étiquettes autocollantes A4 donne le meilleur rendu.

---

*Correctif S3 — `services/impression.ts`, `composants/commun/AssistantImpression.tsx`,
`styles/globaux.css` (§ impression), `TicketImprimable`, `TicketSuiviFamilialImprimable`,
`ManifesteVoyage`, `identite/carte`, `police/export`.*
