/**
 * Service Vérification Visuelle — appels API pour la reconnaissance faciale.
 * Branché sur /api/v1/utilisateur/verification/*
 */
import { clientAPI } from "./client_api";

const PREFIXE = "/api/v1/utilisateur/verification";

// ---- Types ----

export type StatutVerification = "en_attente" | "approuve" | "rejete";

export interface VerificationDetail {
  id: string;
  statut: StatutVerification;
  raison?: string | null;
  score_liveness: number;
  score_similarite?: number | null;
  date_upload: string;
  date_verification?: string | null;
  est_supprime?: boolean;
  date_suppression?: string | null;
  details?: Record<string, unknown> | null;
}

export interface ListeVerifications {
  historique: VerificationDetail[];
  total: number;
}

// ---- Appels API ----

/**
 * Uploader une photo pour vérification visuelle du visage.
 */
export async function uploaderPhoto(
  fichier: File,
  onProgress?: (pct: number) => void,
): Promise<VerificationDetail> {
  const formData = new FormData();
  formData.append("fichier", fichier);

  // Utilisation de fetch directement pour l'upload multipart
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
          reject(new Error(err.message || "Erreur lors de l'upload"));
        } catch {
          reject(new Error("Erreur lors de l'upload de la photo"));
        }
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Erreur réseau lors de l'upload"));
    });

    xhr.open("POST", `/api/backend${PREFIXE}`);
    // Ne pas set Content-Type — le navigateur le fait automatiquement avec FormData
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.send(formData);
  });
}

/**
 * Récupérer le statut de la dernière vérification visuelle.
 */
export async function obtenirStatutVerification(): Promise<VerificationDetail> {
  return clientAPI.get<VerificationDetail>(`${PREFIXE}/statut`, {
    authentifie: true,
  });
}

/**
 * Lister l'historique des vérifications visuelles.
 */
export async function obtenirHistoriqueVerification(
  limite: number = 10,
): Promise<ListeVerifications> {
  return clientAPI.get<ListeVerifications>(
    `${PREFIXE}/historique?limite=${limite}`,
    { authentifie: true },
  );
}

/**
 * Supprimer une vérification (déplacer dans la corbeille).
 */
export async function supprimerPhoto(
  verificationId: string,
): Promise<{ id: string; message: string }> {
  return clientAPI.delete<{ id: string; message: string }>(
    `${PREFIXE}/${verificationId}`,
    { authentifie: true },
  );
}

/**
 * Restaurer une vérification depuis la corbeille.
 */
export async function restaurerPhoto(
  verificationId: string,
): Promise<{ id: string; message: string }> {
  return clientAPI.patch<{ id: string; message: string }>(
    `${PREFIXE}/${verificationId}/restaurer`,
    undefined,
    { authentifie: true },
  );
}
