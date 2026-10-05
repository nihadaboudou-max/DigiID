# DigiID — Plan de travail priorisé

> **Principe** : on attaque **dans l'ordre**. On construit d'abord un **prototype de mémoire
> démontrable de bout en bout**, puis on élargit si le temps le permet.
> Chaque étape est **livrable et démontrable** indépendamment.
> Documents liés : `ARCHITECTURE_PLAN_B_LOGISTIQUE.md`, `ARCHITECTURE_FRONTEND_PLAN_B.md`,
> `ARCHITECTURE_ACCESSIBILITE_VOCALE.md`.

---

## Légende des priorités

| Niveau | Signification |
|--------|----------------|
| 🔴 **P0 — PROTOTYPE MÉMOIRE** | Indispensable pour la soutenance. On ne passe à la suite qu'une fois ceci fait. |
| 🟠 **P1 — Renfort** | Fortement souhaitable, différencie le projet, mais non bloquant. |
| 🟢 **P2 — SUITE / V2** | Vision complète, à faire **après** le mémoire, si le temps le permet. |

**Ordre d'attaque = P0 → P1 → P2.** À l'intérieur de P0, on suit les sprints ci-dessous.

---

## Vue d'ensemble (chemin critique)

| # | Étape | Priorité | Dépend de | Taille |
|---|-------|----------|-----------|--------|
| **S1** | Référentiel logistique (gares, lignes, véhicules, voyages, acteurs) + rôles | 🔴 P0 | — | M |
| **S2** | Colis de bout en bout (enregistrement + ticket QR + code clair + scan + timeline) | 🔴 P0 | S1 | L |
| **S3** | Interface receveur (guichet) + ticket imprimable/affichable | 🔴 P0 | S2 | M |
| **S4** | Interface chauffeur (scan en route) ✅ | 🔴 P0 | S2 | S |
| **S5** | Accessibilité v1 : sélecteur 4 langues + `BoutonVocal` + audios démo ✅ | 🔴 P0 | S3 | M |
| **S6** | Paiement minimal : commission + wallet + espèces / 1 opérateur (mock) ✅ | 🔴 P0 | S2 | M |
| **S7** | Suivi public (colis + familial) + SMS | 🔴 P0 | S2 | M |
| | **➜ FIN PROTOTYPE MÉMOIRE (démontrable)** | | | |
| **S8** | Refonte documents « 1 document = 1 table » | 🟠 P1 | — | L |
| **S9** | Bagages passagers + voyageurs | 🟠 P1 | S2 | M |
| **S10** | Score logistique chauffeur + avis + litiges | 🟠 P1 | S2 | M |
| **S11** | Espace commerçant + abonnements e-commerce | 🟠 P1 | S6 | M |
| **S12** | API certification VTC (facturation) | 🟠 P1 | S6, S8 | M |
| **S13** | Offline-first complet (Dexie + PWA) | 🟢 P2 | S4 | L |
| **S14** | Impression thermique Bluetooth (ESC/POS) | 🟢 P2 | S3 | M |
| **S15** | Mobile money réel (Wave/Orange/…) + facturation | 🟢 P2 | S6 | L |
| **S16** | Studio vocal complet + couverture 4 langues | 🟢 P2 | S5 | L |
| **S17** | Admin / super-admin logistique & paiements (dashboards) | 🟢 P2 | S2, S6 | M |

---

## 🔴 P0 — PROTOTYPE MÉMOIRE (à faire en priorité)

### Sprint 1 — Fondations + 1er parcours complet

#### Étape S1 — Référentiel logistique + rôles
- **Objectif** : avoir les données de base pour enregistrer un colis.
- **Contenu** : modèles + CRUD `gares`, `lignes`, `vehicules`, `voyages`, `acteurs_logistiques` ;
  ajout des rôles `receveur`, `chauffeur`, `commercant`, `gerant_gare` (+ groupes).
- **Livrable démontrable** : créer une gare, une ligne, un voyage, un receveur/un chauffeur.
- **Dépendances** : aucune.
- **Definition of done** : endpoints `/api/v1/logistique/{gares,lignes,vehicules,voyages,acteurs}`
  fonctionnels + migration Alembic + page admin de saisie minimale.

#### Étape S2 — Colis de bout en bout
- **Objectif** : le parcours central de la démo.
- **Contenu** : modèle `colis`, `tickets` (**QR + numéro en clair**), `colis_evenements` ;
  endpoints `POST /colis`, `GET /colis/{code}`, `POST /scan` (idempotent, règle **anti‑« DÉJÀ LIVRÉ »**),
  timeline.
- **Livrable démontrable** : enregistrer un colis → obtenir un ticket → scanner → livrer →
  (re‑scanner = « déjà livré »).
- **Dépendances** : S1, `qr_dynamique` (existant).
- **Definition of done** : cycle complet vert en API + tests manuels.

### Sprint 2 — Interfaces terrain + voix

#### Étape S3 — Interface receveur (guichet)
- **Objectif** : écran guichet utilisable par un receveur peu scolarisé.
- **Contenu** : espace `/receveur` (dashboard, assistant colis 4 étapes, ticket imprimable,
  scan/livraison) ; `BarreLaterale` (rôle receveur).
- **Livrable démontrable** : démo guichet de bout en bout.
- **Dépendances** : S2.

#### Étape S4 — Interface chauffeur ✅ (fait)
- **Objectif** : lister les colis d'un voyage et scanner.
- **Contenu** : espace `/chauffeur` — `dashboard` (mes voyages + compteurs de colis), `voyages/[id]`
  (liste des colis à bord + scan par colis), `scan` (QR/code clair, action « mise en transit » par défaut,
  rattachement au voyage via `voyage_id`). Navigation `BarreLaterale`/`MenuMobile` + redirection de
  connexion (`cheminTableauDeBord`) câblées.
- **Livrable démontrable** : chauffeur qui scanne en route.
- **Dépendances** : S2.

#### Étape S5 — Accessibilité v1 (voix + langues) ✅ (fait)
- **Objectif** : rendre la démo accessible aux non‑lecteurs.
- **Contenu** : `ContexteLangue` + sélecteur **4 langues** (Dendi/Bariba/Fon/FR, choix à l'oreille) ;
  `BoutonVocal` sur le parcours colis ; `GestionnaireAudio` ; **petit jeu d'audios démo**
  (accueil, boutons clés, confirmations) — enregistrés pour le FR et le Fon au minimum.
- **Réalisé** : `src/i18n/` (`langues.ts`, `useLangue.tsx`, `gestionnaire_audio.ts`, `audios.ts`,
  `fr/fon/dendi/bariba.json`) ; `src/composants/accessibilite/` (`SelecteurLangue`, `BoutonVocal`,
  `BoutonMuet`) ; sélecteur sur l'accueil + Paramètres ; `BoutonVocal` sur l'assistant colis, le scan
  et les tableaux de bord receveur/chauffeur ; repli **TTS** automatique tant que les `.mp3`
  ne sont pas déposés dans `public/audios/` (structure + `README` fournis).
- **Livrable démontrable** : cliquer un bouton → la voix explique (dans la langue choisie).
- **Dépendances** : S3.
- **Definition of done** : bouton muet fonctionne, FR + 1 langue locale opérationnels,
  repli audible si un audio manque. ✅

### Sprint 3 — Argent + suivi (clôt le prototype)

#### Étape S6 — Paiement minimal ✅ (fait)
- **Objectif** : montrer le modèle économique (**frais de service par nombre d'articles du
  colis** : 100 FCFA (1-3 articles), 200 FCFA (4-6), 350 FCFA (7-10), 500 FCFA (au-delà) —
  dont une commission **progressive** au receveur : 25 / 50 / 80 / 150 FCFA). Le **prix du
  transport** du colis reste une information facultative du guichet : il n'est jamais
  encaissé par DigiID.
- **Contenu** : `transactions_paiement`, `commissions`, `portefeuilles`, `mouvements_portefeuille` ;
  moyen **espèces** (wallet interne) + **1 opérateur mobile money en mode mock** ;
  crédit automatique de la cagnotte du receveur.
- **Réalisé** : modèles + migration Alembic (`portefeuilles`, `mouvements_portefeuille`,
  `transactions_paiement`, `commissions`) ; module `src/modules/paiement/` (schemas, service,
  `tarification.py` = barème par nombre d'articles, routes, `mobile_money/` mock Wave +
  espèces) ; permissions `paiement.lire` / `paiement.payer` ; config
  `bareme_frais_service_colis="1-3:100:25,4-6:200:50,7-10:350:80,11+:500:150"` +
  `frais_scan_agent_fcfa=100` (compte prépayé de l'agent) ; colonne `colis.nombre_articles`.
  Garanties : **un seul prélèvement par colis** (contrôle applicatif + index unique partiel)
  et idempotence (`idempotency_key`). Frontend : `PortefeuilleCarte`, `PaiementColis`
  (montant imposé par le barème, plus de saisie libre), page `/receveur/cagnotte`,
  encaissement intégré au ticket (enregistrement + fiche colis), navigation « Ma cagnotte ».
- **Livrable démontrable** : enregistrer un colis → encaisser le **frais de service**
  (100 / 200 / 350 / 500 FCFA selon le nombre d'articles — espèces ou Wave mock)
  → **25 à 150 FCFA** créditent la cagnotte du receveur (visible sur `/receveur/cagnotte`).
- **Dépendances** : S2.

#### Étape S7 — Suivi public + SMS
- **Objectif** : inclure les familles (fort impact social pour le mémoire).
- **Contenu** : page publique `/suivi/[code]` (colis **et** suivi familial enfant) ;
  SMS départ/arrivée (via `noyau/notification`, mode mock puis réel).
- **Livrable démontrable** : ouvrir un lien de suivi + recevoir/voir un SMS simulé.
- **Dépendances** : S2.

> ✅ **À la fin de S7 : le prototype de mémoire est complet et démontrable.**

---

## 🟠 P1 — Renfort (si le temps permet, avant ou autour du mémoire)

#### Étape S8 — Refonte documents « 1 document = 1 table »
- Base commune `BaseDocumentInspection` + tables par type + `inspection_documents` en index ;
  rendu inspection **par type** côté frontend.
- **Intérêt** : qualité de code + cohérence (structure déjà décrite dans l'architecture).
- **Dépendances** : aucune (peut se faire en parallèle).

#### Étape S9 — Bagages passagers + voyageurs
- Bagages en soute, étiquettes, liste passagers d'un voyage, matching à l'arrivée.
- **Dépendances** : S2.

#### Étape S10 — Score logistique chauffeur + avis + litiges
- Score 40/30/20/10 (réutilise `scoring`), avis e‑commerçants, litiges.
- **Dépendances** : S2.

#### Étape S11 — Espace commerçant + abonnements
- Espace `/commercant`, plans Starter/Premium, décompte de quota.
- **Dépendances** : S6.

#### Étape S12 — API certification VTC
- Clés API partenaires + facturation 150 FCFA/vérification (réutilise inspection).
- **Dépendances** : S6, S8.

---

## 🟢 P2 — SUITE / vision complète (après le mémoire)

| Étape | Contenu |
|-------|---------|
| **S13** | Offline-first complet : IndexedDB/Dexie, file de synchronisation idempotente, PWA installable. |
| **S14** | Impression thermique Bluetooth ESC/POS (tickets + étiquettes). |
| **S15** | Mobile money réel (Wave / Orange Money / MTN / Moov) + webhooks + facturation/export. |
| **S16** | Studio vocal admin + couverture audio **complète** des 4 langues. |
| **S17** | Dashboards admin/super-admin logistique & paiements, monitoring métier. |

---

## Ce qu'on montre en soutenance (scénario de démo)

1. **Accueil** : choix de la langue **à l'oreille** (Dendi/Fon/Bariba/FR).
2. **Guichet (receveur)** : enregistrer un colis (guidé par la voix) → **ticket QR + numéro en clair**.
3. **Scan livraison** : QR ou **code clair** → livré ; re‑scan → **« DÉJÀ LIVRÉ »** (anti‑fraude).
4. **Paiement** : frais de service **100 FCFA** (1-3 articles ; 200 F à 4-6, 350 F à 7-10,
   500 F au-delà) → **25 FCFA** (jusqu'à 150 F) créditent la cagnotte du receveur.
5. **Chauffeur** : scan en route, liste des colis du voyage.
6. **Famille** : ouvrir le lien de suivi `/suivi/[code]` + SMS reçu.
7. **Voix** : chaque bouton parle dans la langue choisie (démonstration marquante).

---

## Prochaine action immédiate

> **S1 → S6 livrées.** Démarrer l'**Étape S7 — Suivi public + SMS**.

Rappel de ce qui est en place côté logistique :
- **S1** : référentiel (gares, lignes, véhicules, voyages, acteurs) + rôles.
- **S2/S3** : colis de bout en bout, tickets QR + code clair, scan idempotent, espace receveur.
- **S4** : espace chauffeur (`/chauffeur/dashboard`, `/chauffeur/voyages/[id]`, `/chauffeur/scan`).
- **S5** : accessibilité v1 — sélecteur 4 langues (Dendi/Bariba/Fon/FR), `BoutonVocal`,
  `GestionnaireAudio` (repli TTS), bouton muet ; audios à déposer dans `public/audios/`.
- **S6** : paiement minimal — API `/api/v1/paiement` (wallet, transactions, commissions,
  `GET /tarifs`), **frais de service par nombre d'articles** 100/200/350/500 FCFA dont
  **25 à 150 FCFA** au receveur (espèces / Wave mock), compte prépayé de l'agent débité
  de 100 FCFA par scan en espèces, un seul prélèvement par colis, page `/receveur/cagnotte`.

Prochaine étape S7 : suivi public `/suivi/[code]` (colis + familial) et SMS départ/arrivée (mock).

---

*Fin du plan.*
