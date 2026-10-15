# Scénarios de parcours par profil — prototype DigiID

Convention : `écran → action → résultat attendu`. Les parcours du **pivot logistique** sont détaillés en premier (priorité), les autres profils suivent en version condensée.

Comptes de test : mot de passe commun du jeu de démo (voir `backend/scripts/`).

---

# PARTIE 1 — PIVOT LOGISTIQUE (priorité)

## P1. Citoyen / famille (client du guichet, sans compte pro)

**Objectif** : envoyer un colis, suivre son arrivée, recevoir ses SMS.

| # | Écran | Action | Résultat attendu |
|---|---|---|---|
| 1 | `/connexion` | Se connecter (compte citoyen) | Redirection `/citoyen/dashboard` |
| 2 | `/citoyen/dashboard` | Constater la tuile « Colis » / notifications | Derniers événements colis visibles |
| 3 | `/notifications` | Lire les SMS logistiques | « Colis enregistré », « Départ », « Arrivée » |
| 4 | `/suivi/<code>` (sans connexion) | Saisir le code clair du ticket (ex. `COL-…`) | Timeline : enregistré → en route → arrivé, sans aucune donnée personnelle |
| 5 | `/horaires` (sans connexion) | Filtrer par gare de départ / arrivée | Liste des prochains départs (trajet, heure, car, chauffeur « Moussa D. ») |

**Cas limites** : code inconnu → message « suivi introuvable », pas d'erreur technique. Code d'un *enfant* (suivi familial) → même page, libellé « enfant suivi ».

---

## P2. Receveur (guichet logistique) — parcours principal

**Objectif** : enregistrer colis/passagers, encaisser, scanner, affecter les cars.

### P2.1 Enregistrer un colis
1. `/receveur/dashboard` → tuile **Enregistrer un colis** (ou menu « Cars & chauffeurs » / « Colis & tickets »).
2. `/receveur/colis/nouveau` → saisir expéditeur, destinataire, gares départ/arrivée, description, poids ; choisir le voyage si connu.
3. Valider → **ticket QR + code clair** affichés ; frais de service calculés ; SMS expéditeur/destinataire envoyés.
4. `/receveur/tickets` → le colis apparaît en tête de liste avec son statut.
5. `/receveur/tickets/<code>` → détail, timeline, bouton réimpression/partage.

**Attendu** : si le voyage n'est pas encore connu, le colis est créé « non affecté » et **modifiable** ensuite (affectation tardive).
**Cas limites** : destinataire inconnu → saisie libre acceptée ; doublon de code → refus explicite.

### P2.2 Enregistrer un enfant voyageant seul (suivi familial)
1. `/receveur/suivi-familial/nouveau` → identité de l'enfant, parent à prévenir (nom + téléphone), gares, voyage.
2. Valider → ticket **ENFANT** + SMS au parent « départ » préparé.
3. `/receveur/suivi-familial` → l'enfant apparaît ; à chaque étape, SMS automatique au parent.
4. `/receveur/suivi-familial` → bouton **Marquer départ / arrivée** → événement tracé + SMS.

### P2.3 Encaisser
1. `/receveur/cagnotte` → encaissement du colis ou du passager (espèces / mobile).
2. Attendu : montant ajouté à la cagnotte du jour, lignes exportables/imprimables.

### P2.4 Scanner / livrer
1. `/receveur/scan` → scanner le QR du ticket.
2. Attendu : statut passe à *livré* ; **deuxième scan = « déjà livré »** (idempotent, pas de doublon).
3. `/logistique/scan` → même service en mode guichet ; `/guichet/carte` → scan d'une carte DigiID client pour pré-remplir une fiche.

### P2.5 Inscrire un car et l'affecter à son chauffeur (nouveau)
1. Menu **Cars & chauffeurs** → `/receveur/vehicules`.
2. Formulaire : immatriculation, marque, capacité, gare, **chauffeur** (liste : nom + téléphone) → **Créer**.
3. Attendu : le car apparaît dans le tableau avec la colonne *Chauffeur* renseignée.
4. Changer le chauffeur dans la liste déroulante de la ligne → `Car AB-1234-XX affecté` ; choisir « — Non affecté — » → retrait.
5. `/receveur/dashboard` → action rapide **Cars & chauffeurs** (même écran) et bloc « Départs des chauffeurs ».

**Droits** : `logistique.vehicule.ecrire` + `logistique.vehicule.affecter`. Un compte non chauffeur est refusé (« pas reconnu comme chauffeur ») ; un chauffeur doit avoir sa fiche acteur (Super-admin → Logistique → Acteurs).
**Cas limites** : plaque existante → message explicite ; car affecté à un autre → refus, seul le guichet peut réaffecter.

### P2.6 Mon dossier pro
1. `/logistique/profil` → rôle « receveur », gare de rattachement.
2. Attendu : la fiche est rattachée au guichet et alimente les listes de chauffeurs/acteurs.

### Ce que le receveur NE peut PAS faire
Planifier un départ, supprimer un car, valider une arrivée de lot (réservés gérant de gare / chauffeur / super-admin).

---

## P3. Gérant de gare — parcours principal

**Objectif** : tout ce que fait le receveur, **plus** la planification et l'administration du référentiel de sa gare.

1. `/connexion` (rôle `gerant_gare`) → menu latéral intitulé **Gérant de gare** (mêmes entrées que le guichet).
2. `/receveur/dashboard` → bloc **Départs des chauffeurs** : voir qui part, quand, avec quel car.
3. Planifier un départ : référentiel → **Voyages/Nouveau voyage** → ligne (trajet), car, chauffeur, date/heure → Créer.
   - Attendu : départ visible côté chauffeur et côté guichet ; conducteur prévenu.
4. `/receveur/vehicules` → inscrire/affecter un car (idem P2.5) ; possibilité de **corriger** un car (marque, capacité, mise hors service).
5. Supprimer du référentiel : un car ou un départ erroné (`logistique.supprimer`).
6. Enregistrer l'acteur logistique d'un chauffeur (fiche « chauffeur » + n° de licence) pour qu'il soit affectable.
7. `/logistique/profil` → gare de rattachement ; le gérant écrit « au titre de `logistique.ecrire` ».

**Cas limites** : un départ déjà parti ne se modifie plus ; un car en service sur un voyage ne se supprime pas sans avertissement.

---

## P4. Chauffeur (indépendant) — parcours principal

**Objectif** : déclarer son car, planifier ses départs, embarquer passagers et colis, encaisser.

### P4.1 Déclarer son car
1. `/chauffeur/voyages` → section **Mes cars** → **Enregistrer mon car** : plaque, marque, capacité.
2. Attendu : le car devient **le sien** (affectation automatique côté serveur). S'il est déjà au référentiel sans chauffeur → il lui est attribué ; s'il appartient à un collègue → refus (« déjà affecté à un autre chauffeur »).
3. **Mes cars** n'affiche que ses cars (affectés ou celui dont il a déclaré la plaque) — jamais celui d'un collègue.

### P4.2 Planifier un trajet
1. `/chauffeur/voyages` → choisir ligne (trajet), **son car**, date/heure → Créer.
2. Attendu : départ visible dans « Mes voyages » ; impossible de planifier avec le car d'un autre (contrôle serveur, pas seulement l'affichage).
3. `/chauffeur/voyages` → « Mes voyages » : départs du jour et à venir.
4. `/chauffeur/voyages/<id>` → détail du départ : passagers, colis, actions de lot.

### P4.3 Enregistrer un colis ou un passager en route
1. `/chauffeur/colis/nouveau` → colis embarqué au bord de la route (mode « chauffeur »).
2. `/chauffeur/passagers/nouveau` → passager monté en cours de trajet.
3. `/chauffeur/colis` / `/chauffeur/passagers` → listes, statuts, recherche par code.

### P4.4 Départ / arrivée (actions groupées)
1. `/chauffeur/voyages/<id>` → **Valider le départ** → tous les passagers + colis passent « en route » en un clic.
2. En route : `/chauffeur/scan` → scanner chaque QR (livraison à la montée/descente), ou **Pré-alerte** → SMS passagers + proches + destinataires de l'approche.
3. À l'arrivée : **Marquer arrivés** (éventuellement par gare) → passagers et colis « arrivés », SMS envoyés.
4. Attendu : un chauffeur ne peut pas forcer un statut de route par modification manuelle ; un voyage déjà parti ne se rejoint plus par un collègue.

### P4.5 Rejoindre / quitter un départ libre
1. `/chauffeur/dashboard` → départs libres (sans chauffeur) → **Rejoindre**.
2. Refusé si : déjà pris par un autre (nom cité), déjà parti, ou compte non enregistré comme chauffeur.
3. Avant le départ : **Quitter** → le car redevient libre.

### P4.6 Encaisser / dossier
1. `/chauffeur/cagnotte` → encaissements du jour.
2. `/logistique/profil` → dossier pro « chauffeur » (permis, plaque déclarée, gare).

---

## P5. Commerçant — parcours principal

**Objectif** : expédier des colis depuis sa boutique, sans conduire.

1. Menu **Commerçant** : `Enregistrer un colis`, `Mes colis`, `Mon dossier pro`, `Ma cagnotte`, `Ma carte DigiID`.
2. `/receveur/colis/nouveau` → enregistrer un colis au nom de la boutique (mêmes écrans que le guichet).
3. `/receveur/tickets` → **Mes colis** : suivi, statuts, réimpression du ticket QR.
4. `/receveur/cagnotte` → encaisser un client ; `/logistique/profil` → dossier pro « commerçant » (gare de rattachement).
5. `/suivi/<code>` → transmettre le lien/code au destinataire.

**Ce qu'il ne fait pas** : planifier, affecter un car, supprimer, scanner une livraison (réservés guichet/chauffeur).

---

## P6. Super-admin — référentiel & surveillance (socle du pivot)

1. `/super-admin/tableau-de-bord` → indicateurs réseau ; `/super-admin/monitoring` → santé.
2. `/super-admin/logistique` → onglets **Gares / Lignes / Véhicules / Voyages / Acteurs** :
   - *Gares* : créer (nom, code, ville).
   - *Lignes* : trajet = gare départ + gare arrivée (+ distance, durée).
   - *Véhicules* : immatriculation, marque, capacité, gare, **chauffeur** (sélecteur + filtre par nom) ; colonne d'affectation directe (retrait = « — Non affecté — »).
   - *Voyages* : ligne + car + **chauffeur** (annuaire filtré par gare de départ et nom) + horaire + statut.
   - *Acteurs* : rôle (receveur, chauffeur, gérant de gare, commerçant) + utilisateur (annuaire par rôle) + gare + n° de licence. **C'est ici qu'on rend un compte affectable comme chauffeur.**
3. `/super-admin/utilisateurs` (+ `creation`) → créer les comptes pro (receveur, gérant, chauffeur, commerçant).
4. `/super-admin/invitations` → inviter un chef/agent ; `/accepter-invitation/<token>` côté invité.
5. `/super-admin/audit` → journal : `vehicule_enregistre`, `vehicule_affecte`, `vehicule_desaffecte`, `vehicule_modifie`, `vehicule_supprime`, `voyage_planifie`, `voyage_modifie`, `voyage_chauffeur_engage` (qui a fait quoi, avec les données avant/après).
6. `/super-admin/configuration`, `/super-admin/droits`, `/super-admin/droits-ui`, `/super-admin/statistiques`, `/super-admin/domaines`, `/super-admin/departements`, `/super-admin/equipes`, `/super-admin/administrateurs`.

---

# PARTIE 2 — AUTRES PROFILS (condensé)

## A1. Administrateur
`/admin/tableau-de-bord` → supervision du domaine : `/admin/utilisateurs`, `/admin/chefs`, `/admin/departements`, `/admin/invitations`, `/admin/statistiques`, `/admin/audit`, `/admin/alertes`, `/admin/activites/*`.
Attendu : crée et pilote les chefs de département ; ne touche pas au référentiel logistique.

## A2. Admin de domaine
`/admin-domaine/tableau-de-bord` → `/admin-domaine/chefs`, `/admin-domaine/invitations`, `/admin-domaine/departements`, `/admin-domaine/statistiques`, `/admin-domaine/audit`. Périmètre limité à son domaine.

## A3. Chef de département
Parcours identique pour les 4 variantes (`chef-enrolement`, `chef-medical`, `chef-police`, `chef-ong`) :
1. `/chef-*/` → tableau de bord du département.
2. `/chef-*/equipe` → créer/inviter ses agents (`/chef-*/invitations`), consulter une fiche (`/equipe/<id>`).
3. `/chef-*/recherche` → retrouver un citoyen ; `/chef-*/missions`, `/chef-*/activites`, `/chef-*/statistiques`, `/chef-*/rapports`, `/chef-*/audit`, `/chef-*/profil`.
4. Attendu : les actions de ses agents remontent dans ses statistiques et son audit.

## A4. Agent terrain (enrôlement)
1. `/agent/dashboard` → file d'attente d'enrôlement.
2. `/agent/enrolement` → création de dossier citoyen → `/agent/enrolement/<id>` → suite du dossier.
3. `/agent/scan` → scan CNI ; `/agent/capture` → capture biométrique ; `/agent/profil`.
4. Attendu : dossier créé avec pièces, statut visible par le chef.

## A5. Médecin (agent médical)
1. `/medecin/dashboard` → activité du jour.
2. `/medecin/recherche-photo` → retrouver un patient (photo/QR) ; `/medecin/nouveau-dossier` → créer le dossier.
3. `/medecin/dossiers` → `/medecin/dossiers/<id>` → consultations, `/medecin/ordonnances`, `/medecin/attestations`, `/medecin/calendrier`, `/medecin/historique`, `/medecin/profil`.
4. Côté citoyen : `/citoyen/mon-dossier-medical`, `/citoyen/mes-ordonnances` (lecture de ses propres données).

## A6. Agent de police
1. `/police/dashboard` → `/police/verification` (vérifier une identité) et `/police/scan-qr`.
2. `/police/recherche`, `/police/profil/<digiid>` (fiche), `/police/comparaison-photos` (reconnaissance).
3. `/police/carte` (zones), `/police/alertes`, `/police/signalement`, `/police/notes`, `/police/historique`, `/police/audit`, `/police/export`, `/police/profil_personnel`.
4. Attendu : chaque vérification est journalisée et visible par le chef police.

## A7. Agent ONG
1. `/ong/dashboard` → `/ong/beneficiaires` (enregistrer/suivre), `/ong/programme`, `/ong/missions`, `/ong/attestations`, `/ong/profil`.
2. Attendu : bénéficiaires rattachés au programme ; attestations émises tracées.

## A8. Citoyen (utilisateur standard)
1. `/citoyen/dashboard` → tuiles : Mon DigiID, Ma carte, Mes documents, Mes colis, Mes rendez-vous.
2. `/identite/carte` ou `/citoyen/qr-code` → présenter sa carte / son QR (scan par un pro).
3. `/identite/verification-visuelle` → reconnaissance faciale ; `/inspection` → document d'identité.
4. `/identite/permis-conduire`, `/identite/assurance-auto`, `/docs` (`/documents`, `/documents-identite`), `/autorisations`, `/consentements`, `/partage`, `/score`, `/recommandations`, `/parrainage`, `/badges`.
5. `/identite/2fa`, `/parametres`, `/profil`, `/historique`, `/aide`, `/chatbot`.
6. Attendu : données personnelles jamais exposées aux autres profils (aperçu seulement, ex. « Moussa D. »).

## A9. Visiteur non connecté
`/` → `/inscription`, `/connexion`, `/mot-de-passe-oublie` → `/mot-de-passe-oublie/reinitialiser`, `/verification-email`, `/cgu`, `/confidentialite`, `/aide`, `/suivi/<code>`, `/horaires`.

---

# PARTIE 3 — SCÉNARIOS DE BOUT EN BOUT (pivot)

## S1. Colis inter-villes
1. Super-admin crée gare A, gare B, ligne A→B, car (non affecté), acteur chauffeur, puis affecte le car au chauffeur.
2. Chauffeur `/chauffeur/voyages` → voit son car → planifie un départ A→B demain 08:00 → `/chauffeur/voyages/<id>`.
3. Receveur `/receveur/colis/nouveau` → colis 5 kg A→B affecté au départ → ticket QR remis à l'expéditeur → encaisse.
4. Destinataire `/suivi/<code>` → « Enregistré ».
5. Chauffeur **Valider le départ** → SMS « en route » ; scan à l'arrivée → statut « arrivé ».
6. Destinataire `/suivi/<code>` → « Arrivé » ; receveur `/receveur/scan` → livraison définitive, deuxième scan = « déjà livré ».

## S2. Enfant voyageant seul
1. Receveur `/receveur/suivi-familial/nouveau` → enfant + parent + départ.
2. **Départ** → SMS au parent ; **Pré-alerte** → SMS d'approche ; **Arrivée** → SMS final.
3. Parent `/suivi/<code>` → timeline complète sans données sensibles.

## S3. Flotte sans chauffeur déclaré (contrôle des droits)
1. Super-admin inscrit 3 cars sur la gare de Cotonou, sans chauffeur.
2. `/super-admin/logistique` → Véhicules : affecter le car 1 à Moussa ; le car 2 reste « Non affecté ».
3. Connexion chauffeur Moussa : `Mes cars` = car 1 (+ celui dont il déclare la plaque) ; le car 2 n'apparaît pas.
4. Moussa tente de planifier avec le car 3 (appel direct à l'API) → **403** « ce car ne vous est pas affecté ».
5. Moussa déclare la plaque du car 2 (libre) → elle lui est attribuée, l'action est tracée dans `/super-admin/audit`.
6. Le receveur reçoit le car 3 qui se présente → `/receveur/vehicules` → crée le car + désigne son chauffeur dans le même formulaire.

## S4. Contrôle policier
`/police/scan-qr` (carte du citoyen) → `/police/verification` → fiche vérifiée, actes tracés dans `/police/audit` et `/super-admin/audit`.

---

# PARTIE 4 — MATRICE DES DROITS (pivot)

| Action | Receveur | Gérant de gare | Chauffeur | Commerçant | Super-admin |
|---|---|---|---|---|---|
| Lire le référentiel | oui | oui | ses cars | oui | oui |
| Enregistrer un colis | oui | oui | oui | oui | oui |
| Encaisser | oui | oui | cagnotte | oui | — |
| Scanner / livrer | oui | oui | oui | — | oui |
| Suivi familial | oui | oui | oui (scan) | — | oui |
| Créer / modifier un car | oui | oui | ses cars | — | oui |
| Affecter un car | oui | oui | — | — | oui |
| Planifier un départ | — | oui | ses départs | — | oui |
| Supprimer du référentiel | — | oui | — | — | oui |
| Journal d'audit | — | — | — | — | oui |

Garde-fous serveur (indépendants de l'affichage) : appartenance du car au chauffeur, refus d'un compte non chauffeur, refus de voler un car déjà affecté, refus de modifier un départ qui n'est pas le sien, idempotence du scan et de la déclaration de plaque.
