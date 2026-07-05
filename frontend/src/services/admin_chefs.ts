/**
Service API pour la gestion des chefs de département (Admin).
*/
import { clientAPI } from "./client_api";

export interface ChefApercu {
  id: string;
  prenom_initiale: string | null;
  nom_initiale: string | null;
  email_masque: string;
  ville: string | null;
  role: string;
  departement_nom: string | null;
  departement_id: string | null;
  est_verrouille: boolean;
  date_inscription: string | null;
}

export interface ChefDetail {
  id: string;
  email: string;
  prenom: string | null;
  nom: string | null;
  telephone: string | null;
  ville: string | null;
  role: string;
  est_actif: boolean;
  est_verrouille: boolean;
  est_supprime: boolean;
  domaine_id: string | null;
  departement_id: string | null;
  departement_nom: string | null;
  date_creation: string;
  date_derniere_connexion: string | null;
  motif_suspension: string | null;
}

/**
 * Liste les chefs d'un domaine
 */
export const listerChefs = (domaine_id: string) =>
  clientAPI.get<ChefApercu[]>(
    `/api/v1/admin/chefs?domaine_id=${domaine_id}&role=chef`,
    { authentifie: true }
  );

/**
 * Obtient les détails d'un chef
 */
export const obtenirChefDetail = (id: string) =>
  clientAPI.get<ChefDetail>(`/api/v1/admin/chefs/${id}/detail`, {
    authentifie: true,
  });

/**
 * Suspend un chef
 */
export const suspendreChef = (id: string, motif: string) =>
  clientAPI.patch<ChefDetail>(
    `/api/v1/admin/chefs/${id}/suspendre`,
    { motif },
    { authentifie: true }
  );

/**
 * Réactive un chef
 */
export const reactiverChef = (id: string) =>
  clientAPI.patch<ChefDetail>(
    `/api/v1/admin/chefs/${id}/reactiver`,
    undefined,
    { authentifie: true }
  );
  