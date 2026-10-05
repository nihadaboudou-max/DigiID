# DigiID — Architecture cible « Plan B : Pivot Logistique »

> **Document de structure générale — à valider AVANT toute écriture de code.**
> Aucun module existant n'est supprimé. Tout ce qui n'est pas activé en v1 est
> conservé et documenté dans la section « Perspectives ».
> Le moyen de paiement est intégré de bout en bout (plateforme complète).

---

## 0. Résumé exécutif — décisions structurantes

| # | Décision | Conséquence |
|---|----------|-------------|
| 1 | **Ajout par-dessus, jamais de suppression.** | Les 36 modules backend et tous les écrans frontend restent intacts. |
| 2 | **Nouveau domaine métier `logistique`** (colis, bagages, voyageurs, suivi familial, score). | Nouveau préfixe `/api/v1/logistique/*`. |
| 3 | **Nouveau domaine `paiement`** (wallet, mobile money, commissions, abonnements, API de certification). | Nouveau préfixe `/api/v1/paiement/*`. |
| 4 | **Refonte `inspection_documents` : 1 document = 1 table spécialisée** (plus de `donnees_specifiques` JSON fourre-tout). | Base commune + classes filles. `inspection_documents` devient le **journal/index de scan**. |
| 5 | **Offline-first** au guichet et en route (PWA + file de synchronisation idempotente). | Nouveau module `synchronisation`. |
| 6 | **Le paiement fait partie du cœur v1** (pas une option). | Wallet + adaptateurs mobile money + reversement cagnotte dès la phase paiement. |
| 7 | **Nouveaux rôles** : `receveur`, `chauffeur`, `commercant`, `gerant_gare`. | Extension de `constantes_roles.py` + RBAC existant. |
| 8 | **Accessibilité « sans lecture »** : public peu scolarisé → UI simple, **guidage audio au clic**, **4 langues** (Dendi, Bariba, Fon, Français). | Nouveau module `i18n` + composants `BoutonVocal`/`AssistantVocal` + sélecteur de langue à l'oreille. Voir `ARCHITECTURE_ACCESSIBILITE_VOCALE.md`. |

---

## 1. État des lieux actuel

### 1.1 Backend (`backend/src`)

```
api/v1/routeur_principal.py     → assemble ~30 routeurs
modeles/                        → ~45 modèles SQLAlchemy 2.0
modules/                        → 36 modules métier
noyau/                          → chiffrement, journal, permissions, redis,
                                  notification (email/SMS/appel), stockage_photos…
middleware/ , schemas/ , services/ , config/ , base_donnees/
```

**Modules existants (36)** :
`admin, admin_domaine, attestations_communautaires, authentification, chatbot, chefs,
consentements, departements, detection_fraude, documents, documents_identite, domaines,
enrolement, equipes, gamification, inspection_documents, invitations, medical, monitoring,
ocr_assurance, ocr_carte_grise, ocr_carte_sejour, ocr_cni, ocr_consulaire, ocr_passeport,
ocr_permis, ong, police, profil, qr_dynamique, recherche_faciale, roles, scoring, securite,
super_admin, ui_permissions, utilisateurs, verification, verification_visuelle`

**Rôles actuels** : `super_admin`, `admin_domaine`, `chef_police|medical|ong|agent`,
`agent_police|medical|ong|terrain`, `citoyen`.

### 1.2 Frontend (`frontend/src` — Next.js App Router)

Espaces existants : citoyen (`/`), `/admin`, `/super-admin`, `/admin-domaine`,
`/chef-*`, `/agent`, `/police`, `/medecin`, `/ong`, `/inspection`, `/documents-identite`.
Navigation centralisée dans `composants/layouts/BarreLaterale.tsx` (switch par rôle).

### 1.3 `inspection_documents` aujourd'hui

- **1 route unique** `POST /api/v1/inspection-documents/upload` (ou `/api/v1/inspection-documents/upload` selon câblage).
- `facade.py` aiguille vers des **adaptateurs** (`adaptateurs/cni.py`, `permis.py`, `assurance.py`,
  `carte_grise.py`, `carte_sejour.py`, `consulaire.py`, `passeport.py`).
- Chaque adaptateur délègue à un module `ocr_*` qui **écrit déjà dans une table dédiée** :
  `permis_conduire`, `assurances_auto`, `carte_grise`, `carte_sejour`, `consulaire`,
  `passeport`, `verification_cni`.
- **MAIS** : la façade réécrit en plus une ligne dans la table centrale `inspection_documents`
  avec un champ `donnees_specifiques` (JSON fourre-tout) → **double écriture** et **perte de typage**.

### 1.4 Déjà exploitable pour le Plan B (à réutiliser tel quel)

| Brique existante | Réutilisation logistique |
|------------------|--------------------------|
| `qr_dynamique` | QR **dynamique** (ticket, étiquette colis) + rotation token. |
| `noyau/notification.py` | SMS (départ/arrivée), reçus, codes. |
| `noyau/stockage_photos.py` | Photos colis/bagages, preuve de livraison. |
| `enrolement` + `equipes` + `chefs` | Modèle pour rattacher receveurs/chauffeurs à une gare. |
| `domaines` / `departements` | Cloisonnement des gares par zone. |
| `scoring` (moteur pondéré + XGBoost) | Squelette du **score de confiance logistique**. |
| `detection_fraude` | Règles anti-double-scan / anti-photocopie. |
| `audit` | Traçabilité immuable de chaque scan/paiement. |
| `inspection_documents` | Certification d'identité (API VTC, receveurs, chauffeurs). |

### 1.5 Ce qui manque (à créer)

- Domaine **logistique** complet (gares, lignes, véhicules, colis, bagages, voyageurs, suivi).
- Domaine **paiement** complet (wallet, mobile money, commissions, abonnements, facturation).
- **Rôles** receveur / chauffeur / commerçant / gérant de gare.
- **Offline-first** et **impression thermique**.
- **Refonte** des tables documents.

---

## 2. Principes d'architecture (règles non négociables)

1. **Additif** : aucun module supprimé ; les tables existantes évoluent, ne disparaissent pas.
2. **Une responsabilité par module** (services sans dépendance au framework, routes = orchestration).
3. **Tout en français** (dossiers, fonctions, commentaires) — cohérence mémoire.
4. **Aucun secret en dur** — tout via `config` / `.env` (clés mobile money, SMS, clés API partenaires).
5. **Idempotence par défaut** sur tout ce qui est scan/paiement (clé d'idempotence unique).
6. **Traçabilité totale** : chaque scan, chaque mouvement financier → `journal_audit`.
7. **Rétrocompatibilité** : les écrans et endpoints existants continuent de fonctionner.
8. **Cloisonnement par domaine** (une gare = un domaine) pour la confidentialité et le RBAC.

---

## 3. Refonte `inspection_documents` — « 1 document = 1 table »

### 3.1 Problème actuel

- Le champ `donnees_specifiques` (JSON) sert de fourre-tout → requêtes impossibles, pas de validation, pas d'index.
- Double écriture (`inspection_documents` + table métier).
- Les tables métier (`permis_conduire`, `assurances_auto`…) n'ont pas les colonnes communes
  de qualité/validation/soft-delete présentes dans `InspectionDocument`.

### 3.2 Modèle cible — héritage par mixin

On extrait de `InspectionDocument` une **base commune abstraite** `BaseDocumentInspection`
(mixin SQLAlchemy) contenant **tous les champs communs** :

```
id (UUID, PK)
utilisateur_id (FK utilisateur, index)
type_document, face
— métadonnées fichier —
nom_fichier, type_mime, taille_octets, document_chemin
— identité commune —
nom_famille, prenoms, date_naissance, sexe,
numero_document, date_expiration, lieu_naissance,
date_delivrance, autorite_delivrance, nationalite, taille
— MRZ —
mrz_ligne_1, mrz_ligne_2, mrz_ligne_3, mrz_valide
— OCR —
texte_brut, taux_confiance_ocr
— validation —
statut, est_valide, scores_validation (JSON : booléens par contrôle)
— audit / soft-delete —
cree_le, modifie_le, est_supprime, date_suppression
```

Puis **une table concrète par type de document**, qui hérite du mixin et **ajoute ses
propres colonnes typées** (plus de JSON) — c'est ce que tu demandes : *chaque document
a sa table, avec toutes les informations nécessaires*.

### 3.3 Liste des tables documents

| Table | Champs spécifiques (en plus de la base commune) |
|-------|---------------------------------------------------|
| `documents_cni` | `profession`, `taille_cm`, `format_carte` (nouveau_2021/ancien), `code_pays` |
| `documents_passeport` | `code_pays`, `type_passeport`, `lieu_delivrance`, `date_naissance_mrz` |
| `documents_permis` | `categories` (JSON : ["A","B"]), `date_premiere_delivrance`, `lieu_delivrance`, `centre_examen` |
| `documents_assurance` | `compagnie`, `numero_contrat`, `immatriculation`, `marque`, `modele`, `type_couverture`, `date_effet` |
| `documents_carte_grise` | `immatriculation`, `numero_chassis` (VIN), `numero_moteur`, `marque`, `modele`, `genre`, `carrosserie`, `energie`, `puissance_fiscale_cv`, `nombre_places`, `poids_total_kg`, `date_premiere_mise_circulation`, `numero_formule`, `titulaire_nom`, `titulaire_prenoms`, `titulaire_adresse` |
| `documents_carte_sejour` | `type_titre`, `numero_titre`, `categorie`, `adresse`, `poste_consulaire` |
| `documents_consulaire` | `numero_immatriculation_consulaire`, `profession`, `situation_matrimoniale`, `adresse`, `poste_consulaire`, `numero_passeport`, `personnes_a_charge` |
| `documents_vote` | `numero_electeur`, `bureau_vote`, `circonscription` |
| `documents_etudiant` | `numero_etudiant`, `etablissement`, `filiere`, `annee_academique` |

> Les tables existantes (`permis_conduire`, `assurances_auto`, `carte_grise`,
> `carte_sejour`, `consulaire`, `passeport`, `verification_cni`) sont **migrées/alignées**
> sur ce mixin (ajout des colonnes communes manquantes) — **jamais supprimées**.

### 3.4 `inspection_documents` : rôle recentré = **journal/index de scan**

La table `inspection_documents` est **conservée** mais change de rôle : elle devient un
**index léger** de tous les scans (pour l'historique unifié côté frontend), pointant vers
la table spécialisée :

```
inspection_documents
  id, utilisateur_id, type_document, face,
  table_cible (ex: "documents_carte_grise"), document_id (FK logique),
  statut, taux_confiance_ocr, nom_fichier, cree_le, est_supprime
```

Avantage : l'endpoint **unique** d'historique continue de fonctionner ; les données
détaillées vivent dans des tables **typées et indexées**.

### 3.5 Impact

- **Backend** : `modeles/base_document.py` (mixin) ; `modeles/documents/*.py` (tables) ;
  `facade.py` écrit dans la bonne table + une ligne d'index ; les adaptateurs renvoient
  toujours la **réponse unifiée** (`ReponseDocumentUnifie`).
- **API** : endpoints inchangés (`upload`, `historique`, `synthese`, `supprimer`, `restaurer`)
  + nouveaux endpoints par type (`GET /documents/carte-grise/{id}`…).
- **Frontend** : `types/inspection.ts` et `app/inspection/page.tsx` — rendu **par type**
  (`CHAMPS_PAR_TYPE`) au lieu du générique.
- **Migration Alembic** : créer les nouvelles tables, migrer l'historique, garder
  `donnees_specifiques` en lecture seule le temps de la transition.

---

## 4. Architecture cible — domaine LOGISTIQUE

Préfixe API : **`/api/v1/logistique/*`**. Dossier : `backend/src/modules/logistique/`.

### 4.1 Modules backend

| Module | Responsabilité | Endpoints clés (exemples) |
|--------|----------------|---------------------------|
| `gares` | Gares, points de départ/arrivée | `GET /gares`, `POST /gares` |
| `lignes` | Lignes (Cotonou↔Parakou), arrêts | `GET /lignes`, `GET /lignes/{id}/horaires` |
| `vehicules` | Bus, immatriculation, capacité | `CRUD /vehicules` |
| `voyages` | Un trajet daté (chauffeur + véhicule + ligne) | `POST /voyages`, `POST /voyages/{id}/cloturer` |
| `acteurs` | Receveurs & chauffeurs rattachés à une gare | `CRUD /acteurs` |
| `colis` | Enregistrement + cycle de vie colis | `POST /colis`, `GET /colis/{code}`, `POST /colis/{id}/livrer` |
| `bagages` | Bagages voyageurs en soute + étiquettes | `POST /bagages`, `POST /bagages/{id}/scanner` |
| `voyageurs` | Passagers d'un voyage | `POST /voyageurs`, `GET /voyages/{id}/voyageurs` |
| `tickets` | Génération **QR + numéro en clair** | `POST /tickets`, `GET /tickets/{code_clair}` |
| `scans` | Cœur anti-fraude : 1 scan = 1 événement idempotent | `POST /scans` |
| `suivi_familial` | Enfants seuls : parents, SMS départ/arrivée | `POST /suivi-familial`, `GET /suivi-familial/{id}` |
| `score_logistique` | Score de confiance chauffeur (0-100) | `GET /score-logistique/{chauffeur_id}` |
| `avis` | Avis e-commerçants post-livraison | `POST /avis` |
| `litiges` | Litiges/pertes → impact score | `POST /litiges` |
| `notifications_logistique` | SMS départ/arrivée/livraison | (interne) |
| `synchronisation` | Upload batch offline + résolution de conflits | `POST /synchronisation/lot` |

### 4.2 Rôles & permissions (extension)

Ajout à `constantes_roles.py` (niveaux 3/4, sous `admin_domaine`) :

```
gerant_gare      (niveau 3) — administre une gare (lignes, acteurs, tarifs)
receveur         (niveau 4) — guichet : enregistre, imprime, scanne
chauffeur        (niveau 4) — consulter listes, scanner en route, score
commercant       (niveau 4) — expédie, suit ses colis, abonnement
```

Groupes fonctionnels : `ROLES_LOGISTIQUE = {gerant_gare, receveur, chauffeur}`.
`tuteur`/famille = citoyen (reçoit juste les SMS + page de suivi).

### 4.3 Schéma des tables (logistique)

```
gares(id, nom, code, ville, domain_id FK, actif, cree_le)
lignes(id, gare_depart_id, gare_arrivee_id, distance_km, duree_min, actif)
vehicules(id, immatriculation, marque, capacite, gare_id, actif)
voyages(id, ligne_id, vehicule_id, chauffeur_id, date_depart, date_arrivee, statut)
acteurs_logistiques(id, utilisateur_id, role, gare_id, numero_licence, actif)

colis(id, code_clair UNIQUE, qr_token, expediteur_id, destinataire_nom,
      destinataire_tel, description, poids_kg, valeur_fcfa,
      gare_depart_id, gare_arrivee_id, voyage_id, receveur_id, chauffeur_id,
      statut, frais_fcfa, cree_le, livre_le)
colis_evenements(id, colis_id, type_evenement, acteur_id, gare_id,
      localisation, horodatage, idempotency_key UNIQUE, synchro_le)

bagages(id, voyageur_id, voyage_id, etiquette_code_clair UNIQUE, qr_token,
      description, poids_kg, statut, cree_le)
bagage_evenements(id, bagage_id, type_evenement, acteur_id, ... )

voyageurs(id, voyage_id, nom, prenom, telephone, piece_identite_type,
      piece_identite_numero, ticket_id, cree_le)

tickets(id, code_clair UNIQUE, qr_token, type(COLIS|BAGAGE|PASSAGER|ENFANT),
      reference_id, voyage_id, statut, nb_scans, premier_scan_le, cree_le, imprime_le)

suivi_familial(id, enfant_nom, enfant_age, parent_id, telephone_parent,
      voyage_id, statut, sms_depart_envoye, sms_arrivee_envoye, cree_le)

score_logistique_chauffeur(id, chauffeur_id UNIQUE, score, taux_litiges,
      regularite, volume_colis, avis_moyen, couleur, calcule_le)
avis(id, chauffeur_id, commercant_id, colis_id, note, commentaire, cree_le)
litiges(id, colis_id, chauffeur_id, motif, gravite, resolu, montant_indemnise, cree_le)

evenements_synchronises(id, acteur_id, idempotency_key UNIQUE, payload JSON,
      recu_le, traite_le, statut)
```

### 4.4 Le ticket : QR + **numéro en clair** (innovation anti-fraude)

Chaque ticket/étiquette porte :
1. un **QR dynamique** (`qr_dynamique`) contenant un `qr_token` signé, rotatif ;
2. un **numéro de ticket écrit en clair** sous le QR (ex. `PK-2026-000123`).

Règles anti-fraude portées par le module `scans` :
- **Un seul scan « livraison » par ticket** : un 2ᵉ scan → statut **« DÉJÀ LIVRÉ »**.
- **Repli manuel** : si le QR est illisible, saisie du **code clair** → même traitement.
- **Idempotence** : chaque scan porte une `idempotency_key` (réseau instable/duplicata).
- **Réconciliation** : scan du bagage affiche le **propriétaire légitime** (récupération d'urgence).

### 4.5 Offline-first & synchronisation

- **Guichet (départ)** : enregistrement + impression **sans réseau** (file locale).
- **En route (chauffeur)** : scans stockés localement.
- Retour réseau → `POST /logistique/synchronisation/lot` : envoi par lots,
  **déduplication par `idempotency_key`**, résolution de conflits (dernière règle = priorité
  serveur pour le statut, horodatage client conservé pour la timeline).

### 4.6 Gateways externes

- **SMS** : étendre `noyau/notification.py` (`envoyer_sms` réel : Orange SMS API / Twilio /
  agrégateur local). Config via `.env`.
- **Impression thermique Bluetooth** : côté client (WebBluetooth / app mobile). Le backend
  ne fait que produire le **payload d'impression** (texte ESC/POS + QR + code clair).

---

## 5. Architecture cible — domaine PAIEMENT

Préfixe API : **`/api/v1/paiement/*`**. Dossier : `backend/src/modules/paiement/`.
Le paiement est **livré en v1** (plateforme complète).

### 5.1 Modules backend

| Module | Responsabilité |
|--------|----------------|
| `portefeuille` | Wallet receveur/chauffeur/commerçant, solde, mouvements |
| `transactions` | Ordonnancement d'un paiement (frais colis, abonnement, API) |
| `commissions` | Frais de service (barème **dégressif** 100/75/50 FCFA) → **25 FCFA reversés au receveur** |
| `mobile_money` | Adaptateurs Wave / Orange Money / MTN MoMo / Moov Money |
| `abonnements` | Packs e-commerce (Starter 5 000 FCFA/50 colis, Premium 15 000 FCFA illimité) |
| `api_certification` | Facturation API VTC (150 FCFA/vérification) + gestion des clés partenaires |
| `facturation` | Reçus, factures, export comptable |
| `webhooks_paiement` | Réception callbacks opérateurs (statut, échec, remboursement) |

### 5.2 Abstraction « fournisseur de paiement »

```
FournisseurPaiement (interface abstraite)
  ├── initier_paiement(montant, telephone, reference) -> PaymentIntent
  ├── verifier_statut(reference) -> Statut
  ├── rembourser(reference, montant) -> Statut
  └── traiter_webhook(payload) -> EvenementPaiement

Adaptateurs : WaveProvider, OrangeMoneyProvider, MtnMomoProvider, MoovProvider,
              EspecesProvider (guichet, offline), MockProvider (dev/tests)
```

Sélection du fournisseur par `.env` ; **mode mock par défaut en dev** (comme l'email/SMS).

### 5.3 Schéma des tables (paiement)

```
portefeuilles(id, proprietaire_id UNIQUE, solde_fcfa, devise, actif, maj_le)
mouvements_portefeuille(id, portefeuille_id, sens(CREDIT|DEBIT), montant,
      motif, reference_id, solde_apres, cree_le)

transactions_paiement(id, reference UNIQUE, payeur_id, beneficiaire_id,
      type(COLIS|BAGAGE|ABONNEMENT|API|REVERSEMENT), montant_fcfa,
      frais_plateforme, commission_receveur, montant_net, statut, moyen,
      telephone, cree_le, maj_le)
      -- index unique partiel : au plus UNE transaction active (en_attente|reussi)
      -- par colis → les frais de service ne sont prélevés qu'une seule fois

commissions(id, transaction_id, receveur_id, montant_fcfa, statut,
      portefeuille_id, verse_le)

> Deux montants **distincts** : le **prix du transport** (`colis.frais_fcfa`) est
> saisi — ou pas — au guichet, c'est le revenu du transporteur, DigiID ne l'encaisse
> **jamais** ; les **frais de service** (barème dégressif selon le nombre de colis
> suivis : 100 F, puis 75 F dès le 4ᵉ colis, 50 F dès le 8ᵉ) sont payés par le client.

plans_abonnement(id, code(STARTER|PREMIUM), libelle, prix_fcfa, quota_colis,
      illimite, actif)
abonnements(id, commercant_id, plan_id, statut, date_debut, date_fin,
      colis_utilises, renouvellement_auto, cree_le)

clients_api(id, nom, plateforme(VTC…), contact, statut, cree_le)
cles_api(id, client_api_id, cle_hash, prefixe, quota, actif, cree_le, revoquee_le)
verifications_api_facturation(id, client_api_id, cle_id, sujet_hash,
      montant_fcfa, statut, transaction_id, cree_le)

webhooks_paiement(id, fournisseur, reference, payload JSON, signature_valide,
      traite_le, cree_le)
```

### 5.4 Flux principaux

1. **Enregistrement d'un colis** :
   commerçant/receveur → `transactions` → `mobile_money.initier` (ou espèces wallet) →
   à confirmation webhook → **crédit wallet receveur de 25 FCFA** (`commissions` +
   `mouvements_portefeuille`) → génération du **ticket**. Le montant est le **frais de
   service** issu du barème dégressif (100/75/50 FCFA) ; le prix du transport du colis,
   facultatif, n'est pas encaissé par la plateforme.
2. **Abonnement e-commerce** : souscription → `abonnements` → décompte automatique des
   colis ; au-delà du quota → facturation à l'unité.
3. **API de certification (VTC)** : appel authentifié par `cles_api` → vérification
   documents (via `inspection_documents`/`verification`) → `verifications_api_facturation`
   (150 FCFA) → agrégé à la facture mensuelle.
4. **Reversement cagnotte** : cumul `commissions` → virement mobile money du receveur
   (seuil paramétrable).

### 5.5 Sécurité paiement

- Idempotence obligatoire (`reference` unique) ; **vérification de signature** des webhooks.
- Jamais de stockage de secrets opérateur en base — clés via `.env` / services.
- Journal d'audit **immuable** de tout mouvement financier.
- Double vérification du **webhook** avant crédit (initier ≠ confirmer).

---

## 6. Domaine DOCUMENTS — certification (réutilisation)

L'API de certification réutilise **telle quelle** la refonte `inspection_documents` :

```
POST /api/v1/logistique/certification/verifier
  → contrôle identité (inspection_documents) + score + listes de contrôle
  → facturation via paiement.api_certification (150 FCFA)
  → réponse signée (JSON + hash) vérifiable par la plateforme VTC
```

---

## 7. Architecture cible — FRONTEND & INTERFACES ADAPTÉES

> **Détail complet (wireframes écran par écran, navigation, composants, offline) :**
> voir le document dédié **`ARCHITECTURE_FRONTEND_PLAN_B.md`**.
> Ci-dessous la synthèse d'architecture.

### 7.0 Design system existant (à réutiliser, ne pas réinventer)

- **Palette « Terre & Lagune »** : `lagune` (principal), `ocre` (accent), `terre` (alerte),
  `sable`/`sable-clair` (fonds), `ardoise`/`ardoise-clair` (texte), `succes` (vert).
- **Composants communs** : `Carte`, `Tableau<T>`, `Bouton`, `ChampSaisie`, `ChampRecherche`,
  `Modal`, `ModalConfirmation`, `Alerte`, `Badge`, `BarreProgression`, `Icones`.
- **Squelette** : `layout.tsx` → `ConteneurLayout` → `BarreLaterale` (switch par rôle)
  + `EnTete` + `MenuMobile` + `main`.
- **Garde de route** : `EnvelopperEspaceProtege rolesAutorises={[...]}`.
- **Pattern routing** : un dossier par espace `app/<espace>/layout.tsx` puis `.../page.tsx`.

### 7.1 Principes d'interface (terrain)

1. **Mobile-first** : usage téléphone (receveur/chauffeur) ; gros boutons, formulaires courts.
2. **Hors-ligne d'abord** : bandeau réseau permanent, actions disponibles puis synchronisées.
3. **Une action = un écran clair** (2-3 étapes max, feedback immédiat).
4. **Le ticket est roi** : tout guichet se termine par impression (thermique) ou partage QR.
5. **Réutilisation maximale** des composants/styles existants.

### 7.2 Cartographie des espaces & écrans (nouveaux)

| Espace (URL) | Rôle | Écrans |
|--------------|------|--------|
| `/receveur` | Receveur de gare | `dashboard`, `colis/nouveau`, `bagage/nouveau`, `tickets` + `tickets/[id]`, `scan`, `cagnotte` |
| `/chauffeur` | Chauffeur | `dashboard`, `voyages` + `voyages/[id]`, `scan`, `score` |
| `/commercant` | E-commerce | `dashboard`, `expedier`, `colis` + `colis/[id]`, `abonnement`, `factures` |
| `/gare` | Gérant de gare | `dashboard`, `gares`, `lignes`, `vehicules`, `acteurs`, `litiges`, `statistiques` |
| `/suivi/[code]` | Famille / public | suivi d'un enfant (public, sans connexion) |
| `/citoyen` | Citoyen | + `mes-envois`, `ma-famille` |
| `/inspection` | Citoyen / agent | refonte **par type** de document |
| `/admin`·`/super-admin` | Admin | + sous-menus `logistique/*` et `paiements/*` |

### 7.3 Navigation (`BarreLaterale.tsx`) — ajouts par rôle

On ajoute des blocs de liens `{ href, libelle, Icone }` exactement sur le modèle des rôles
**receveur / chauffeur / commercant / gerant_gare**. Icônes à ajouter dans `Icones.tsx` :
`IconeColis`, `IconeBagage`, `IconeCamion`, `IconeTicket`, `IconeWallet`,
`IconeSynchronisation`.

### 7.4 Parcours clés (résumé)

- **Guichet** : assistant **3 étapes** (expéditeur/destinataire → détails → paiement) →
  **ticket QR + n° en clair** imprimable. Scan de livraison idempotent (anti-« DÉJÀ LIVRÉ »),
  avec **saisie du code clair** si le QR est illisible.
- **Chauffeur en route** : scan **hors-ligne** (file locale + badge « N en attente »).
- **Commerçant** : expédier, suivre (`SuiviTimeline`), gérer l'abonnement, télécharger les reçus.
- **Famille** : page publique `/suivi/[code]` + alertes SMS départ/arrivée.

### 7.5 Catalogue de composants (nouveaux)

**`composants/logistique/`** : `EnregistrementColis`, `EnregistrementBagage`,
`TicketImprimable`, `EtiquetteColis`, `QRScanner` (caméra + code clair),
`SuiviTimeline`, `ScanOffline`, `ListeVoyageColis`, `BarreHorsLigne`, `JaugeScore`.

**`composants/paiement/`** : `PortefeuilleCard`, `PaiementMobileMoney`,
`ChoixMoyenPaiement`, `RecuPaiement`, `SouscriptionAbonnement`.

**Couche services/types** : `services/logistiqueApi.ts`, `services/paiementApi.ts`,
`types/logistique.ts`, `types/paiement.ts` (pattern `client_api.ts` + upload XHR existant).

### 7.6 Refonte de l'écran INSPECTION (par type)

- `ExtractionResults` : lit `CHAMPS_PAR_TYPE[type]` et affiche les **libellés métier**
  (au lieu du rendu générique actuel), + **correction manuelle** d'un champ.
- CNI : vue `recto`/`verso` avec fusion des deux faces.
- `DocumentTypeSelector` : cartes cliquables (déjà en place, ajouter carte grise/consulaire).

### 7.7 Offline, PWA & impression

- **PWA** (`next-pwa`, `manifest.json`) + **IndexedDB (Dexie)** : table `file_evenements`
  (`idempotency_key`, `type`, `payload`, `statut`).
- **Hook** `useFileSync()` → `POST /logistique/synchronisation/lot` au retour réseau.
- **Impression thermique** `WebBluetooth` (ESC/POS 58 mm) ; fallback PDF/partage.
- **Cache** des voyages/lignes du jour pour démarrer sans réseau.

### 7.8 Accessibilité vocale & multilingue (public peu scolarisé)

> **Détail complet : voir `ARCHITECTURE_ACCESSIBILITE_VOCALE.md`.**

- **4 langues** : Dendi, Bariba (Baatonum), Fon, Français — choisies **à l'oreille**
  (chaque carte de langue joue un message), modifiable dans les Paramètres.
- **Guidage audio au clic** : chaque bouton (composant `BoutonVocal`) joue un audio qui
  explique l'action — audios **pré-enregistrés** par langue (TTS navigateur en repli FR).
- **Mode guidé vocal** : `AssistantVocal` pas-à-pas pour les parcours clés (colis, scan, paiement).
- **UI basse littératie** : pictogrammes, gros boutons (≥ 56 px), couleur **+ icône + voix**,
  un écran = une décision, feedback visuel + sonore + haptique.
- **Backend** : module `i18n` (tables `langues`, `traductions`, `audios_guidage`) +
  **studio vocal** admin (upload des enregistrements, suivi de couverture).
- **Offline** : packs langue (textes + audios) mis en cache avec la PWA.

---

## 8. Réutilisation des modules existants (synthèse)

| Besoin Plan B | Brique existante réutilisée |
|---------------|-----------------------------|
| Auth & rôles | `authentification`, `roles`, `ui_permissions`, `constantes_roles` |
| Roster gares/acteurs | `enrolement`, `equipes`, `chefs`, `domaines`, `departements` |
| QR tickets/étiquettes | `qr_dynamique` |
| SMS | `noyau/notification.py` |
| Preuves photo | `noyau/stockage_photos.py` |
| Score chauffeur | `scoring` |
| Anti-fraude | `detection_fraude` |
| Traçabilité | `audit` |
| Certification identité | `inspection_documents` (refondu) |
| Dashboard pilotage | `admin`, `super_admin`, `monitoring` |

---

## 9. Perspectives (modules conservés, non activés en v1)

> **Rien n'est supprimé.** Ces modules restent dans le dépôt, documentés ici, et sont
> éventuellement masqués par des *feature flags* (`configuration_systeme`).

- `chatbot` (RAG) — réutilisable pour l'assistance logistique.
- `medical`, `recherche_faciale`, `ong` — hors périmètre logistique v1.
- `gamification` (badges, parrainage) — pourrait récompenser les receveurs/chauffeurs (v2).
- `verification_visuelle`, `detection_fraude` (ML) — v2 pour l'anti-fraude avancé.
- `ocr_vote`, `ocr_etudiant` — types de documents prévus mais non prioritaires.
- `attestations_communautaires` — brique de confiance, réutilisable v2.

---

## 10. Roadmap par phases

| Phase | Contenu | Livrable |
|-------|---------|----------|
| **L0 — Socle documents** | Refonte `inspection_documents` (mixin + 1 table/document + réindex `inspection_documents`) | Schéma documents propre |
| **L1 — Socle logistique** | Gares, lignes, véhicules, acteurs, voyages, nouveaux rôles | Référentiel + RBAC |
| **L2 — Colis + tickets** | Enregistrement colis, ticket QR+code clair, scans, timeline, anti-DÉJÀ LIVRÉ | Bout-en-bout colis |
| **L3 — Bagages & voyageurs** | Bagages soute, étiquettes, matching à l'arrivée | Embarquement rapide |
| **L4 — Suivi familial + SMS** | Enfants seuls, SMS départ/arrivée, page de suivi | Sérénité familles |
| **L5 — Score logistique** | 40/30/20/10, couleur, avis, litiges | Confiance chauffeurs |
| **L6 — Paiement** | Wallet, frais de service dégressif (100/75/50 FCFA dont 25 FCFA au receveur), mobile money, webhooks | Flux financier complet |
| **L7 — Abonnements & API** | Packs e-commerce, API certification VTC (150 FCFA) | Monétisation |
| **L8 — Offline & impression** | PWA, Dexie, sync idempotente, WebBluetooth | Terrain sans réseau |
| **L9 — Frontend complet** | Espaces receveur/chauffeur/commerçant/gare/famille + dashboards admin | Plateforme complète |

---

## 11. Arborescence cible (extrait)

**Backend**
```
src/modules/logistique/
  gares/ lignes/ vehicules/ voyages/ acteurs/ colis/ bagages/ voyageurs/
  tickets/ scans/ suivi_familial/ score_logistique/ avis/ litiges/
  notifications_logistique/ synchronisation/
src/modules/paiement/
  portefeuille/ transactions/ commissions/ mobile_money/ abonnements/
  api_certification/ facturation/ webhooks_paiement/
src/modules/inspection_documents/
  (conservé) + adaptateurs par table
src/modeles/
  base_document.py            (mixin commun)
  documents/ cni.py passeport.py permis.py assurance.py carte_grise.py
             carte_sejour.py consulaire.py vote.py etudiant.py
  logistique/ (…)
  paiement/   (…)
```

**Frontend**
```
src/app/  receveur/ chauffeur/ commercant/ gare/ suivi/
src/composants/logistique/  src/composants/paiement/
src/services/  logistiqueApi.ts paiementApi.ts
src/types/     logistique.ts paiement.ts
```

---

## 12. Conventions & garde-fous

- Préfixes : `logistique` = `/api/v1/logistique`, `paiement` = `/api/v1/paiement`.
- Tout endpoint sensible exige un **rôle** (`ROLES_LOGISTIQUE`) + **cloisonnement gare/domaine**.
- Toute écriture terrain = **idempotente** (`idempotency_key`).
- Toute opération financière = **auditée** + idempotente + signature webhook vérifiée.
- Migrations Alembic pour **chaque** nouvelle table ; aucune suppression destructive.
- Feature flags pour activer les domaines sans casser l'existant.

---

## 13. Décisions à valider avant codage

1. **Périmètre L0 (documents)** : confirmer la liste des tables documents (CNI, passeport,
   permis, assurance, carte grise, séjour, consulaire, + vote/étudiant).
2. **Rôles** : noms définitifs (`receveur`, `chauffeur`, `commercant`, `gerant_gare`).
3. **Paiement** : opérateurs mobile money prioritaires (Wave ? Orange Money ?) et
   besoin **espèces/offline** au guichet.
4. **Ticket en clair** : format du numéro (ex. `PK-2026-000123`) et règle d'unicité.
5. **Impression** : WebBluetooth (web) vs application mobile dédiée.
6. **SMS** : agrégateur réel (Orange SMS API / Twilio / local) et budget.
7. **Offline** : profondeur de la file locale (jours de rétention) et politique de conflit.
8. **Abonnements** : quotas et prix confirmés (Starter 5 000/50, Premium 15 000/illimité).
9. **Accessibilité & langues** : qui enregistre les voix (Dendi/Bariba/Fon) ? couverture
   audio v1 ? TTS français en repli ? mode kiosque parlant au guichet ? (voir
   `ARCHITECTURE_ACCESSIBILITE_VOCALE.md`).

---

*Fin du document de structure. Aucun code n'a été écrit : en attente de validation.*
