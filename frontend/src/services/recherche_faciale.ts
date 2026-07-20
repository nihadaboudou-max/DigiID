/**
 * Service Recherche Faciale — pour les agents médicaux
 * Inspiré du service verification_visuelle.ts
 * Endpoint: /api/v1/medical/recherche-faciale
 */
import { clientAPI } from "./client_api";

const PREFIXE = "/api/v1/medical/recherche-faciale";

// ---- Types ----
export interface PersonneRecherchee {
  id: string;
  nom: string;
  prenom: string | null;
  date_naissance: string | null;
  groupe_sanguin: string | null;
  telephone: string | null;
  contact_urgence: string | null;
  photo: string | null;
  antecedents: string[];
  allergies: string[];
  digiid?: string;
}

export interface ResultatRecherche {
  trouve: boolean;
  personne: PersonneRecherchee | null;
  score_confiance: number;
  temps_analyse_ms: number;
}

export interface HistoriqueRecherche {
  id: string;
  date_recherche: string;
  score_confiance: number;
  personne_trouvee_id: string | null;
}

export interface ListeRecherches {
  historique: HistoriqueRecherche[];
  total: number;
}

// ---- Appels API ----

/**
 * Rechercher une personne par photo (reconnaissance faciale)
 * Inspiré de uploaderPhoto() de verification_visuelle.ts
 */
export async function rechercherParPhoto(
  fichier: File,
  onProgress?: (pct: number) => void
): Promise<ResultatRecherche> {
  const formData = new FormData();
  formData.append("photo", fichier);

  const token = (await import("@/services/client_api")).obtenirTokenAcces();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const xhr = new XMLHttpRequest();
  return new Promise((resolve, reject) => {
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.message || "Erreur lors de la recherche"));
        } catch {
          reject(new Error("Erreur lors de la recherche faciale"));
        }
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Erreur réseau lors de la recherche"));
    });

    xhr.open("POST", `/api/backend${PREFIXE}`);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.send(formData);
  });
}

/**
 * Obtenir l'historique des recherches
 * Inspiré de obtenirHistoriqueVerification()
 */
export async function obtenirHistoriqueRecherches(
  limite: number = 10
): Promise<ListeRecherches> {
  return clientAPI.get<ListeRecherches>(`${PREFIXE}/historique?limite=${limite}`, {
    authentifie: true,
  });
}