/**
 * Service API pour la gestion des invitations (Super Admin).
 */
import { clientAPI } from "./client_api";

const PREFIXE = "/api/v1/invitations";

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

/** Liste toutes les invitations */
export const listerInvitations = (
  statut?: string,
  page = 1,
  par_page = 20,
) => {
  const params = new URLSearchParams();
  if (statut) params.append("statut", statut);
  params.append("page", String(page));
  params.append("par_page", String(par_page));
  return clientAPI.get<ListeInvitations>(`${PREFIXE}?${params.toString()}`, { authentifie: true });
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