/**
 * Rôles autorisés par écran du guichet logistique (S3).
 *
 * Les valeurs doivent correspondre aux rôles du backend
 * (`src.noyau.constantes_roles`) : `receveur`, `gerant_gare`, `chauffeur`,
 * `commercant`, plus les rôles d'administration pour le support.
 */

/** Opérations de guichet : réception, suivi et remise aux familles. */
export const ROLES_GUICHET: string[] = [
  "receveur",
  "super_administrateur",
  "super_admin",
];

/** Supervision de gare et gestion du parc roulant. */
export const ROLES_GERANT_GARE: string[] = [
  "gerant_gare",
  "super_administrateur",
  "super_admin",
];

/** Enregistrement au guichet (`logistique.colis.creer`). */
export const ROLES_GUICHET_ECRITURE: string[] = [
  "receveur",
  "super_administrateur",
  "super_admin",
];

/** Seul le guichet reçoit et remet les colis et passagers. */
export const ROLES_SCAN_GUICHET: string[] = [
  "receveur",
  "super_administrateur",
  "super_admin",
];

/**
 * Parcours du chauffeur : ses voyages et les événements de transport.
 */
export const ROLES_CHAUFFEUR: string[] = [
  "chauffeur",
  "super_administrateur",
  "super_admin",
];

/** Seul le chauffeur valide les départs, transits et arrivées. */
export const ROLES_SCAN_CHAUFFEUR: string[] = [
  "chauffeur",
  "super_administrateur",
  "super_admin",
];

/** Espace commerçant : dépôts et suivi, sans cagnotte. */
export const ROLES_COMMERCANT: string[] = [
  "citoyen",
  "commercant",
  "super_administrateur",
  "super_admin",
];

/**
 * Paiement / cagnotte (S6) — permission `paiement.lire`.
 *
 * Receveurs, gérants et chauffeurs consultent leur cagnotte. Le commerçant
 * paie les frais de suivi mais ne dispose pas de portefeuille.
 */
export const ROLES_CAGNOTTE: string[] = [
  "receveur",
  "gerant_gare",
  "chauffeur",
  "super_administrateur",
  "super_admin",
];

/**
 * Référentiel roulant : enregistrer un car et l'affecter à son chauffeur.
 *
 * Permissions `logistique.vehicule.ecrire` et `logistique.vehicule.affecter` :
 * ouvertes au gérant de gare et au receveur, qui traitent le terrain au
 * quotidien (« le super-admin n'est pas toujours disponible »), plus les admins
 * pour le support.
 */
export const ROLES_REFERENTIEL_ROULANT: string[] = [
  "gerant_gare",
  "super_administrateur",
  "super_admin",
];

/** Encaisser un paiement (permission `paiement.payer`). */
export const ROLES_PAIEMENT: string[] = [
  "receveur",
  "gerant_gare",
  "commercant",
  "super_administrateur",
  "super_admin",
];

/**
 * Carte DigiID (module identité) — **tout compte authentifié** y a droit.
 *
 * La carte est le socle de DigiID : un citoyen, un policier ou un chauffeur
 * présentent la même carte ; seule la finalité du scan change. La page elle-même
 * n'affiche que les données de la personne connectée.
 */
export const TOUS_LES_ROLES: string[] = [
  "super_admin",
  "super_administrateur",
  "administrateur",
  "admin_domaine",
  "chef_police",
  "chef_medical",
  "chef_ong",
  "chef_agent",
  "agent_police",
  "agent_medical",
  "agent_ong",
  "agent_terrain",
  "gerant_gare",
  "receveur",
  "chauffeur",
  "commercant",
  "citoyen",
];
