/**
 * Service API pour la gestion des domaines (Super Admin).
 */
import { clientAPI } from "./client_api";

const PREFIXE = "/api/v1/domaines";

export interface Domaine {
  id: string;
  nom: string;
  code: string;
  description: string | null;
  region: string | null;
  admin_id: string | null;
  est_actif: boolean;
  date_creation: string;
  date_modification: string | null;
  date_suspension: string | null;
  motif_suspension: string | null;
}

export interface DomaineCreate {
  nom: string;
  code: string;
  description?: string;
  region?: string;
}

export interface DomaineUpdate {
  nom?: string;
  description?: string;
  region?: string;
  admin_id?: string | null;
}

export interface ListeDomaines {
  domaines: Domaine[];
  total: number;
  page: number;
  par_page: number;
}

/** Liste tous les domaines */
export const listerDomaines = (page = 1, par_page = 20) =>
  clientAPI.get<ListeDomaines>(`${PREFIXE}?page=${page}&par_page=${par_page}`, { authentifie: true });

/** Obtient un domaine par son ID */
export const obtenirDomaine = (id: string) =>
  clientAPI.get<Domaine>(`${PREFIXE}/${id}`, { authentifie: true });

/** Crée un nouveau domaine */
export const creerDomaine = (donnees: DomaineCreate) =>
  clientAPI.post<Domaine>(PREFIXE, donnees, { authentifie: true });

/** Modifie un domaine */
export const modifierDomaine = (id: string, donnees: DomaineUpdate) =>
  clientAPI.patch<Domaine>(`${PREFIXE}/${id}`, donnees, { authentifie: true });

/** Supprime un domaine */
export const supprimerDomaine = (id: string) =>
  clientAPI.delete<void>(`${PREFIXE}/${id}`, { authentifie: true });

/** Suspend un domaine */
export const suspendreDomaine = (id: string, motif: string) =>
  clientAPI.post<Domaine>(`${PREFIXE}/${id}/suspendre`, { motif }, { authentifie: true });

/** Réactive un domaine */
export const reactiverDomaine = (id: string) =>
  clientAPI.post<Domaine>(`${PREFIXE}/${id}/reactiver`, undefined, { authentifie: true });