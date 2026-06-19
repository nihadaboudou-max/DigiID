/**
 * Service super admin — API complète pour la gestion.
 * VERSION 2 : endpoints améliorés avec pagination et filtrage.
 */
import { clientAPI, ErreurAPI } from "./client_api";

const PREFIXE = "/api/v1/super-admin";

export interface AdminApercu {
  id: string;
  email: string;
  prenom: string | null;
  nom: string | null;
  role: string;
  est_actif: boolean;
  deux_fa_active: boolean;
  est_email_verifie: boolean;
  date_creation: string;
  date_derniere_connexion: string | null;
}

export interface AdminDetail extends AdminApercu {
  ville?: string | null;
  est_verrouille?: boolean;
  date_verrouillage?: string | null;
  sessions_actives?: number;
  total_evenements_audit?: number;
}

export interface ListeAdmins {
  administrateurs: AdminApercu[];
  total: number;
}

export interface CreerAdminRequete {
  email: string;
  mot_de_passe: string;
  prenom: string;
  nom: string;
  ville?: string;
}

export interface CreerProfilRequete {
  email: string;
  mot_de_passe: string;
  prenom: string;
  nom: string;
  role: string;
  ville?: string;
}

export interface UtilisateurApercu {
  id: string;
  email: string;
  prenom: string | null;
  nom: string | null;
  role: string;
  est_actif: boolean;
  est_verrouille: boolean;
  deux_fa_active: boolean;
  est_email_verifie: boolean;
  ville: string | null;
  date_creation: string;
  date_derniere_connexion: string | null;
}

export interface ModifierAdminRequete {
  prenom?: string;
  nom?: string;
  ville?: string;
}

export interface EvenementAudit {
  id: string;
  date_evenement: string;
  type_evenement: string;
  description: string;
  utilisateur_id: string | null;
  role_acteur: string | null;
  adresse_ip: string | null;
  agent_utilisateur: string | null;
  donnees_supplementaires: Record<string, unknown> | null;
  score_risque: number | null;
}

export interface FiltresAudit {
  page?: number;
  limite?: number;
  type_evenement?: string;
  date_debut?: string;
  date_fin?: string;
  utilisateur_id?: string;
  recherche?: string;
}

export interface ListeAudit {
  donnees: EvenementAudit[];
  total: number;
  page: number;
  pages: number;
  limite: number;
}

export interface StatistiquesUtilisateurs {
  total_utilisateurs: number;
  total_actifs: number;
  total_inactifs: number;
  total_supprimes: number;
  total_verifies_email: number;
  total_non_verifies_email: number;
  total_2fa_actif: number;
  total_2fa_inactif: number;
  total_verrouilles: number;
  taux_activation_2fa: number;
  taux_verification_email: number;
}

export interface StatistiquesAdmins {
  total_admins: number;
  admins_actifs: number;
  admins_inactifs: number;
  admins_2fa_actif: number;
  admins_sans_2fa: number;
}

export interface StatistiquesSessions {
  sessions_actives: number;
  sessions_expirees: number;
  sessions_revoquees: number;
  sessions_aujourd_hui: number;
  total_sessions: number;
}

export interface StatistiquesScore {
  score_moyen: number;
  score_min: number | null;
  score_max: number | null;
  utilisateurs_avec_score: number;
  recalculs_effectues: number;
}

export interface StatistiquesCompletes {
  utilisateurs: StatistiquesUtilisateurs;
  administrateurs: StatistiquesAdmins;
  sessions: StatistiquesSessions;
  scores: StatistiquesScore;
  total_evenements_audit: number;
  evenements_aujourd_hui: number;
  date_calcul: string;
}

/**
 * ============================================================================
 * ADMINISTRATEURS
 * ============================================================================
 */

/** Liste tous les administrateurs */
export const listerAdmins = () =>
  clientAPI.get<ListeAdmins>(`${PREFIXE}/administrateurs`, { authentifie: true });

/** Obtient les détails d'un administrateur spécifique */
export const obtenirAdminDetail = (adminId: string) =>
  clientAPI.get<AdminDetail>(`${PREFIXE}/administrateurs/${adminId}`, { authentifie: true });

/** Crée un nouvel administrateur */
export const creerAdmin = (donnees: CreerAdminRequete) =>
  clientAPI.post<AdminApercu>(`${PREFIXE}/administrateurs`, donnees, { authentifie: true });

/** Crée un profil utilisateur avec rôle spécifique (hors citoyen) */
export const creerProfilUtilisateur = (donnees: CreerProfilRequete) =>
  clientAPI.post<UtilisateurApercu>(`${PREFIXE}/utilisateurs/profils`, donnees, { authentifie: true });

/** Modifie un administrateur (prénom, nom, ville) */
export const modifierAdmin = (adminId: string, donnees: ModifierAdminRequete) =>
  clientAPI.patch<AdminApercu>(`${PREFIXE}/administrateurs/${adminId}`, donnees, {
    authentifie: true,
  });

/** Suspend un administrateur (il ne peut plus se connecter) */
export const suspendreAdmin = (adminId: string) =>
  clientAPI.patch<AdminApercu>(`${PREFIXE}/administrateurs/${adminId}/suspendre`, undefined, {
    authentifie: true,
  });

/** Réactive un administrateur précédemment suspendu */
export const reactiverAdmin = (adminId: string) =>
  clientAPI.patch<AdminApercu>(`${PREFIXE}/administrateurs/${adminId}/reactiver`, undefined, {
    authentifie: true,
  });

/** Supprime un administrateur (soft delete) — PHASE 6 */
export const supprimerAdmin = (adminId: string) =>
  clientAPI.delete<void>(`${PREFIXE}/administrateurs/${adminId}`, {
    authentifie: true,
  });

/** Réinitialise le mot de passe d'un administrateur — PHASE 6 */
export const reinitialiserMotDePasse = (adminId: string) =>
  clientAPI.post<{ nouveau_mot_de_passe: string; message: string }>(
    `${PREFIXE}/administrateurs/${adminId}/reset-password`,
    undefined,
    { authentifie: true }
  );

/** Active ou désactive 2FA pour un administrateur — PHASE 6 */
export const basculer2FA = (adminId: string, activer: boolean) =>
  clientAPI.patch<AdminApercu>(`${PREFIXE}/administrateurs/${adminId}/2fa`, { deux_fa_active: activer }, {
    authentifie: true,
  });

/**
 * ============================================================================
 * AUDIT
 * ============================================================================
 */

/** Liste les événements d'audit avec pagination et filtres */
export const listerAudit = (filtres: FiltresAudit) => {
  const params = new URLSearchParams();
  if (filtres.page) params.append("page", String(filtres.page));
  if (filtres.limite) params.append("limite", String(filtres.limite));
  if (filtres.type_evenement) params.append("type_evenement", filtres.type_evenement);
  if (filtres.date_debut) params.append("date_debut", filtres.date_debut);
  if (filtres.date_fin) params.append("date_fin", filtres.date_fin);
  if (filtres.utilisateur_id) params.append("utilisateur_id", filtres.utilisateur_id);
  if (filtres.recherche) params.append("recherche", filtres.recherche);

  const url = `${PREFIXE}/audit?${params.toString()}`;
  return clientAPI.get<ListeAudit>(url, { authentifie: true });
};

/** Exporte les événements d'audit en CSV — PHASE 6 */
export const exporterAuditCSV = async (filtres: FiltresAudit): Promise<Blob> => {
  const params = new URLSearchParams();
  if (filtres.type_evenement) params.append("type_evenement", filtres.type_evenement);
  if (filtres.date_debut) params.append("date_debut", filtres.date_debut);
  if (filtres.date_fin) params.append("date_fin", filtres.date_fin);

  const url = `${PREFIXE}/audit/export/csv?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token_acces") || ""}`,
    },
  });

  if (!response.ok) {
    throw new ErreurAPI("EXPORT_ERR", "Impossible d'exporter les données", response.status);
  }

  return response.blob();
};

/**
 * ============================================================================
 * STATISTIQUES & TABLEAU DE BORD
 * ============================================================================
 */

/** Récupère les statistiques détaillées du système */
export const obtenirStatistiques = () =>
  clientAPI.get<StatistiquesCompletes>(`${PREFIXE}/statistiques`, { authentifie: true });

/**
 * ============================================================================
 * SESSIONS
 * ============================================================================
 */

export interface SessionAdmin {
  id: string;
  utilisateur_id: string;
  adresse_ip: string;
  agent_utilisateur?: string;
  cree_le: string;
  date_derniere_utilisation: string;
  date_expiration: string;
  est_revoquee: boolean;
  raison_revocation?: string | null;
}

export interface ListeSessions {
  sessions: SessionAdmin[];
  total: number;
  actives: number;
}

/** Liste les sessions actives d'un administrateur */
export const listerSessionsAdmin = (adminId: string) =>
  clientAPI.get<ListeSessions>(`${PREFIXE}/administrateurs/${adminId}/sessions`, {
    authentifie: true,
  });

/** Révoque une session d'un administrateur (force déconnexion) */
export const revoquerSessionAdmin = (adminId: string, sessionId: string) =>
  clientAPI.post<void>(
    `${PREFIXE}/administrateurs/${adminId}/sessions/${sessionId}/revoquer`,
    undefined,
    { authentifie: true }
  );

/**
 * ============================================================================
 * CONFIGURATION
 * ============================================================================
 */

export interface FeatureFlagItem {
  cle: string;
  valeur: string | boolean | number;
  description?: string | null;
  categorie?: string | null;
  phase_introduction?: string | null;
  niveau_sensibilite: number;
}

export interface ListeFeatureFlags {
  flags: FeatureFlagItem[];
  total: number;
}

export interface MiseAJourFeatureFlags {
  flags: Record<string, string | boolean | number>;
}

/** Récupère la liste des feature flags */
export const listerFeatureFlags = () =>
  clientAPI.get<ListeFeatureFlags>(`${PREFIXE}/configuration/feature-flags`, { authentifie: true });

/** Modifie un ou plusieurs feature flags (PHASE 6) */
export const modifierFeatureFlags = (donnees: MiseAJourFeatureFlags) =>
  clientAPI.patch<ListeFeatureFlags>(`${PREFIXE}/configuration/feature-flags`, donnees, {
    authentifie: true,
  });

/**
 * ============================================================================
 * UTILITAIRES
 * ============================================================================
 */

/** Télécharge un blob de données (utile pour les exports) */
export const telechargerFichier = (blob: Blob, nomFichier: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
