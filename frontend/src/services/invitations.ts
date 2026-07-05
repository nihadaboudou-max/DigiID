/**
Service API pour la gestion des invitations (Admin & Super Admin).
*/
import { clientAPI } from "./client_api";

// ✅ CORRECTION : Pas de /api au début, clientAPI ajoute /api/backend
const PREFIXE = "/v1/invitations";

export interface Invitation {
  id: string;
  email: string;
  role: string;
  domaine_id: string | null;
  departement_id: string | null;
  statut: string;
  message: string | null;
  cree_par: string;
  date_creation: string;
  date_expiration: string;
  date_acceptation: string | null;
}

export interface InvitationCreate {
  email: string;
  role: string;
  domaine_id?: string;
  departement_id?: string;
  message?: string;
}

export interface ListeInvitations {
  invitations: Invitation[];
  total: number;
  page: number;
  par_page: number;
}

/** Liste toutes les invitations avec filtrage optionnel */
export const listerInvitations = (
  options?: {
    statut?: string;
    domaine_id?: string;
    page?: number;
    par_page?: number;
  }
) => {
  const params = new URLSearchParams();
  if (options?.statut) params.append("statut", options.statut);
  if (options?.domaine_id) params.append("domaine_id", options.domaine_id);
  params.append("page", String(options?.page || 1));
  params.append("par_page", String(options?.par_page || 20));
  
  return clientAPI.get<ListeInvitations>(
    `${PREFIXE}?${params.toString()}`,
    { authentifie: true }
  );
};

/** Crée une nouvelle invitation */
export const creerInvitation = (donnees: InvitationCreate) =>
  clientAPI.post<Invitation>(PREFIXE, donnees, { authentifie: true });

/** Annule une invitation */
export const annulerInvitation = (id: string) =>
  clientAPI.delete<void>(`${PREFIXE}/${id}`, { authentifie: true });

/** Renvoie une invitation */
export const renvoyerInvitation = (id: string) =>
  clientAPI.post<Invitation>(`${PREFIXE}/${id}/renvoyer`, undefined, { authentifie: true });