/**
 * Rôles autorisés par écran du guichet logistique (S3).
 *
 * Les valeurs doivent correspondre aux rôles du backend
 * (`src.noyau.constantes_roles`) : `receveur`, `gerant_gare`, `chauffeur`,
 * `commercant`, plus les rôles d'administration pour le support.
 */

/** Consultation du tableau de bord et des colis (`logistique.lire`). */
export const ROLES_GUICHET: string[] = [
  "receveur",
  "gerant_gare",
  "chauffeur",
  "commercant",
  "super_administrateur",
  "super_admin",
];

/** Enregistrement d'un colis (permission `logistique.colis.creer`). */
export const ROLES_GUICHET_ECRITURE: string[] = [
  "receveur",
  "gerant_gare",
  "commercant",
  "super_administrateur",
  "super_admin",
];

/** Scan / livraison (permission `logistique.scan`). */
export const ROLES_SCAN: string[] = [
  "receveur",
  "gerant_gare",
  "chauffeur",
  "super_administrateur",
  "super_admin",
];
