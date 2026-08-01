import { clientAPI } from "./client_api";

const PREFIXE = "/api/v1/utilisateur/assurance";

export interface DonneesAssurance {
  compagnie_assurance?: string;
  numero_contrat?: string;
  immatriculation_vehicule?: string;
  marque_vehicule?: string;
  modele_vehicule?: string;
  date_effet?: string;
  date_expiration?: string;
}

export interface ResultatOCRAssurance {
  succes: boolean;
  donnees: DonneesAssurance;
  erreurs: string[];
  champs_extraits: number;
}

export interface ReponseUploadAssurance {
  id: string;
  statut: string;
  resultat_ocr: ResultatOCRAssurance;
  message: string;
}

export async function uploaderAssurance(
  fichier: File,
): Promise<ReponseUploadAssurance> {
  const formData = new FormData();
  formData.append("fichier", fichier);

  const token = (await import("@/services/client_api")).obtenirTokenAcces();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const xhr = new XMLHttpRequest();

  return new Promise((resolve, reject) => {
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.message || "Erreur lors de l'upload"));
        } catch {
          reject(new Error("Erreur lors de l'upload de l'assurance"));
        }
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Erreur réseau")));

    xhr.open("POST", PREFIXE);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.send(formData);
  });
}