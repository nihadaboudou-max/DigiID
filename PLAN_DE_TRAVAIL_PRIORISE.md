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
| **S7** | Suivi public (colis + familial) + SMS ✅ | 🔴 P0 | S2 | M |
| **P0+** | Correctifs revue : passagers, bagages, attribution chauffeur, actions groupées ✅ | 🔴 P0 | S2, S7 | M |
| | **➜ FIN PROTOTYPE MÉMOIRE (démontrable)** | | | |
| **S8** | Refonte documents « 1 document = 1 table » | 🟠 P1 | — | L |
| **S9** | Bagages passagers + voyageurs ✅ (avancé en P0+) | 🟠 P1 | S2 | M |
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

#### Étape S7 — Suivi public + SMS ✅ (fait)
- **Objectif** : inclure les familles (fort impact social pour le mémoire).
- **Contenu** : page publique `/suivi/[code]` (colis **et** suivi familial enfant) ;
  SMS départ/arrivée (via `noyau/notification`, mode mock puis réel).
- **Réalisé** :
  - **Suivi familial** : modèles `suivi_familial`, `suivi_familial_evenements`,
    `notifications_logistique` + migration Alembic (`20260816_1000_suivi_familial_sms`) ;
    routes `/api/v1/logistique/suivi-familial` (créer un enfant → ticket ``ENFANT``
    `ENF-<gare>-<année>-NNNNNN` + QR, lister, détail, timeline, notifications) ;
    étapes **départ** / **arrivée** idempotentes (`idempotency_key`) déclenchant le SMS
    au parent **une seule fois** (garde-fous `sms_depart_envoye` / `sms_arrivee_envoye`).
  - **SMS (mock)** : `noyau/notification.construire_message_colis` /
    `construire_message_suivi_familial` + journal `notifications_logistique` (le SMS
    simulé devient **visible** dans l'interface : destinataire masqué, message, horodatage).
    Les scans de colis (départ / transit / arrivée / livraison) notifient aussi
    destinataire **et** expéditeur.
  - **Suivi public sans connexion** : `GET /api/v1/logistique/public/suivi/{code}`
    (code clair **ou** token QR) → page `/suivi/[code]` (timeline, gares, véhicule,
    SMS émis) — accessible à la famille sans compte.
  - **Frontend guichet** : `/receveur/suivi-familial` (liste + filtres + compteurs,
    boutons « Marquer le départ / l'arrivée »), `/receveur/suivi-familial/nouveau`
    (assistant d'enregistrement + ticket imprimable `ENF-…` + lien de suivi),
    entrée « Suivi familial » dans la navigation 
    (barre latérale, menu mobile, tableau de bord receveur/chauffeur).
- **Livrable démontrable** : enregistrer un enfant au guichet → imprimer son ticket
  `ENF-…` → marquer le départ puis l'arrivée (SMS journalisés) → ouvrir le lien de suivi
  `/suivi/ENF-…` depuis un navigateur **sans connexion**.
- **Dépendances** : S2.

> ✅ **S1 → S7 livrées : le prototype de mémoire est complet et démontrable.**

---

### Correctifs P0+ — Passagers, bagages & attribution (revue) ✅ (fait)

> Ensemble d'ajustements demandés après revue, avant la bascule en P1. Ils renforcent le
> réalisme terrain (anti‑fraude bagages, attribution obligatoire, gestes groupés du chauffeur)
> sans changer l'architecture.

#### 1. Passagers : enfant **ou** adulte
- **But** : un même parcours gère un **enfant confié à un tiers** (fort impact social) et un
  **adulte voyageant seul**.
- **Contenu** : champ `suivi_familial.type_passager` (`enfant` | `adulte`) ; contacts adaptés :
  - *enfant* → **acheteur du ticket** (nom + téléphone, obligatoires) ;
  - *adulte* → **numéro du passager** (obligatoire).
- **Champs** : `suivi_familial.acheteur_nom/acheteur_tel`, `telephone_passager` ; le champ
  `telephone_parent` reste le « responsable principal » (rempli automatiquement).

#### 2. Contacts : proche de confiance obligatoire
- **But** : garantir qu'une **2ᵉ personne** est prévenue (numéro de secours).
- **Contenu** : `suivi_familial.proche_nom` + `proche_telephone` (**obligatoire**, ≥ 6 chiffres).
  Le proche reçoit les SMS de **confirmation**, **départ**, **pré‑alerte** et **arrivée**
  (ajouté à `_notifier_suivi` et `envoyer_pre_alerte_voyage`).

#### 3. Attribution obligatoire : trajet **+** voyage **+** chauffeur
- **But** : on sait toujours **qui** transporte **qui**, **d'où** vers **où**.
- **Contenu** : `voyage_id` **et** `chauffeur_id` rendus **obligatoires** sur `ColisCreate` et
  `SuiviFamilialCreate` (nouvelles colonnes `colis.chauffeur_id`, `suivi_familial.chauffeur_id`) ;
  contrôle de cohérence (le chauffeur fourni = chauffeur du voyage) → `400`.
  Côté frontend, le chauffeur est **déduit du voyage sélectionné** (moins de saisie, moins d'erreur).

#### 4. Bagages : 1 à 10 sacs, une étiquette QR par sac
- **But** : traçabilité + **anti‑fraude** (le nombre de sacs annoncé est vérifié à l'arrivée),
  **sans jamais impacter le prix**.
- **Contenu** : nouveau modèle `bagages` (migration `20260817_1000_p0_passagers_bagages`) —
  une ligne par sac + un `Ticket(type="BAGAGE")` (QR + code `SAC-…`) ; `colis.nombre_bagages` /
  `suivi_familial.nombre_bagages` (1 à 10) ; `_creer_bagages()` à l'enregistrement ;
  `lister_bagages()` (bagages embarqués dans les réponses colis/suivi).
- **Frontend** : composant `ControleurBagages` (compteur tactile), impression d'**autant
  d'étiquettes QR que de sacs** (tickets colis **et** passager), affichage du nombre de sacs
  sur la page de suivi publique.

#### 5. Tarif passager **fixe** : 100 FCFA (quel que soit le nombre de sacs)
- **Contenu** : `paiement/tarification.frais_service_passager()` + config
  `frais_service_passager_fcfa = 100` ; exposé par `SuiviFamilialResponse.frais_service_fcfa`.

#### 6. Actions groupées du chauffeur (« un seul geste »)
- **But** : un chauffeur ne peut pas scanner 40 QR un par un. On lui donne **un bouton par étape**,
  qui traite **à la fois** les passagers **et** les colis du voyage.
- **Contenu** (service + routes, permission `logistique.scan`) :
  - `POST /voyages/{id}/depart` → « Valider le Départ » (passagers + colis en route, SMS).
  - `POST /voyages/{id}/arrivee` → « Arrivés » (par gare ou tout le voyage, SMS).
  - `POST /voyages/{id}/pre-alerte` → « Prévenir de l'approche » (SMS pré‑alerte familles,
    proches, acheteurs, destinataires, expéditeurs).
- **Schémas** : `ActionLotVoyageRequest/Response`, `PreAlerteRequest/Response` ;
  helpers `_colis_du_voyage` / `_passagers_du_voyage`.
- **Frontend** : composant `ActionsVoyageChauffeur` (3 boutons + confirmation) **et** liste des
  passagers à bord ajoutés à `/chauffeur/voyages/[id]`.

#### 7. Suivi public enrichi
- `GET /public/suivi/{code}` expose désormais `type_passager` et `nombre_bagages`
  (colis **et** passager) ; la page `/suivi/[code]` affiche le **nombre de sacs**.

> **Vérifications** : `alembic heads` = `20260817_1000_p0_passagers_bagages` (tête unique) ;
> imports backend + `tsc --noEmit` frontend verts.

---

## 🟠 P1 — Renfort (si le temps permet, avant ou autour du mémoire)

#### Étape S8 — Refonte documents « 1 document = 1 table »
- Base commune `BaseDocumentInspection` + tables par type + `inspection_documents` en index ;
  rendu inspection **par type** côté frontend.
- **Intérêt** : qualité de code + cohérence (structure déjà décrite dans l'architecture).
- **Dépendances** : aucune (peut se faire en parallèle).

#### Étape S9 — Bagages passagers + voyageurs ✅ (avancé en P0+)
- Bagages en soute, étiquettes, liste passagers d'un voyage, matching à l'arrivée.
- **Réalisé (P0+)** : étiquettes QR **une par sac** (1 à 10, sans impact sur le prix),
  **liste des passagers à bord** sur `/chauffeur/voyages/[id]`, actions groupées du chauffeur.
- **Reste éventuel** : matching/validation anti‑fraude du nombre de sacs **à l'arrivée**
  (scan des étiquettes `SAC-…` et rapprochement avec `nombre_bagages`).
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
   Choisir **nombre d'articles** **et** **nombre de sacs (1‑10)** → **autant d'étiquettes QR que de sacs**.
3. **Scan livraison** : QR ou **code clair** → livré ; re‑scan → **« DÉJÀ LIVRÉ »** (anti‑fraude).
4. **Paiement** : frais de service **100 FCFA** (1-3 articles ; 200 F à 4-6, 350 F à 7-10,
   500 F au-delà) → **25 FCFA** (jusqu'à 150 F) créditent la cagnotte du receveur.
5. **Passager / suivi familial** : enregistrer un **enfant** (acheteur + **proche de confiance**)
   ou un **adulte** (son numéro), avec **trajet + voyage + chauffeur obligatoires** → ticket `ENF-…`
   (frais fixe **100 F**, quel que soit le nombre de sacs) + étiquettes sacs.
6. **Chauffeur** : **actions groupées** — « Valider le Départ », « Prévenir de l'approche »,
   « Arrivés » (passagers **et** colis en un clic) + liste des passagers à bord.
7. **Famille** : ouvrir le lien de suivi `/suivi/[code]` (nombre de sacs inclus) + SMS reçu.
8. **Voix** : chaque bouton parle dans la langue choisie (démonstration marquante).

---

## Prochaine action immédiate

> **S1 → S7 + correctifs P0+ livrés.** Le prototype de mémoire est **complet et démontrable**,
> avec passagers enfant/adulte, proche de confiance obligatoire, attribution
> (trajet + voyage + chauffeur) obligatoire, bagages traçables (1‑10 sacs) et actions
> groupées du chauffeur.
> Prochaine étape possible : **S8 — Refonte documents « 1 document = 1 table »** (P1).
> *Reste optionnel sur S9* : validation anti‑fraude du **nombre de sacs à l'arrivée** par scan
> des étiquettes `SAC-…`.

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
- **S7** : suivi public + SMS — API `/api/v1/logistique/suivi-familial` (ticket ``ENFANT`` +
  étapes départ/arrivée idempotentes), `GET /public/suivi/{code}` (sans connexion), journal
  `notifications_logistique` (SMS mock visibles) ; pages `/suivi/[code]`,
  `/receveur/suivi-familial` (+ `/nouveau`), entrées de navigation guichet/chauffeur.
- **P0+** : correctifs revue — passagers **enfant/adulte**, **proche de confiance** obligatoire,
  **attribution obligatoire** (trajet + voyage + chauffeur), **bagages** `1‑10` sacs avec une
  **étiquette QR par sac** (`bagages` + tickets `BAGAGE`, migration
  `20260817_1000_p0_passagers_bagages`), tarif passager **fixe 100 FCFA**, **actions groupées**
  du chauffeur (`POST /voyages/{id}/depart|arrivee|pre-alerte` + composant
  `ActionsVoyageChauffeur`) et **liste des passagers** sur `/chauffeur/voyages/[id]`.

**Prochaine étape proposée** : S8 — refonte documents « 1 document = 1 table ».

---

*Fin du plan.*
