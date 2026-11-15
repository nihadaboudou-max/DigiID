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
| Tableau de bord / Accueil | [`/citoyen/dashboard`](./frontend/src/app/citoyen/dashboard/page.tsx); `/citoyen` et `/tableau-de-bord` y redirigent | Accueil citoyen : résumé d'identité et vérifications, accès au suivi. Citoyen uniquement. | 4 : en-tête, carte identité, carte vérifications, carte transport et suivi. |
| Ma carte DigiID | [`/identite/carte`](./frontend/src/app/identite/carte/page.tsx) | Carte QR permanente pour le guichet. La page accepte tous les rôles; la section « Mes voyages » reste réservée aux autres rôles. | 3 pour le citoyen : en-tête, carte QR, explication du fonctionnement. 4 pour les autres rôles, avec « Mes voyages ». |
| Mes envois | [`/citoyen/envois`](./frontend/src/app/citoyen/envois/page.tsx) | Colis et enfants suivis par le citoyen, recherche et pagination serveur, chronologie en trois étapes. Citoyen uniquement. | 4 : en-tête, recherche, liste paginée, pagination. La chronologie est affichée après sélection. |
| Messages | [`/citoyen/messages`](./frontend/src/app/citoyen/messages/page.tsx) | Notifications de colis du citoyen, recherche et pagination serveur; code de remise masqué jusqu'à l'action « Afficher ». Citoyen uniquement. | 4 : en-tête, recherche, liste paginée, pagination. |
| Mon DigiID | [`/citoyen/qr-code`](./frontend/src/app/citoyen/qr-code/page.tsx) | Code de sécurité temporaire, renouvelé toutes les 30 secondes. Citoyen uniquement, accessible depuis Profil > Vérifier mon identité. | 4 : en-tête, alerte de sécurité, zone QR protégée, retour au profil. |
| Profil | [`/profil`](./frontend/src/app/profil/page.tsx) | Coordonnées, vérifications et identifiant DigiID; accès aux vérifications d'identité, à l'activité commerçante, à l'aide et aux paramètres. Page partagée avec plusieurs rôles. | 8 pour le citoyen : en-tête, carte identité, carte téléphone, carte identifiant DigiID, alerte sécurité et 3 cartes de raccourcis. Une alerte supplémentaire peut s'afficher si les vérifications sont incohérentes. |
| Horaires | [`/horaires`](./frontend/src/app/horaires/page.tsx) | Consultation publique des départs et filtre par destination/période. Les notifications de colis sont désormais dans Messages. | 5 : en-tête, recherche de suivi, filtres, résultats des départs, pied de page. |
| Document d'identité | [`/documents-identite`](./frontend/src/app/documents-identite/page.tsx) | Consultation/gestion des documents CNI, permis et assurance. Page partagée avec plusieurs rôles, dont citoyen. | 3 : en-tête, onglets documentaires, contenu du document ou alerte d'absence. Le formulaire d'édition ajoute un bloc quand il est ouvert. |
| Reconnaissance faciale | [`/verification-visuelle`](./frontend/src/app/verification-visuelle/page.tsx); [`/identite/verification-visuelle`](./frontend/src/app/identite/verification-visuelle/page.tsx) redirige vers cette page | Envoi d'un selfie, état et historique de la vérification. Page partagée avec plusieurs rôles, dont citoyen. | 6 : en-tête, nouvelle vérification, statut, historique, retour, note de confidentialité. Une alerte d'erreur peut s'ajouter; le statut approuvé affiche une comparaison dans son bloc. |
| Aide et Support | [`/aide`](./frontend/src/app/aide/page.tsx) | Aide adaptée au rôle connecté; contenu public pour les visiteurs. Le citoyen voit 4 actions et 8 questions. | 4 groupes : introduction/recherche, actions, FAQ, assistant. Les 8 questions sont des éléments repliables du groupe FAQ. |
| Paramètres | [`/parametres`](./frontend/src/app/parametres/page.tsx) | Identité, mot de passe, 2FA, langue, activité, export et suppression. Page partagée avec plusieurs rôles, dont citoyen. | 8 : en-tête, identité, mot de passe, 2FA, langue, activité récente, export, zone sensible. |
| Suivi public | [`/suivi`](./frontend/src/app/suivi/page.tsx) et [`/suivi/[code]`](./frontend/src/app/suivi/%5Bcode%5D/page.tsx) | Saisie d'un code puis suivi d'un colis ou d'un enfant, sans connexion; le détail limite les données personnelles affichées. | Recherche : 4 blocs (zone de recherche et 3 étapes explicatives). Détail chargé : 5 (en-tête, trajet, timeline, notifications SMS, note de confidentialité). Les états chargement/erreur remplacent certains blocs. |

### Constats de navigation à garder en tête

- La page « Ma carte DigiID » contient aussi « Mes voyages »; il n'existe pas
  aujourd'hui de route distincte dédiée aux envois du citoyen.
- Le menu citoyen nomme « Document d'identité » mais pointe vers
  [`/inspection`](./frontend/src/app/inspection/page.tsx), dont le titre est
  « Test Inspection de Documents ». Le tableau de bord et le profil pointent,
  eux, vers `/documents-identite`.
- Le menu latéral contient le lien `/parametre` (singulier), alors que la page
  existante est `/parametres` (pluriel).
- « Ma carte DigiID » (QR permanent destiné au guichet) et « Mon DigiID » (QR
  dynamique d'identité) sont deux usages distincts.

Les écarts ci-dessus décrivent l'état avant la réalisation de l'étape 1.

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
