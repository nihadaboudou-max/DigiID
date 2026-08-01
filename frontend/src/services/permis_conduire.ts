import { clientAPI } from "./client_api";

const PREFIXE = "/api/v1/utilisateur/permis";

export interface DonneesPermis {
  nom_famille?: string;
  prenoms?: string;
  numero_permis?: string;
  categories?: string[];
  date_delivrance?: string;
  date_expiration?: string;
  autorite_delivrance?: string;
}

export interface ResultatOCRPermis {
  succes: boolean;
  donnees: DonneesPermis;
  erreurs: string[];
  champs_extraits: number;
}

export interface ReponseUploadPermis {
  id: string;
  statut: string;
  resultat_ocr: ResultatOCRPermis;
  message: string;
}

export interface VerificationPermisDetail {
  id: string;
  statut: string;
  numero_permis?: string;
  date_expiration?: string;
  cree_le: string;
}

export interface ListeVerificationsPermis {
  historique: VerificationPermisDetail[];
  total: number;
}

/**
 * Uploader un permis de conduire pour extraction OCR.
 */
export async function uploaderPermis(fichier: File): Promise<ReponseUploadPermis> {
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
          reject(new Error(err.message || "Erreur lors de l'upload du permis"));
        } catch {
          reject(new Error("Erreur lors de l'upload du permis"));
        }
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Erreur réseau")));

    // ✅ CORRECTION : Ajout de /upload à la fin
    xhr.open("POST", `${PREFIXE}/upload`);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.send(formData);
  });
}

/**
 * Récupérer l'historique des permis scannés.
 */
export async function obtenirHistoriquePermis(limite: number = 10): Promise<ListeVerificationsPermis> {
  return clientAPI.get<ListeVerificationsPermis>(
    `${PREFIXE}/historique?limite=${limite}`,
    { authentifie: true }
  );
}