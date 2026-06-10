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





