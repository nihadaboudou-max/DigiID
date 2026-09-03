import { clientAPI, obtenirTokenAcces } from "@/services/client_api";
import {
  ReponseUploadDocument,
  ListeVerifications,
  SyntheseVerification,
} from "@/types/inspection";

const PREFIXE = "/api/v1/inspection-documents";

/**
 * Uploader un document d'identité pour extraction OCR.
 * Utilisation de XMLHttpRequest pour gérer correctement le FormData avec le token.
 */
export async function uploadDocument(
  fichier: File,
  typeDocument?: string,
  face: "recto" | "verso" | "unique" = "recto",
  utilisateurCibleId?: string
): Promise<ReponseUploadDocument> {
  const formData = new FormData();
  formData.append("fichier", fichier);
  formData.append("face", face);
  
  if (typeDocument) {
    formData.append("type_document", typeDocument);
  }
  if (utilisateurCibleId) {
    formData.append("utilisateur_cible_id", utilisateurCibleId);
  }

  // Récupération du token via la fonction centralisée du projet
  const token = await obtenirTokenAcces();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const xhr = new XMLHttpRequest();

  return new Promise((resolve, reject) => {
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.detail || err.message || "Erreur lors de l'upload du document"));
        } catch {
          reject(new Error("Erreur lors de l'upload du document"));
        }
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Erreur réseau")));

    xhr.open("POST", `${PREFIXE}/upload`);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.send(formData);
  });
}

/**
 * Récupérer l'historique des documents scannés.
 */
export async function obtenirHistorique(limite: number = 10): Promise<ListeVerifications> {
  return clientAPI.get<ListeVerifications>(
    `${PREFIXE}/historique?limite=${limite}`,
    { authentifie: true }
  );
}

/**
 * Récupérer la synthèse des vérifications.
 */
export async function obtenirSynthese(): Promise<SyntheseVerification> {
  return clientAPI.get<SyntheseVerification>(
    `${PREFIXE}/synthese`,
    { authentifie: true }
  );
}

/**
 * Supprimer une vérification (soft-delete).
 */
export async function supprimerVerification(id: string): Promise<void> {
  await clientAPI.delete(`${PREFIXE}/${id}`, { authentifie: true });
}

/**
 * Restaurer une vérification depuis la corbeille.
 */
export async function restaurerVerification(id: string): Promise<void> {
  await clientAPI.post(`${PREFIXE}/${id}/restaurer`, {}, { authentifie: true });
}