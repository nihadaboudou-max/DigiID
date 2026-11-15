# Audit UX — profil citoyen

## Périmètre et méthode de comptage

Cet inventaire porte sur les écrans du parcours citoyen, y compris les écrans
publics qu'un citoyen utilise. Il décrit l'interface actuelle; aucune route,
règle métier ou permission n'est modifiée.

Un « bloc » désigne ici une section de contenu de premier niveau (en-tête,
carte, alerte, formulaire ou zone de résultats). La navigation, les fils
d'Ariane et les éléments internes d'une carte ne sont pas comptés séparément.
Les nombres correspondent à l'état normal après chargement; les éléments
conditionnels sont signalés à part.

## Inventaire actuel

| Écran | Route actuelle | Rôle / accès actuel | Blocs affichés |
|---|---|---|---:|
| Accueil public | [`/`](./frontend/src/app/page.tsx) | Suivi public d'un colis ou enfant; horaires, connexion et choix de langue accessibles sans compte. | 2 blocs principaux : sélecteur de langue et suivi avec accès aux horaires/connexion. |
| Tableau de bord citoyen | [`/citoyen/dashboard`](./frontend/src/app/citoyen/dashboard/page.tsx); `/citoyen` et `/tableau-de-bord` y redirigent | Suivi d'un envoi, cinq envois récents et progression de complétion du profil. Citoyen uniquement. | 3 : suivi, liste de cinq envois, progression du profil. |
| Ma carte DigiID | [`/identite/carte`](./frontend/src/app/identite/carte/page.tsx) | Carte QR permanente pour le guichet. La page accepte tous les rôles; la section « Mes voyages » reste réservée aux autres rôles. | 3 pour le citoyen : en-tête, carte QR, explication du fonctionnement. 4 pour les autres rôles, avec « Mes voyages ». |
| Mes envois | [`/citoyen/envois`](./frontend/src/app/citoyen/envois/page.tsx) | Colis et enfants suivis par le citoyen, recherche et pagination serveur, chronologie en trois étapes. Citoyen uniquement. | 4 : en-tête, recherche, liste paginée, pagination. La chronologie est affichée après sélection. |
| Messages | [`/citoyen/messages`](./frontend/src/app/citoyen/messages/page.tsx) | Notifications de colis du citoyen, recherche et pagination serveur; code de remise masqué jusqu'à l'action « Afficher ». Citoyen uniquement. | 4 : en-tête, recherche, liste paginée, pagination. |
| Mon DigiID | [`/citoyen/qr-code`](./frontend/src/app/citoyen/qr-code/page.tsx) | Code de sécurité temporaire, renouvelé toutes les 30 secondes. Citoyen uniquement, accessible depuis Profil > Vérifier mon identité. | 4 : en-tête, alerte de sécurité, zone QR protégée, retour au profil. |
| Profil | [`/profil`](./frontend/src/app/profil/page.tsx) | Coordonnées, vérifications et identifiant DigiID; accès aux vérifications d'identité, à l'activité commerçante, à l'aide et aux paramètres. Page partagée avec plusieurs rôles. | 7 pour le citoyen après l'étape 4 : en-tête et six sections repliables; les autres rôles conservent leur affichage existant. |
| Horaires | [`/horaires`](./frontend/src/app/horaires/page.tsx) | Consultation publique des départs et filtre par destination/période. Les notifications de colis sont désormais dans Messages. | 5 : en-tête, recherche de suivi, filtres, résultats des départs, pied de page. |
| Mon document d'identité | [`/inspection`](./frontend/src/app/inspection/page.tsx) | Envoi d'une photo, lecture des informations et historique des vérifications. Parcours d'auto-service accessible depuis la navigation citoyenne; accès et droits existants conservés. | 3 à 5 : en-tête, envoi/analyse, historique, résultat si disponible, pagination si plusieurs pages. |
| Gestion des documents d'identité | [`/documents-identite`](./frontend/src/app/documents-identite/page.tsx) | Consultation/gestion des documents CNI, permis et assurance. Page partagée avec plusieurs rôles, dont citoyen. | 3 : en-tête, onglets documentaires, contenu du document ou alerte d'absence. Le formulaire d'édition ajoute un bloc quand il est ouvert. |
| Reconnaissance faciale | [`/verification-visuelle`](./frontend/src/app/verification-visuelle/page.tsx); [`/identite/verification-visuelle`](./frontend/src/app/identite/verification-visuelle/page.tsx) redirige vers cette page | Envoi d'un selfie, état et historique de la vérification. Page partagée avec plusieurs rôles, dont citoyen. | 6 : en-tête, nouvelle vérification, statut, historique, retour, note de confidentialité. Une alerte d'erreur peut s'ajouter; le statut approuvé affiche une comparaison dans son bloc. |
| Aide et Support | [`/aide`](./frontend/src/app/aide/page.tsx) | Aide adaptée au rôle connecté; contenu public pour les visiteurs. Le citoyen voit 4 actions et 8 questions. | 4 groupes : introduction/recherche, actions, FAQ, assistant. Les 8 questions sont des éléments repliables du groupe FAQ. |
| Paramètres | [`/parametres`](./frontend/src/app/parametres/page.tsx) | Identité, mot de passe, 2FA, langue, activité, export et suppression. Page partagée avec plusieurs rôles, dont citoyen. | 8 : en-tête, identité, mot de passe, 2FA, langue, activité récente, export, zone sensible. |
| Suivi public | [`/suivi`](./frontend/src/app/suivi/page.tsx) et [`/suivi/[code]`](./frontend/src/app/suivi/%5Bcode%5D/page.tsx) | Saisie d'un code puis suivi d'un colis ou d'un enfant, sans connexion; le détail limite les données personnelles affichées. | Recherche : 4 blocs (zone de recherche et 3 étapes explicatives). Détail chargé : 5 (en-tête, trajet, timeline, notifications SMS, note de confidentialité). Les états chargement/erreur remplacent certains blocs. |

### Constats de navigation à garder en tête

- La page « Ma carte DigiID » contient aussi « Mes voyages »; il n'existe pas
  aujourd'hui de route distincte dédiée aux envois du citoyen.
- Le menu citoyen « Document d'identité » ouvre le parcours de lecture de
  document à [`/inspection`](./frontend/src/app/inspection/page.tsx). La page
  de gestion documentaire partagée reste distincte à `/documents-identite`.
- Le menu latéral contient le lien `/parametre` (singulier), alors que la page
  existante est `/parametres` (pluriel).
- « Ma carte DigiID » (QR permanent destiné au guichet) et « Mon DigiID » (QR
  dynamique d'identité) sont deux usages distincts.

Les constats de navigation initiaux décrivent l'état avant la réalisation de
l'étape 1; les étapes réalisées sont consignées ci-dessous.

## Organisation retenue — navigation du citoyen

Conserver le système visuel existant : couleurs, polices, espacements et
composants actuels. Ajouter une barre fixe en bas de l'écran avec cinq entrées
au maximum, chacune avec une icône existante ou équivalente et un libellé :

```text
┌─────────────────────────────────────────────────────────┐
│  Accueil   Mes envois   Horaires   Ma carte   Profil     │
│    icône      icône      icône      icône      icône      │
└─────────────────────────────────────────────────────────┘
```

| Entrée de navigation | Destination conceptuelle, en réutilisant l'existant |
|---|---|
| Accueil | Tableau de bord citoyen |
| Mes envois | Nouvelle page citoyenne `/citoyen/envois` |
| Horaires | Horaires des départs |
| Ma carte | Carte QR permanente DigiID |
| Profil | Profil citoyen et accès aux rubriques ci-dessous |

```text
Profil
├── Mon profil
├── Vérifier mon identité
│   ├── Document d'identité
│   ├── Reconnaissance faciale
│   └── Code de sécurité temporaire
├── Aide et Support
└── Paramètres
```

Les destinations de vérification, d'aide et de paramètres réutilisent leurs
écrans existants. Les seules nouvelles routes sont celles demandées pour Mes
envois et Messages; aucune route existante n'a été renommée et les droits
d'accès n'ont pas changé.

## Étape 1 — navigation et messages (réalisée)

- [x] Barre fixe mobile et menu latéral citoyen avec les cinq entrées demandées.
- [x] Création de « Mes envois » avec recherche et pagination côté serveur (5 par page).
- [x] Cloche de messages non lus dans l'en-tête et page Messages (5 par page).
- [x] Ouverture d'un envoi depuis un message; code de remise masqué jusqu'à « Afficher ».
- [x] Retrait des notifications de la page Horaires.
- [x] « Ma carte » reste le QR permanent; le QR temporaire est accessible depuis Profil.
- [x] Accès depuis Profil à Document d'identité (`/inspection`), reconnaissance faciale,
  Aide et Support, Paramètres (`/parametres`) et Mon activité commerçante.
- [x] Le rendu des rôles chauffeur, receveur et gérant conserve leurs branches existantes;
  la mise en forme citoyenne est limitée au conteneur citoyen. Validation statique et
  vérification TypeScript effectuées; aucun compte de ces rôles n'a été utilisé pour
  une vérification visuelle en navigateur.

### Fichiers modifiés pour l'étape 1

Backend :
- `backend/src/modeles/logistique/colis.py`
- `backend/src/modules/gamification/routes.py`
- `backend/src/modules/gamification/schemas.py`
- `backend/src/modules/gamification/service_notifications.py`
- `backend/src/modules/identite_digiid/routes.py`
- `backend/src/modules/identite_digiid/schemas.py`
- `backend/src/modules/identite_digiid/service.py`
- `backend/src/modules/logistique/schemas.py`
- `backend/src/modules/logistique/service.py`
- `backend/alembic/versions/20261116_1000_code_remise_chiffre.py`

Frontend :
- `frontend/src/app/citoyen/envois/page.tsx`
- `frontend/src/app/citoyen/dashboard/page.tsx`
- `frontend/src/app/citoyen/messages/page.tsx`
- `frontend/src/app/citoyen/qr-code/page.tsx`
- `frontend/src/app/horaires/page.tsx`
- `frontend/src/app/identite/carte/page.tsx`
- `frontend/src/app/profil/page.tsx`
- `frontend/src/composants/commun/Icones.tsx`
- `frontend/src/composants/layouts/BarreLaterale.tsx`
- `frontend/src/composants/layouts/BarreNavigationCitoyen.tsx`
- `frontend/src/composants/layouts/ConteneurLayout.tsx`
- `frontend/src/composants/layouts/EnTete.tsx`
- `frontend/src/services/gamification.ts`
- `frontend/src/services/identite_api.ts`
- `frontend/src/styles/globaux.css`
- `frontend/src/types/identite.ts`

Audit :
- `AUDIT_CITOYEN.md`

## Étape 2 — mon document d'identité (réalisée)

- [x] Remplacement de l'interface d'essai par « Mon document d'identité » et
  son texte d'aide; aucun libellé d'essai ne reste sur `/inspection`.
- [x] Choix de photo, sélection du type avec détection automatique par défaut,
  analyse et recommencement avec des boutons tactiles d'au moins 56 px.
- [x] Résultat présentant nom, numéro, date de naissance et validité avec les
  badges « Document lu », « À vérifier » et « Document non lisible ».
- [x] Historique sous forme de cartes, détails repliables, état vide demandé et
  pagination serveur de cinq éléments.
- [x] Extension rétrocompatible de l'API d'historique avec un décalage optionnel;
  la réponse historique et les droits existants sont conservés.
- [x] Les branches d'accès des autres rôles ne sont pas modifiées. La page n'a
  pas pu être vérifiée visuellement avec des comptes chauffeur, receveur et gérant.
- Vérification : type-check et build frontend réussis; syntaxe Python valide.
  Le test backend ciblé n'a pas pu être collecté, car `pytesseract` manque dans
  l'environnement local malgré sa présence dans `backend/requirements.txt`.

### Fichiers modifiés pour l'étape 2

- `backend/src/modules/inspection_documents/routes.py`
- `backend/src/modules/inspection_documents/service.py`
- `backend/tests/test_inspection_pagination.py`
- `frontend/src/app/inspection/page.tsx`
- `frontend/src/services/inspectionApi.ts`
- `AUDIT_CITOYEN.md`

## Étape 3 — accueil public et tableau de bord citoyen (réalisée)

- [x] Accueil public réduit à un titre court, un champ de code et le bouton
  « Suivre », avec accès aux horaires et à la connexion.
- [x] Sélecteur de langue conservé en petit format en haut; le score fictif et
  les autres panneaux promotionnels ont été retirés.
- [x] Tableau de bord limité au suivi, aux cinq derniers envois sous forme de
  cartes avec trajet/statut coloré, et à la progression du profil.
- [x] Progression calculée sur les quatre éléments demandés : e-mail, WhatsApp,
  pièce d'identité et visage. « Compléter » ouvre le profil existant.
- [x] Routes et API existantes conservées; les envois sont chargés via la
  pagination existante à cinq éléments.
- Vérification : type-check, build, diagnostics éditeur et `git diff --check`
  réussis. Accueil public contrôlé en navigateur sur mobile. Le
  tableau de bord citoyen n'a pas été vérifié en navigateur faute de session
  citoyen de test; son rendu est compilé et ses diagnostics sont vides.

### Fichiers modifiés pour l'étape 3

- `frontend/src/app/page.tsx`
- `frontend/src/app/citoyen/dashboard/page.tsx`
- `frontend/src/composants/accessibilite/SelecteurLangue.tsx`
- `AUDIT_CITOYEN.md`

## Étape 4 — profil citoyen (réalisée)

- [x] Les six rubriques du profil citoyen sont repliables; une seule peut être
  ouverte à la fois.
- [x] « Mes informations » permet d'enregistrer prénom, nom et ville avec l'API
  existante; le téléphone conserve son parcours de modification/vérification.
- [x] E-mail et photo sont affichés sans édition; la vérification d'e-mail
  conserve son parcours existant. Aucune API de photo n'existe.
- [x] « Vérifier mon identité » présente les cinq statuts en vert « fait » ou
  orange « à faire » et conserve les liens de vérification existants.
- [x] « Mes notifications » indique les canaux et le contact proche disponibles,
  mais reste en lecture seule : aucune API ne permet d'enregistrer ces choix.
- [x] « Mon activité », « Aide et support » et « Paramètres » conservent leurs
  actions existantes, notamment le lien `/parametres`.
- [x] L'affichage citoyen est isolé; la branche existante des autres rôles n'est
  pas modifiée. Vérification visuelle avec des comptes de rôles non disponible.
- Vérification : type-check, build frontend et contrôle whitespace réussis.

### Fichiers modifiés pour l'étape 4

- `frontend/src/app/profil/page.tsx`
- `AUDIT_CITOYEN.md`

## Étape 5 — paramètres (réalisée)

- [x] Les rubriques Mot de passe, Double authentification, Langue et lecture à
  voix haute, Activité récente, Exporter mes données et Supprimer mon compte
  sont présentées dans des sections repliables, avec une seule section ouverte
  à la fois. La rubrique Identité personnelle existante est conservée.
- [x] Les activités sont affichées cinq par page avec pagination serveur. La
  borne d'instantané stabilise les pages pendant la consultation; l'API
  historique sans pagination conserve sa réponse en liste.
- [x] La suppression est placée dans la dernière section et demande une
  confirmation explicite avant d'utiliser l'API existante, puis de déconnecter
  le compte.
- [x] Les rôles et les routes existants sont conservés. Le rendu n'a pas pu
  être vérifié visuellement avec des comptes chauffeur, receveur ou gérant.
- Vérification : type-check et build frontend réussis; diagnostics frontend
  sans erreur; test backend ciblé de pagination réussi; syntaxe Python valide;
  `git diff --check` réussi.

### Fichiers modifiés pour l'étape 5

- `backend/src/modules/profil/routes.py`
- `backend/src/modules/profil/service.py`
- `backend/tests/test_profil_pagination.py`
- `frontend/src/app/parametres/page.tsx`
- `frontend/src/services/profil.ts`
- `AUDIT_CITOYEN.md`
