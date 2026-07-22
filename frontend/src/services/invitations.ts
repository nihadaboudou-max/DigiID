/**
 * Service API pour la gestion des invitations (Admin & Super Admin).
 */
import { clientAPI } from "./client_api";

// ✅ CORRECTION 1 : Utiliser le chemin complet /api/v1/invitations 
// pour correspondre exactement au prefix du routeur FastAPI.
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
// ✅ CORRECTION 2 : Remplacer 'undefined' par '{}' pour éviter les erreurs 
// de parsing JSON (422 Unprocessable Entity) côté backend FastAPI.
export const renvoyerInvitation = (id: string) =>
  clientAPI.post<Invitation>(`${PREFIXE}/${id}/renvoyer`, {}, { authentifie: true });