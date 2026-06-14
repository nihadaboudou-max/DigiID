import { clientAPI } from "./client_api";

// ============================================================================
// SCHÉMAS — Données échangées avec le backend admin
// ============================================================================

export interface UtilisateurApercuAdmin {
  id: string;
  prenom_initiale: string | null;
  nom_initiale: string | null;
  email_masque: string;
  ville: string | null;
  score_actuel: number | null;
  est_verrouille: boolean;
  date_inscription: string | null;
}

export interface StatsAdmin {
  total_utilisateurs: number;
  actifs_7_jours: number;
  comptes_verrouilles: number;
  score_moyen: number;
  repartition_par_ville: { ville: string; nombre: number }[];
  inscriptions_par_jour: { date: string; nombre: number }[];
}

export interface AlerteAdminItem {
  id: string;
  niveau: string;
  type_action: string;
  description: string;
  utilisateur_id: string | null;
  adresse_ip: string | null;
  date_evenement: string;
  resolue: boolean;
}

// ============================================================================
// FONCTIONS API
// ============================================================================

/** Récupère la liste pseudonymisée des utilisateurs */
export async function obtenirUtilisateursAdmin(): Promise<UtilisateurApercuAdmin[]> {
  return clientAPI.get<UtilisateurApercuAdmin[]>("/api/v1/admin/utilisateurs", {
    authentifie: true,
  });
}

/** Supprime le compte d'un utilisateur (soft-delete) */
export async function supprimerUtilisateurAdmin(
  utilisateurId: string,
  raison: string = "",
): Promise<{ succes: boolean; message: string; utilisateur_id: string }> {
  const params = new URLSearchParams();
  params.append("confirmation", "true");
  if (raison) params.append("raison", raison);
  return clientAPI.delete<{ succes: boolean; message: string; utilisateur_id: string }>(
    `/api/v1/admin/utilisateurs/${utilisateurId}?${params.toString()}`,
    { authentifie: true },
  );
}

/** Récupère les statistiques agrégées du système */
export async function obtenirStatistiquesAdmin(): Promise<StatsAdmin> {
  return clientAPI.get<StatsAdmin>("/api/v1/admin/statistiques", {
    authentifie: true,
  });
}

/** Récupère les alertes de sécurité */
export async function obtenirAlertesAdmin(params?: {
  resolues?: boolean;
  limite?: number;
}): Promise<AlerteAdminItem[]> {
  const query = new URLSearchParams();
  if (params?.resolues) query.append("resolues", "true");
  if (params?.limite) query.append("limite", String(params.limite));
  const url = `/api/v1/admin/alertes${query.toString() ? `?${query.toString()}` : ""}`;
        return clientAPI.get<AlerteAdminItem[]>(url, { authentifie: true });
}


// ============================================================================
// MONITORING TEMPS RÉEL
// ============================================================================

export interface ResumeMonitoring {
  utilisateurs_connectes: number;
  sessions_actives: number;
  connexions_aujourd_hui: number;
  administrateurs_connectes: number;
  utilisateurs_avec_sessions_multiples: number;
  alerts_recents: number;
  timestamp: string;
}

export interface UtilisateurConnecteAdmin {
  utilisateur_id: string;
  email: string;  // Déjà masqué par le backend pour l'admin
  nom: string | null;
  prenom: string | null;
  role: string;
  session_id: string;
  adresse_ip: string;
  ville_estimee: string | null;
  pays_estime: string | null;
  agent_utilisateur: string | null;
  derniere_activite: string;
  connexion_le: string;
  est_active: boolean;
  nb_sessions_actives: number;
}

export interface ActiviteRecente {
  id: string;
  type_evenement: string;
  description: string;
  utilisateur_id: string | null;
  email: string | null;
  role: string | null;
  adresse_ip: string | null;
  date_evenement: string;
}

export interface AlerteSecuriteItem {
  id: string;
  type_incident: string;
  niveau: string;
  description: string;
  utilisateur_id: string | null;
  email: string | null;
  adresse_ip: string | null;
  score_risque: number;
  date_detection: string;
  resolue: boolean;
}

export interface ResumeMonitoringComplet {
  resume: ResumeMonitoring;
  utilisateurs_connectes: UtilisateurConnecteAdmin[];
  activites_recentes: ActiviteRecente[];
  alertes: AlerteSecuriteItem[];
}

/** Récupère le résumé du monitoring temps réel (admin) */
export async function obtenirResumeMonitoring(): Promise<ResumeMonitoring> {
  return clientAPI.get<ResumeMonitoring>("/api/v1/admin/monitoring/resume", { authentifie: true });
}

/** Récupère la liste des utilisateurs connectés (admin) */
export async function obtenirUtilisateursConnectes(params?: {
  limite?: number;
  filtre_role?: string;
}): Promise<UtilisateurConnecteAdmin[]> {
  const query = new URLSearchParams();
  if (params?.limite) query.append("limite", String(params.limite));
  if (params?.filtre_role) query.append("filtre_role", params.filtre_role);
  const url = `/api/v1/admin/monitoring/utilisateurs-connectes${query.toString() ? `?${query.toString()}` : ""}`;
  return clientAPI.get<UtilisateurConnecteAdmin[]>(url, { authentifie: true });
}

/** Récupère les activités récentes (admin) */
export async function obtenirActivitesRecentes(params?: {
  limite?: number;
}): Promise<ActiviteRecente[]> {
  const query = new URLSearchParams();
  if (params?.limite) query.append("limite", String(params.limite));
  const url = `/api/v1/admin/monitoring/activites${query.toString() ? `?${query.toString()}` : ""}`;
  return clientAPI.get<ActiviteRecente[]>(url, { authentifie: true });
}

/** Récupère les alertes monitoring (admin) */
export async function obtenirAlertesMonitoring(params?: {
  limite?: number;
}): Promise<AlerteSecuriteItem[]> {
  const query = new URLSearchParams();
  if (params?.limite) query.append("limite", String(params.limite));
  const url = `/api/v1/admin/monitoring/alertes${query.toString() ? `?${query.toString()}` : ""}`;
  return clientAPI.get<AlerteSecuriteItem[]>(url, { authentifie: true });
}

/** Récupère le monitoring complet en un seul appel (admin) */
export async function obtenirMonitoringComplet(): Promise<ResumeMonitoringComplet> {
  return clientAPI.get<ResumeMonitoringComplet>("/api/v1/admin/monitoring/complet", { authentifie: true });
}






