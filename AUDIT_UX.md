# Audit UX — mise en page logistique

## Périmètre et méthode

Profils examinés : super-administrateur, chauffeur, receveur, gérant de gare et
citoyen. L'audit porte sur les écrans logistiques définis dans
`frontend/src/app/`, leurs composants partagés et les listes chargées par ces
écrans.

Le nombre de blocs correspond aux modules principaux simultanément rendus dans
la page en état normal (cartes, listes, formulaires, raccourcis), hors en-tête,
navigation globale et messages d'erreur. Ce n'est pas le nombre de blocs tenant
dans la hauteur d'un écran : sur téléphone, les mises en page en colonnes
s'empilent et augmentent le défilement.

Les appels paginés de l'API logistique utilisent généralement la page 1 avec
une limite de 100 éléments. Les pages examinées n'offrent pas de commandes de
pagination : elles affichent donc tous les éléments reçus de cette page, pas
nécessairement toutes les données du serveur. La cagnotte charge 50 mouvements
et 50 commissions. Aucun test visuel sur appareil n'a été exécuté ; les constats
de largeur viennent des structures et classes de mise en page.

## Super-administrateur

### `/super-admin/logistique`

| Blocs affichés | Listes sans pagination | Tableaux sur téléphone | Actions principales |
|---|---|---|---|
| Environ 2 cartes dans les onglets Gares, Lignes, Véhicules, Voyages et Acteurs (formulaire + liste). L'onglet Profils professionnels affiche 5 blocs (3 indicateurs, répartition, tableau). Le panneau des arrêts s'ajoute à la sélection d'une ligne. | Gares, lignes, véhicules, voyages, acteurs, profils et arrêts n'ont pas de pagination visible ; les listes logistiques sont chargées sur la première page, généralement limitée à 100. | Oui : les tableaux font 4 à 6 colonnes et défilent horizontalement (`overflow-x-auto`). | 6 onglets visibles, puis création et suppression dans les vues de gestion ; suppression répétée dans chaque ligne. Les onglets se replient, mais l'ensemble des choix et gestes est dense. |

La page est également autorisée au rôle `gerant_gare` et décrit le référentiel
comme global. À garder à l'esprit pour la visibilité du gérant : la page et ses
six onglets ne sont pas un écran de supervision limité à sa gare.

## Chauffeur

| Page | Blocs affichés en même temps | Listes sans pagination | Tableaux trop larges sur téléphone | Actions principales |
|---|---|---|---|---|
| `/chauffeur/dashboard` | Jusqu'à 8 éléments : 5 cartes d'action rapide, portefeuille, recommandation tarifaire (selon les données) et voyages. | Jusqu'à 100 voyages et 100 colis sont chargés ; les voyages affichés n'ont pas de pagination. | Aucun tableau. | 5 raccourcis sont présentés au même niveau. Chaque voyage ajoute « Voir les colis » et « Scanner » ; « Voir tous les colis » est un lien distinct. |
| `/chauffeur/voyages` | 4 zones principales : planification, départs en cours/à venir, historique, lignes et cars. Des formulaires de ligne ou de véhicule apparaissent dans la zone de planification. | Départs et historique sont rendus en listes complètes des voyages chargés (jusqu'à 100 par requête) ; lignes et cars sans pagination visible. | Aucun tableau. | Chaque départ planifié expose jusqu'à 3 gestes (détails, ajuster, annuler). Les commandes d'historique et de parc se trouvent plus bas dans une page déjà longue. |
| `/chauffeur/voyages/[id]` | 7 modules principaux : informations, compteurs, actions de trajet, enregistrement direct, manifeste, passagers et colis ; une alerte d'instruction s'ajoute. | Jusqu'à 100 colis et 100 passagers pour le voyage ; manifeste et événements sans pagination visible. | Oui : manifeste à largeur minimale de 48 rem, tableau des passagers à 42 rem et tableau partagé des colis à 8 colonnes, avec défilement horizontal. | Le scan est en haut, mais les actions groupées, l'ajout direct et les gestes du manifeste se répartissent sur plusieurs blocs. Les mêmes colis/passagers réapparaissent dans le manifeste puis dans les vues détaillées, ce qui allonge la page. |
| `/chauffeur/colis` | 3 zones : 2 compteurs, filtres, liste. | Récupère jusqu'à 100 colis par voyage affecté ; aucune pagination de la liste agrégée. | Aucun tableau : lignes de colis en cartes compactes. | « Enregistrer un colis » est visible en tête ; chaque élément a un accès aux détails. |
| `/chauffeur/colis/[code]` | 3 cartes principales : ticket, informations, suivi chronologique. | Événements du colis rendus en entier, sans pagination visible. | Aucun tableau. | « Remettre au destinataire » est placé dans l'en-tête et ressort bien ; impression dans le ticket. |
| `/chauffeur/colis/nouveau` | Un parcours séquencé en 4 étapes ; selon l'état, sélecteur de voyage et encart du voyage s'ajoutent au formulaire. Une seule étape du formulaire est affichée à la fois. | Aucune liste de résultats. | Aucun tableau. | Le formulaire réduit le nombre d'actions simultanées ; les commandes Continuer/Retour sont en bas du contenu de l'étape. Sur petit écran, le repère des 4 étapes est une rangée non repliée et peut devenir serré. |
| `/chauffeur/passagers` | 2 zones principales : recherche et liste ; cartes individuelles pour les passagers. | Jusqu'à 100 suivis par voyage, sans pagination de la liste agrégée. | Aucun tableau. | Jusqu'à 2 boutons verticaux par passager (départ, arrivée), plus l'enregistrement en tête. La répétition peut charger la liste lorsque beaucoup de passagers sont affichés. |
| `/chauffeur/passagers/nouveau` | Sélecteur et encart du voyage, puis 2 cartes de formulaire (passager/contacts et trajet/attribution). | Aucune liste de résultats. | Aucun tableau. | Le bouton de paiement/activation est en fin du long formulaire de trajet ; il demande un défilement important avant l'action finale. |
| `/chauffeur/scan` | 1 module scanner, alerte de rattachement au voyage si applicable et résultat après scan. | Aucun résultat-listé. | Aucun tableau. | Valider le scan et ouvrir/fermer la caméra sont visibles dans le scanner. La prévisualisation caméra n'apparaît qu'après activation. |
| `/chauffeur/cagnotte` | 3 zones : solde, opérations et gains. | 50 mouvements et 50 commissions, sans pagination ni accès visible aux pages suivantes. | Les 2 tableaux défilent horizontalement ; 4 colonnes pour les opérations, 3 pour les gains. | Actualiser est disponible dans la zone solde ; pas de surcharge d'actions. |
| `/chauffeur` | Écran transitoire de redirection vers le tableau de bord, pas une page logistique distincte. | — | — | Aucun geste métier sur cet écran. |

## Receveur

| Page | Blocs affichés en même temps | Listes sans pagination | Tableaux trop larges sur téléphone | Actions principales |
|---|---|---|---|---|
| `/receveur/dashboard` | Jusqu'à 11 éléments : 5 raccourcis, départs annoncés, recommandation tarifaire, analyse de demande, portefeuille, compteurs et derniers colis. | 100 colis et 100 voyages chargés ; 10 colis récents sont montrés dans le tableau de bord. Départs annoncés limités à 6. | Oui : le tableau des derniers colis contient jusqu'à 8 colonnes et défile horizontalement. | 5 raccourcis au même niveau. Chaque départ ajoute 2 gestes (colis/passager). L'accès « Voir tous les colis » est placé sous les récents, donc peut être loin du haut. |
| `/receveur/tickets` | 2 cartes principales (recherche/filtres et résultats), avec le bouton d'enregistrement après la liste. | Jusqu'à 100 colis ; aucun contrôle de pagination. | Oui : tableau partagé à 8 colonnes, défilement horizontal. | Recherche, 5 filtres de statut et filtre de gare sont regroupés ; « Enregistrer un nouveau colis » est après les résultats plutôt qu'au niveau du titre. |
| `/receveur/tickets/[code]` | Jusqu'à 5 cartes : ticket, paiement, informations, affectation chauffeur et suivi. Deux colonnes sur grand écran, empilées sur téléphone. | Événements du colis sans pagination visible. | Aucun tableau. | « Scanner / Livrer » est en tête. Les actions de paiement et d'affectation sont dans des blocs séparés plus bas. |
| `/receveur/colis/nouveau` | Indicateur des 4 étapes, 1 carte d'étape à la fois et encart d'astuce ; ticket et actions de suivi remplacent le formulaire après création. | Aucune liste de résultats. | Aucun tableau. | Les boutons Retour/Continuer et de validation sont en bas de leur étape. Les libellés des 4 étapes restent dans une rangée compacte sur mobile. |
| `/receveur/suivi-familial` | 4 groupes : 3 indicateurs, filtres, liste et aide explicative ; les indicateurs sont 3 cartes séparées. | Jusqu'à 100 suivis, sans pagination visible. | Aucun tableau. | Selon le statut, une carte peut proposer confirmer la remise, affecter/changer de chauffeur et ouvrir le suivi public. Le bouton d'ajout est en haut ; les gestes répétés chargent les lignes. |
| `/receveur/suivi-familial/nouveau` | 2 grandes cartes de formulaire (passager/contacts et trajet/attribution) ; le ticket et les étiquettes remplacent ces cartes après création. | Aucune liste de résultats. | Aucun tableau. | Formulaire long : « Payer & activer le suivi » se trouve après les contacts, l'attribution, les bagages et le paiement. Action finale peu visible sans défilement. |
| `/receveur/scan` | 1 module scanner ; cartes de résultat éventuelles après l'opération. | Aucun résultat-listé. | Aucun tableau. | Valider et ouvrir/fermer la caméra sont disponibles dans le module ; pas de surcharge. |
| `/receveur/cagnotte` | 3 zones : solde, opérations et gains. | 50 mouvements et 50 commissions, sans pagination. | Oui : tableaux de 4 et 3 colonnes avec défilement horizontal. | Une action Actualiser, sans surcharge. |
| `/receveur/vehicules` | Redirige vers `/gerant-gare/vehicules` ; pas de vue propre au receveur. | — | — | La destination est un écran de gestion des cars. |
| `/receveur` | Écran transitoire de redirection vers le tableau de bord. | — | — | Aucun geste métier sur cet écran. |

## Gérant de gare

| Page | Blocs affichés en même temps | Listes sans pagination | Tableaux trop larges sur téléphone | Actions principales |
|---|---|---|---|---|
| `/gerant-gare/dashboard` | 4 groupes : 3 cartes d'action, 3 indicateurs, analyse prédictive et carte du parc roulant. | Parc chargé sans pagination visible ; jusqu'à 100 colis pour l'analyse. Le tableau de bord ne déroule pas la liste des cars. | Aucun tableau. | 3 raccourcis sont visibles ; « Gérer les cars et chauffeurs » apparaît dans le bloc du parc, plus bas. |
| `/gerant-gare/vehicules` | 2 grandes cartes (enregistrement et liste de cars), plus texte d'aide ; chaque car est une carte. | Cars affichés sans pagination visible (première page API). Le filtre « seulement ma gare » réduit la liste localement. | Aucun tableau : cartes véhicule responsives. | Chaque car expose le choix du chauffeur et l'activation/désactivation ; recherche, bouton Chercher et filtre de gare s'ajoutent. L'association de plusieurs commandes à chaque carte peut encombrer un écran étroit. |
| `/gerant-gare/colis/nouveau` | Même formulaire partagé en 4 étapes que le receveur, avec une seule étape visible à la fois. | Aucune liste de résultats. | Aucun tableau. | Validation en bas de l'étape ; le parent d'écran n'ajoute pas d'en-tête de page propre. |
| `/gerant-gare/passagers/nouveau` | Même formulaire partagé en 2 grandes cartes que le receveur. | Aucune liste de résultats. | Aucun tableau. | Le bouton de paiement/activation est en bas de la seconde carte. |
| `/gerant-gare/scan` | 1 module scanner, résultats éventuels après scan. | Aucun résultat-listé. | Aucun tableau. | Action de scan dans le module ; le texte de page précise un usage de litige. |
| `/gerant-gare/cagnotte` | 3 zones : solde, opérations et gains. | 50 mouvements et 50 commissions, sans pagination. | Oui : tableaux de 4 et 3 colonnes avec défilement horizontal. | Une action Actualiser, sans surcharge. |
| `/super-admin/logistique` | Même page de référentiel que le super-admin (voir la section Super-administrateur). | Listes globales sans pagination visible, chargées sur la première page. | Oui : tableaux de 4 à 6 colonnes défilants. | 6 onglets et commandes de création/suppression ; la page est explicitement globale, pas centrée sur la gare du gérant. |
| `/gerant-gare` | Écran transitoire de redirection vers le tableau de bord. | — | — | Aucun geste métier sur cet écran. |

## Citoyen et parcours publics de transport

| Page | Blocs affichés en même temps | Listes sans pagination | Tableaux trop larges sur téléphone | Actions principales |
|---|---|---|---|---|
| `/citoyen/dashboard` | 3 zones principales : identité et vérifications (2 cartes), puis transport/suivi (1 carte). | Les colis liés au compte sont limités à 5 éléments affichés ; pas de pagination ni de lien « voir tous » dans cette liste. | Aucun tableau. | Champ de code et bouton Suivre sont visibles dans la carte transport ; des liens de profil/vérification et une entrée carte DigiID coexistent. |
| `/horaires` (public, également accessible au citoyen connecté) | Pour un visiteur : recherche de suivi, filtres et liste groupée par jour. Pour un utilisateur connecté : une zone supplémentaire de notifications, placée après la liste sur téléphone. Le nombre de groupes dépend des jours présents. | Jusqu'à 100 départs, sans pagination ; le filtre « Tous les départs » reste limité aux éléments chargés. Notifications affichées dans une zone défilante interne (hauteur max 70 vh). | Aucun tableau : cartes de départs flexibles. | Suivre un colis, recherche de destination/gare et 3 horizons. Les commandes sont discernables ; sur téléphone, la liste des départs précède les notifications. |
| `/suivi` | Formulaire de code et 3 cartes explicatives (4 blocs principaux). | Aucun historique ni liste de résultats. | Aucun tableau. | Une action principale « Suivre mon envoi » ; visible et pleine largeur. |
| `/suivi/[code]` | En état normal : en-tête, carte trajet, timeline, notifications SMS et note de confidentialité (4 blocs de contenu hors en-tête). | Étapes et notifications renvoyées pour le suivi affichées en entier, sans pagination visible. | Aucun tableau. | Pas d'action métier en état normal ; en erreur, Réessayer et Accueil sont présentés ensemble. |
| `/citoyen` | Écran transitoire de redirection vers le tableau de bord. | — | — | Aucun geste métier sur cet écran. |

## Synthèse et pistes de disposition

Les problèmes les plus marqués sont les listes sans commandes de pagination, les
tables de données larges et les tableaux de bord du receveur/chauffeur qui
empilent plusieurs zones avant les informations opérationnelles.

Pistes limitées à l'affichage, sans toucher aux couleurs, polices ni composants
du système de design :

1. Ajouter des commandes de pagination ou « charger plus » aux listes longues ;
   conserver les filtres à proximité de la liste et rendre visible le nombre
   d'éléments chargés.
2. Sur téléphone, remplacer les tables larges par des cartes récapitulatives ou
   des lignes à détails repliables, en gardant accessibles les mêmes champs et
   gestes. Priorité au tableau des colis, au manifeste et aux tableaux du
   référentiel.
3. Réduire la densité initiale des tableaux de bord en séparant les actions
   principales des raccourcis secondaires, et en reportant les analyses ou
   historiques sous les informations du jour.
4. Dans le détail d'un voyage, afficher d'abord l'étape courante et ses gestes,
   puis replier ou regrouper le manifeste et les listes détaillées pour éviter
   la répétition de contenu sur une longue page.
5. Pour les formulaires longs, garder une seule étape active, compacter le
   repère d'étapes sur mobile et maintenir les commandes Retour/Continuer ou
   Payer/Valider près du formulaire actif.
6. Dans les tickets, rapprocher l'action d'enregistrement du titre et présenter
   les commandes répétées des suivis/cars de façon moins concurrente au contenu
   de chaque carte.
