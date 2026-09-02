// frontend/src/services/inspectionApi.ts
import {
  ReponseUploadDocument,
  ListeVerifications,
  SyntheseVerification,
} from "@/types/inspection";

const API_BASE_URL = process.env.NEXT_PUBLIC_URL_BACKEND || "http://localhost:8000";

// Helper pour obtenir le token JWT (essaie les clés les plus courantes)
function getAuthToken(): string | null {
  if (typeof window !== "undefined") {
    return (
      localStorage.getItem("token") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("auth_token") ||
      localStorage.getItem("jwt")
    );
  }
  return null;
}

// Headers communs
function getHeaders(isFormData: boolean = false): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = {};
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  // ⚠️ IMPORTANT : Ne JAMAIS définir manuellement "Content-Type" pour un FormData.
  // Le navigateur doit le faire lui-même pour inclure la "boundary" correcte.
  
  return headers;
}

/**
 * Upload un document d'identité
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

  const response = await fetch(`${API_BASE_URL}/api/v1/inspection-documents/upload`, {
    method: "POST",
    headers: getHeaders(true),
    body: formData,
    credentials: "include", // Indispensable si l'auth utilise des cookies HttpOnly
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Erreur inconnue" }));
    throw new Error(error.detail || `Erreur HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Obtient la synthèse des vérifications
 */
export async function obtenirSynthese(): Promise<SyntheseVerification> {
  const response = await fetch(`${API_BASE_URL}/api/v1/inspection-documents/synthese`, {
    method: "GET",
    headers: getHeaders(),
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Erreur inconnue" }));
    throw new Error(error.detail || `Erreur HTTP ${response.status}`);
  }

  return response.json();
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
      credentials: "include",
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Erreur inconnue" }));
    throw new Error(error.detail || `Erreur HTTP ${response.status}`);
  }

  return response.json();
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
      credentials: "include",
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Erreur inconnue" }));
    throw new Error(error.detail || `Erreur HTTP ${response.status}`);
  }
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
      credentials: "include",
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Erreur inconnue" }));
    throw new Error(error.detail || `Erreur HTTP ${response.status}`);
  }
}