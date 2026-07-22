/**
 * Types TypeScript des objets échangés avec l'API DigiID.
 * Reflètent les schémas Pydantic du backend.
 */

export type RoleUtilisateur =
  // ─── Rôles existants (rétrocompatibilité) ──────────────────────
  | "citoyen"
  | "administrateur"
  | "super_administrateur"
  // ─── NOUVEAUX RÔLES : Hiérarchie organisationnelle ─────────────
  | "super_admin"          // Niveau 1 : Super Admin Global
  | "admin_domaine"        // Niveau 2 : Admin de Domaine
  | "chef_police"          // Niveau 3 : Chefs de Département
  | "chef_medical"
  | "chef_ong"
  | "chef_agent"
  | "agent_police"         // Niveau 4 : Agents Terrain
  | "agent_medical"
  | "agent_ong"
  | "agent_terrain";

/** Rôles qui ont un panneau d'administration dédié */
export const ROLES_ADMIN: RoleUtilisateur[] = [
  "administrateur",
  "super_administrateur",
  "super_admin",
  "admin_domaine",
];

/** Rôles institutionnels vérifiés */
export const ROLES_INSTITUTIONNELS: RoleUtilisateur[] = [
  // Anciens rôles supprimés : "agent", "medecin", "police", "ong",
  // Nouveaux rôles
  "agent_police",
  "agent_medical",
  "agent_ong",
  "agent_terrain",
];

/** NOUVEAU : Rôles de chef de département */
export const ROLES_CHEF: RoleUtilisateur[] = [
  "chef_police",
  "chef_medical",
  "chef_ong",
  "chef_agent",
];

/** NOUVEAU : Rôles d'agent terrain */
export const ROLES_AGENT: RoleUtilisateur[] = [
  "agent_police",
  "agent_medical",
  "agent_ong",
  "agent_terrain",
];

/** NOUVEAU : Rôles d'administration (tous niveaux) */
export const ROLES_ADMINISTRATION: RoleUtilisateur[] = [
  "super_admin",
  "super_administrateur",
  "admin_domaine",
  "administrateur",
];

/** NOUVEAU : Rôles professionnels (tous sauf citoyen) */
export const ROLES_PROFESSIONNELS: RoleUtilisateur[] = [
  "super_admin",
  "super_administrateur",
  "admin_domaine",
  "administrateur",
  "chef_police",
  "chef_medical",
  "chef_ong",
  "chef_agent",
  "agent_police",
  "agent_medical",
  "agent_ong",
  "agent_terrain",
];

/**
 * Retourne le chemin du tableau de bord selon le rôle.
 */
export function cheminTableauDeBord(role: RoleUtilisateur): string {
  switch (role) {
    case "super_administrateur":
    case "super_admin":
      return "/super-admin/tableau-de-bord";
    case "administrateur":
      return "/admin/tableau-de-bord";
    case "admin_domaine":
      return "/admin-domaine/tableau-de-bord";
    case "agent_medical":
      return "/medecin/dashboard";
    case "agent_terrain":
      return "/agent/dashboard";
    case "agent_police":
      return "/police/dashboard";
    case "agent_ong":
      return "/ong/dashboard";
    // Nouveaux rôles chefs
    case "chef_police":
      return "/chef-police";
    case "chef_medical":
      return "/chef-medical";
    case "chef_ong":
      return "/chef-ong";
    case "chef_agent":
      return "/chef-enrolement";
    default:
      return "/tableau-de-bord";
  }
}

/**
 * NOUVEAU : Vérifie si le rôle est un rôle de chef.
 */
export function estRoleChef(role: RoleUtilisateur): boolean {
  return ROLES_CHEF.includes(role);
}

/**
 * NOUVEAU : Vérifie si le rôle est un rôle d'agent terrain.
 */
export function estRoleAgent(role: RoleUtilisateur): boolean {
  return ROLES_AGENT.includes(role);
}

/**
 * NOUVEAU : Vérifie si le rôle est un rôle d'administration.
 */
export function estRoleAdmin(role: RoleUtilisateur): boolean {
  return ROLES_ADMIN.includes(role);
}

/**
 * NOUVEAU : Retourne le niveau hiérarchique (1 = plus élevé).
 */
export function obtenirNiveauHierarchie(role: RoleUtilisateur): number {
  if (role === "super_admin" || role === "super_administrateur") return 1;
  if (role === "admin_domaine" || role === "administrateur") return 2;
  if (ROLES_CHEF.includes(role)) return 3;
  if (ROLES_AGENT.includes(role)) return 4;
  if (role === "citoyen") return 5;
  return 99;
}

/**
 * NOUVEAU : Retourne le type de département associé à un rôle.
 */
export function obtenirTypeDepartementDepuisRole(
  role: RoleUtilisateur
): string | null {
  const mapping: Record<string, string> = {
    chef_police: "police",
    agent_police: "police",
    chef_medical: "medical",
    agent_medical: "medical",
    chef_ong: "ong",
    agent_ong: "ong",
    chef_agent: "agent",
    agent_terrain: "agent",
  };
  return mapping[role] || null;
}

export interface Utilisateur {
  id: string;
  digiid_public: string | null;
  email: string;
  prenom: string | null;
  nom: string | null;
  telephone?: string | null;
  ville: string | null;
  role: RoleUtilisateur;
  deux_fa_active: boolean;
  est_email_verifie: boolean;
  score_actuel: number | null;
  date_creation?: string;
  est_actif: boolean;

  // --- NOUVEAU : Cloisonnement multi-niveaux ---
  domaine_id?: string | null;
  departement_id?: string | null;
  equipe_id?: string | null;
  superieur_id?: string | null;
  est_chef_departement?: boolean;

  // --- Vérifications identité (ajout Phase OCR CNI) ---
  est_visage_verifie?: boolean;
  date_verification_visage?: string | null;
  est_cni_verifiee?: boolean;
  date_verification_cni?: string | null;
  date_derniere_mise_a_jour_verifications?: string | null;
  niveau_verification?: "aucune" | "partielle" | "renforcee" | "complete";
  progres_verifications?: number;

  // --- Attestations communautaires ---
  attestations_recues?: AttestationRecue[];
  attestations_emises?: AttestationEmise[];
}

/** Attestation reçue dans le profil. */
export interface AttestationApercu {
  id: string;
  type_attestation: string;
  titre: string;
  statut: string;
  date_soumission: string;
  date_expiration: string | null;
  poids_score: number;
  est_active: boolean;
}

export interface AttestationRecue extends AttestationApercu {
  attestant_id: string;
  lien_connu_depuis: string | null;
  lien_nature: string | null;
  forces: string | null;
}

export interface AttestationEmise extends AttestationApercu {
  atteste_id: string;
}

export interface Jetons {
  token_acces: string;
  token_rafraichissement: string;
  type_token: string;
  duree_validite_secondes: number;
}

export interface ReponseConnexion {
  utilisateur: Utilisateur;
  jetons: Jetons;
}

export interface ReponseInscription {
  utilisateur: Utilisateur;
  jetons?: Jetons | null;
  message: string;
}

export interface ReponseErreurAPI {
  code_erreur: string;
  message: string;
  details?: Record<string, unknown> | null;
  request_id?: string | null;
}

export interface DonneesConnexion {
  email: string;
  mot_de_passe: string;
  code_2fa?: string;
}

export interface DonneesInscription {
  email: string;
  mot_de_passe: string;
  prenom: string;
  nom: string;
  telephone?: string;
  ville?: string;
  code_parrainage?: string;
  accepte_cgu: boolean;
}