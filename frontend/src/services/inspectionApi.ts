// Service API pour le module d'inspection de documents
import {
  ReponseUploadDocument,
  ListeVerifications,
  SyntheseVerification,
  TypeDocument,
} from "@/types/inspection";

const API_BASE_URL = process.env.NEXT_PUBLIC_URL_BACKEND || "http://localhost:8000";

// Helper pour gérer les erreurs API
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Erreur inconnue" }));
    throw new Error(error.detail || `Erreur HTTP ${response.status}`);
  }
  return response.json();
}

// Helper pour obtenir le token JWT
function getAuthToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("token");
  }
  return null;
}

// Headers communs
function getHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

/**
 * Upload un document d'identité
 */
export async function uploadDocument(
  fichier: File,
  typeDocument?: TypeDocument,
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

  const response = await fetch(`${API_BASE_URL}/api/v1/inspection-documents/upload`, {
    method: "POST",
    headers: getHeaders(),
    body: formData,
  });

  return handleResponse<ReponseUploadDocument>(response);
}

/**
 * Obtient la synthèse des vérifications
 */
export async function obtenirSynthese(): Promise<SyntheseVerification> {
  const response = await fetch(`${API_BASE_URL}/api/v1/inspection-documents/synthese`, {
    method: "GET",
    headers: getHeaders(),
  });

  return handleResponse<SyntheseVerification>(response);
}

/**
 * Obtient l'historique des vérifications
 */
export async function obtenirHistorique(limite: number = 20): Promise<ListeVerifications> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/inspection-documents/historique?limite=${limite}`,
    {
      method: "GET",
      headers: getHeaders(),
    }
  );

  return handleResponse<ListeVerifications>(response);
}

/**
 * Supprime une vérification (soft-delete)
 */
export async function supprimerVerification(verificationId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/inspection-documents/${verificationId}`,
    {
      method: "DELETE",
      headers: getHeaders(),
    }
  );

  await handleResponse(response);
}

/**
 * Restaure une vérification
 */
export async function restaurerVerification(verificationId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/inspection-documents/${verificationId}/restaurer`,
    {
      method: "POST",
      headers: getHeaders(),
    }
  );

  await handleResponse(response);
}