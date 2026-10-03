/**
 * Service API du domaine logistique (référentiel — étape S1).
 */
import { clientAPI } from "@/services/client_api";

export interface ReponseListe<T> {
  elements: T[];
  total: number;
  page: number;
  par_page: number;
}

export interface Gare {
  id: string;
  nom: string;
  code: string;
  ville: string;
  domain_id: string | null;
  actif: boolean;
  cree_le: string;
}

export interface Ligne {
  id: string;
  gare_depart_id: string;
  gare_arrivee_id: string;
  distance_km: number | null;
  duree_min: number | null;
  actif: boolean;
  gare_depart_nom: string | null;
  gare_arrivee_nom: string | null;
  cree_le: string;
}

export interface Vehicule {
  id: string;
  immatriculation: string;
  marque: string | null;
  capacite: number | null;
  gare_id: string | null;
  gare_nom: string | null;
  actif: boolean;
  cree_le: string;
}

export interface Voyage {
  id: string;
  ligne_id: string;
  vehicule_id: string;
  chauffeur_id: string | null;
  date_depart: string;
  date_arrivee: string | null;
  statut: string;
  vehicule_immatriculation: string | null;
  chauffeur_nom: string | null;
  cree_le: string;
}

export interface Acteur {
  id: string;
  utilisateur_id: string;
  role: string;
  gare_id: string;
  numero_licence: string | null;
  actif: boolean;
  utilisateur_nom: string | null;
  gare_nom: string | null;
  cree_le: string;
}

const BASE = "/api/v1/logistique";
const opts = { authentifie: true } as const;

export const logistiqueAPI = {
  gares: {
    lister: () => clientAPI.get<ReponseListe<Gare>>(`${BASE}/gares?par_page=100`, opts),
    creer: (d: Record<string, unknown>) => clientAPI.post<Gare>(`${BASE}/gares`, d, opts),
    supprimer: (id: string) => clientAPI.delete(`${BASE}/gares/${id}`, opts),
  },
  lignes: {
    lister: () => clientAPI.get<ReponseListe<Ligne>>(`${BASE}/lignes?par_page=100`, opts),
    creer: (d: Record<string, unknown>) => clientAPI.post<Ligne>(`${BASE}/lignes`, d, opts),
    supprimer: (id: string) => clientAPI.delete(`${BASE}/lignes/${id}`, opts),
  },
  vehicules: {
    lister: () => clientAPI.get<ReponseListe<Vehicule>>(`${BASE}/vehicules?par_page=100`, opts),
    creer: (d: Record<string, unknown>) => clientAPI.post<Vehicule>(`${BASE}/vehicules`, d, opts),
    supprimer: (id: string) => clientAPI.delete(`${BASE}/vehicules/${id}`, opts),
  },
  voyages: {
    lister: () => clientAPI.get<ReponseListe<Voyage>>(`${BASE}/voyages?par_page=100`, opts),
    creer: (d: Record<string, unknown>) => clientAPI.post<Voyage>(`${BASE}/voyages`, d, opts),
    supprimer: (id: string) => clientAPI.delete(`${BASE}/voyages/${id}`, opts),
  },
  acteurs: {
    lister: () => clientAPI.get<ReponseListe<Acteur>>(`${BASE}/acteurs?par_page=100`, opts),
    creer: (d: Record<string, unknown>) => clientAPI.post<Acteur>(`${BASE}/acteurs`, d, opts),
    supprimer: (id: string) => clientAPI.delete(`${BASE}/acteurs/${id}`, opts),
  },
};
