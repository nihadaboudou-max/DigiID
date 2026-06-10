/**
 * Service Admin — Attestations Communautaires.
 * 
 * Endpoints réservés aux administrateurs pour modérer le réseau de confiance :
 *   - Lister TOUTES les attestations du système
 *   - Voir les statistiques globales
 *   - Supprimer des attestations inappropriées
 */
import { clientAPI } from "./client_api";

// ============================================================================
// Types
// ============================================================================

/** Statistiques globales du système d'attestations */
export interface StatistiquesGlobalesAttestations {
  total: number;
  approuvees: number;
  en_attente: number;
  refusees: number;
  expirees: number;
  score_total_systeme: number;
  poids_moyen: number;
  attestants_uniques: number;
  attestes_uniques: number;
  creees_aujourd_hui: number;
  repartition_types: Array<{
    type: string;
    nombre: number;
  }>;
}

/** Résumé d'une attestation (identique à la version utilisateur) */
export interface AttestationResume {
  id: string;
  attestant_nom_complet: string;
  atteste_nom_complet: string;
  type_attestation: string;
  titre: string;
  statut: string;
  poids_score: number;
  est_active: boolean;
  date_soumission: string;
  date_decision: string | null;
  date_expiration: string | null;
}

/** Liste paginée d'attestations */
export interface ListeAttestationsAdmin {
  attestations: AttestationResume[];
  total: number;
  page: number;
  limite: number;
  pages_totales: number;
}

// ============================================================================
// Fonctions API
// ============================================================================

/**
 * Liste TOUTES les attestations du système (modération).
 * Réservé aux administrateurs et super-administrateurs.
 */
export async function listerToutesAttestations(params?: {
  statut?: string;
  type_attestation?: string;
  utilisateur_id?: string;
  page?: number;
  limite?: number;
}): Promise<ListeAttestationsAdmin> {
  const query = new URLSearchParams();
  if (params?.statut) query.set("statut", params.statut);
  if (params?.type_attestation) query.set("type_attestation", params.type_attestation);
  if (params?.utilisateur_id) query.set("utilisateur_id", params.utilisateur_id);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limite) query.set("limite", String(params.limite));

  const chaineRequete = query.toString();
  const url = chaineRequete
    ? `/api/v1/admin/attestations?${chaineRequete}`
    : `/api/v1/admin/attestations`;

  return clientAPI.get<ListeAttestationsAdmin>(
    url,
    { authentifie: true },
  );
}

/**
 * Récupère les statistiques globales des attestations.
 * Réservé aux administrateurs et super-administrateurs.
 */
export async function obtenirStatistiquesGlobales(): Promise<StatistiquesGlobalesAttestations> {
  return clientAPI.get<StatistiquesGlobalesAttestations>(
    "/api/v1/admin/attestations/statistiques",
    { authentifie: true },
  );
}

/**
 * Supprime une attestation (modération).
 * Réservé aux administrateurs et super-administrateurs.
 */
export async function supprimerAttestationAdmin(
  attestationId: string,
): Promise<{ message: string }> {
  return clientAPI.delete<{ message: string }>(
    `/api/v1/admin/attestations/${attestationId}`,
    { authentifie: true },
  );
}
