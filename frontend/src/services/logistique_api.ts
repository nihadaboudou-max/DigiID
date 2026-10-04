/**
 * Service API du domaine logistique.
 *  - S1 : référentiel (gares, lignes, véhicules, voyages, acteurs)
 *  - S2/S3 : colis de bout en bout (enregistrement, lecture, timeline, scan)
 */
import { clientAPI } from "@/services/client_api";
import type {
  Colis, ColisEnregistre, ColisEvenement, DonneesColis, DonneesScan, ResultatScan,
} from "@/types/logistique";

export type {
  Colis, ColisEnregistre, ColisEvenement, DonneesColis, DonneesScan, ResultatScan,
} from "@/types/logistique";

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

  // ─── Colis (guichet receveur) ───────────────────────────────────────
  colis: {
    /** Enregistre un colis : génère le ticket (QR + numéro en clair). */
    creer: (d: DonneesColis) =>
      clientAPI.post<ColisEnregistre>(`${BASE}/colis`, d, opts),

    /** Liste paginée des colis, avec filtres (statut, gare, voyage). */
    lister: (filtres?: {
      statut?: string;
      gare_id?: string;
      voyage_id?: string;
      page?: number;
      par_page?: number;
    }) => {
      const qs = new URLSearchParams();
      qs.set("par_page", String(filtres?.par_page ?? 100));
      qs.set("page", String(filtres?.page ?? 1));
      if (filtres?.statut) qs.set("statut", filtres.statut);
      if (filtres?.gare_id) qs.set("gare_id", filtres.gare_id);
      if (filtres?.voyage_id) qs.set("voyage_id", filtres.voyage_id);
      return clientAPI.get<ReponseListe<Colis>>(`${BASE}/colis?${qs.toString()}`, opts);
    },

    /** Retrouve un colis par code clair (ou token QR). */
    parCode: (code: string) =>
      clientAPI.get<Colis>(`${BASE}/colis/${encodeURIComponent(code)}`, opts),

    /** Timeline (événements) d'un colis. */
    evenements: (colisId: string) =>
      clientAPI.get<ColisEvenement[]>(`${BASE}/colis/${colisId}/evenements`, opts),
  },

  // ─── Scans (départ / transit / arrivée / livraison) ────────────────
  scans: {
    scanner: (d: DonneesScan) =>
      clientAPI.post<ResultatScan>(`${BASE}/scans`, d, opts),
  },
};

/**
 * Retrouve la gare de rattachement d'un agent logistique (acteur).
 *
 * Utilisé par le guichet pour pré-remplir la gare de départ (receveur)
 * et le contexte de scan (chauffeur/receveur). Renvoie `null` si l'agent
 * n'a pas encore de fiche acteur (le formulaire reste alors manuel).
 */
export async function gareDeLActeur(
  utilisateurId: string,
): Promise<Gare | null> {
  try {
    const [acteurs, gares] = await Promise.all([
      logistiqueAPI.acteurs.lister(),
      logistiqueAPI.gares.lister(),
    ]);
    const acteur = acteurs.elements.find((a) => a.utilisateur_id === utilisateurId);
    if (!acteur) return null;
    return gares.elements.find((g) => g.id === acteur.gare_id) ?? null;
  } catch {
    // Un agent sans permission de lecture du référentiel ne doit pas bloquer le guichet.
    return null;
  }
}
