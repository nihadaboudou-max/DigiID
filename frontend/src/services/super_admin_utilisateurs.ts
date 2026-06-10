/**
 * Service super admin — Gestion complète des utilisateurs.
 * Tous les appels sont dynamiques vers le backend.
 * Utilisé par /super-admin/utilisateurs et /super-admin/droits.
 */
import { clientAPI, ErreurAPI } from "./client_api";

const PREFIXE = "/api/v1/super-admin/utilisateurs";
const PREFIXE_DROITS = "/api/v1/super-admin/droits";

// ============================================================================
// TYPES
// ============================================================================

export interface UtilisateurComplet {
  id: string;
  email: string;
  prenom: string | null;
  nom: string | null;
  role: string;
  est_actif: boolean;
  est_verrouille: boolean;
  est_supprime: boolean;
  deux_fa_active: boolean;
  est_email_verifie: boolean;
  ville: string | null;
  score_actuel: number | null;
  date_creation: string;
  date_derniere_connexion: string | null;
  date_verrouillage: string | null;
  date_suppression: string | null;
  motif_suspension: string | null;
  sessions_actives: number;
  roles_autorises: string[];
}

export interface ListeUtilisateurs {
  utilisateurs: UtilisateurComplet[];
  total: number;
  page: number;
  pages: number;
  limite: number;
}

export interface FiltresUtilisateurs {
  page?: number;
  limite?: number;
  recherche?: string;
  role?: string;
  est_actif?: boolean;
  est_verrouille?: boolean;
  est_supprime?: boolean;
  deux_fa_active?: boolean;
  ville?: string;
  date_debut?: string;
  date_fin?: string;
  tri?: string;
  ordre?: "asc" | "desc";
}

export interface ModifierUtilisateurRequete {
  prenom?: string;
  nom?: string;
  ville?: string;
}

export interface ChangerRoleRequete {
  role: string;
  motif: string;
}

export interface AssignerDroitRequete {
  email: string;
  role: string;
  technologies: string[];
}

export interface NombreUtilisateurs {
  total: number;
  actifs: number;
  verrouilles: number;
  supprimes: number;
  avec_2fa: number;
  sans_2fa: number;
}

// ============================================================================
// UTILISATEURS — CRUD complet
// ============================================================================

/** Liste tous les utilisateurs avec pagination et filtres */
export const listerTousUtilisateurs = (filtres?: FiltresUtilisateurs) => {
  const params = new URLSearchParams();
  if (filtres?.page) params.append("page", String(filtres.page));
  if (filtres?.limite) params.append("limite", String(filtres.limite));
  if (filtres?.recherche) params.append("recherche", filtres.recherche);
  if (filtres?.role) params.append("role", filtres.role);
  if (filtres?.est_actif !== undefined) params.append("est_actif", String(filtres.est_actif));
  if (filtres?.est_verrouille !== undefined) params.append("est_verrouille", String(filtres.est_verrouille));
  if (filtres?.est_supprime !== undefined) params.append("est_supprime", String(filtres.est_supprime));
  if (filtres?.deux_fa_active !== undefined) params.append("deux_fa_active", String(filtres.deux_fa_active));
  if (filtres?.ville) params.append("ville", filtres.ville);
  if (filtres?.date_debut) params.append("date_debut", filtres.date_debut);
  if (filtres?.date_fin) params.append("date_fin", filtres.date_fin);
  if (filtres?.tri) params.append("tri", filtres.tri);
  if (filtres?.ordre) params.append("ordre", filtres.ordre);

  return clientAPI.get<ListeUtilisateurs>(`${PREFIXE}?${params.toString()}`, { authentifie: true });
};

/** Obtient les détails complets d'un utilisateur */
export const obtenirUtilisateurDetail = (utilisateurId: string) =>
  clientAPI.get<UtilisateurComplet>(`${PREFIXE}/${utilisateurId}`, { authentifie: true });

/** Modifie un utilisateur (prénom, nom, ville) */
export const modifierUtilisateur = (utilisateurId: string, donnees: ModifierUtilisateurRequete) =>
  clientAPI.patch<UtilisateurComplet>(`${PREFIXE}/${utilisateurId}`, donnees, { authentifie: true });

/** Suspend un utilisateur (ne peut plus se connecter) */
export const suspendreUtilisateur = (utilisateurId: string, motif?: string) =>
  clientAPI.patch<UtilisateurComplet>(
    `${PREFIXE}/${utilisateurId}/suspendre`,
    { motif: motif || "" },
    { authentifie: true }
  );

/** Réactive un utilisateur suspendu */
export const reactiverUtilisateur = (utilisateurId: string) =>
  clientAPI.patch<UtilisateurComplet>(`${PREFIXE}/${utilisateurId}/reactiver`, undefined, { authentifie: true });

/** Supprime un utilisateur (soft delete) */
export const supprimerUtilisateur = (utilisateurId: string, raison?: string) =>
  clientAPI.delete<{ succes: boolean; message: string; utilisateur_id: string }>(
    `${PREFIXE}/${utilisateurId}?raison=${encodeURIComponent(raison || "")}&confirmation=true`,
    { authentifie: true }
  );

/** Supprime définitivement un utilisateur (hard delete — super admin only) */
export const supprimerDefinitivementUtilisateur = (utilisateurId: string) =>
  clientAPI.delete<{ succes: boolean; message: string }>(
    `${PREFIXE}/${utilisateurId}/definitif?confirmation=true`,
    { authentifie: true }
  );

/** Change le rôle d'un utilisateur */
export const changerRoleUtilisateur = (utilisateurId: string, donnees: ChangerRoleRequete) =>
  clientAPI.patch<UtilisateurComplet>(`${PREFIXE}/${utilisateurId}/role`, donnees, { authentifie: true });

// ============================================================================
// DROITS — Assignation par email
// ============================================================================

/** Liste toutes les technologies disponibles avec leurs permissions */
export const listerTechnologies = () =>
  clientAPI.get<{ id: string; nom: string; icone: string; description: string }[]>(
    `${PREFIXE_DROITS}/technologies`,
    { authentifie: true }
  );

/** Liste tous les rôles disponibles */
export const listerRoles = () =>
  clientAPI.get<{ role: string; libelle: string; description: string; niveau: number }[]>(
    `${PREFIXE_DROITS}/roles`,
    { authentifie: true }
  );

/** Assigne un droit spécifique à un email utilisateur */
export const assignerDroit = (donnees: AssignerDroitRequete) =>
  clientAPI.post<{ succes: boolean; message: string }>(`${PREFIXE_DROITS}/assigner`, donnees, { authentifie: true });

/** Révoque un droit spécifique à un email utilisateur */
export const revoquerDroit = (email: string, technologie: string) =>
  clientAPI.delete<{ succes: boolean; message: string }>(
    `${PREFIXE_DROITS}/revoquer?email=${encodeURIComponent(email)}&technologie=${encodeURIComponent(technologie)}`,
    { authentifie: true }
  );

/** Récupère les droits d'un utilisateur par email */
export const obtenirDroitsUtilisateur = (email: string) =>
  clientAPI.get<{ email: string; role: string; technologies: string[] }>(
    `${PREFIXE_DROITS}/utilisateur?email=${encodeURIComponent(email)}`,
    { authentifie: true }
  );

// ============================================================================
// STATISTIQUES UTILISATEURS
// ============================================================================

/** Récupère les compteurs globaux */
export const compterUtilisateurs = () =>
  clientAPI.get<NombreUtilisateurs>(`${PREFIXE}/compter`, { authentifie: true });
