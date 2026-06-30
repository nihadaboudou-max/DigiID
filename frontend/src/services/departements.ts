/**
 * Service API pour la gestion des départements (Super Admin).
 */
import { clientAPI } from "./client_api";

const PREFIXE = "/api/v1/departements";

export interface Departement {
  id: string;
  nom: string;
  type_departement: string;
  description: string | null;
  capacite_max: number;
  domaine_id: string;
  chef_id: string | null;
  est_actif: boolean;
  date_creation: string;
  date_modification: string | null;
}

export interface DepartementCreate {
  nom: string;
  type_departement: string;
  description?: string;
  capacite_max?: number;
  domaine_id: string;
  chef_id?: string;
}

export interface DepartementUpdate {
  nom?: string;
  description?: string;
  capacite_max?: number;
  chef_id?: string | null;
}

export interface ListeDepartements {
  departements: Departement[];
  total: number;
  page: number;
  par_page: number;
}

/** Liste tous les départements */
export const listerDepartements = (
  domaine_id?: string,
  type_departement?: string,
  page = 1,
  par_page = 20,
) => {
  const params = new URLSearchParams();
  if (domaine_id) params.append("domaine_id", domaine_id);
  if (type_departement) params.append("type_departement", type_departement);
  params.append("page", String(page));
  params.append("par_page", String(par_page));
  return clientAPI.get<ListeDepartements>(`${PREFIXE}?${params.toString()}`, { authentifie: true });
};

/** Obtient un département par son ID */
export const obtenirDepartement = (id: string) =>
  clientAPI.get<Departement>(`${PREFIXE}/${id}`, { authentifie: true });

/** Crée un nouveau département */
export const creerDepartement = (donnees: DepartementCreate) =>
  clientAPI.post<Departement>(PREFIXE, donnees, { authentifie: true });

/** Modifie un département */
export const modifierDepartement = (id: string, donnees: DepartementUpdate) =>
  clientAPI.patch<Departement>(`${PREFIXE}/${id}`, donnees, { authentifie: true });

/** Supprime un département */
export const supprimerDepartement = (id: string) =>
  clientAPI.delete<void>(`${PREFIXE}/${id}`, { authentifie: true });