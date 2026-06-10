/**
 * Types TypeScript des objets échangés avec l'API DigiID.
 * Reflètent les schémas Pydantic du backend.
 */

export type RoleUtilisateur =
  | "citoyen"
  | "agent"
  | "medecin"
  | "police"
  | "ong"
  | "administrateur"
  | "super_administrateur";

/** Rôles qui ont un panneau d'administration dédié */
export const ROLES_ADMIN: RoleUtilisateur[] = [
  "administrateur",
  "super_administrateur",
];

/** Rôles institutionnels vérifiés */
export const ROLES_INSTITUTIONNELS: RoleUtilisateur[] = [
  "agent",
  "medecin",
  "police",
  "ong",
];

/**
 * Retourne le chemin du tableau de bord selon le rôle.
 */
export function cheminTableauDeBord(role: RoleUtilisateur): string {
  if (role === "super_administrateur") return "/super-admin/tableau-de-bord";
  if (role === "administrateur") return "/admin/tableau-de-bord";
  return "/tableau-de-bord";
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
