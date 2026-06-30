/**
 * Service API pour la gestion des équipes (Super Admin).
 */
import { clientAPI } from "./client_api";

const PREFIXE = "/api/v1/equipes";

export interface Equipe {
  id: string;
  nom: string;
  description: string | null;
  departement_id: string;
  chef_id: string | null;
  est_actif: boolean;
  date_creation: string;
  date_modification: string | null;
}

export interface EquipeCreate {
  nom: string;
  description?: string;
  departement_id: string;
  chef_id?: string;
}

export interface EquipeUpdate {
  nom?: string;
  description?: string;
  chef_id?: string | null;
  est_actif?: boolean;
}

export interface ListeEquipes {
  equipes: Equipe[];
  total: number;
  page: number;
  par_page: number;
}

/** Liste toutes les équipes */
export const listerEquipes = (
  departement_id?: string,
  est_actif?: boolean,
  page = 1,
  par_page = 20,
) => {
  const params = new URLSearchParams();
  if (departement_id) params.append("departement_id", departement_id);
  if (est_actif !== undefined) params.append("est_actif", String(est_actif));
  params.append("page", String(page));
  params.append("par_page", String(par_page));
  return clientAPI.get<ListeEquipes>(`${PREFIXE}?${params.toString()}`, { authentifie: true });
};

/** Obtient une équipe par son ID */
export const obtenirEquipe = (id: string) =>
  clientAPI.get<Equipe>(`${PREFIXE}/${id}`, { authentifie: true });

/** Crée une nouvelle équipe */
export const creerEquipe = (donnees: EquipeCreate) =>
  clientAPI.post<Equipe>(PREFIXE, donnees, { authentifie: true });

/** Modifie une équipe */
export const modifierEquipe = (id: string, donnees: EquipeUpdate) =>
  clientAPI.patch<Equipe>(`${PREFIXE}/${id}`, donnees, { authentifie: true });

/** Supprime une équipe */
export const supprimerEquipe = (id: string) =>
  clientAPI.delete<void>(`${PREFIXE}/${id}`, { authentifie: true });

/** Ajoute un membre à une équipe */
export const ajouterMembre = (equipe_id: string, utilisateur_id: string) =>
  clientAPI.post<{ message: string }>(`${PREFIXE}/${equipe_id}/membres`, { utilisateur_id }, { authentifie: true });

/** Retire un membre d'une équipe */
export const retirerMembre = (equipe_id: string, utilisateur_id: string) =>
  clientAPI.delete<void>(`${PREFIXE}/${equipe_id}/membres/${utilisateur_id}`, { authentifie: true });