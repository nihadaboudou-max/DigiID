/**
 * Service documents — upload et gestion des documents pour le chatbot RAG.
 * Branché sur /api/v1/utilisateur/documents/*
 */
import { clientAPI, obtenirTokenAcces, ErreurAPI } from "./client_api";

const PREFIXE = "/api/v1/utilisateur/documents";
const URL_BASE =
  process.env.NEXT_PUBLIC_URL_BACKEND ||
  process.env.URL_BACKEND ||
  "http://localhost:8000";

export interface DocumentDetail {
  id: string;
  nom_fichier: string;
  type_mime: string;
  taille_octets: number;
  resume: string | null;
  cree_le: string;
}

export interface ListeDocuments {
  documents: DocumentDetail[];
  total: number;
  taille_totale_octets: number;
}

/**
 * Upload un fichier via multipart/form-data.
 * Le client API standard ne gère pas le multipart, on fait un fetch manuel.
 */
export async function uploaderDocument(fichier: File): Promise<DocumentDetail> {
  const formData = new FormData();
  formData.append("fichier", fichier);

  const token = obtenirTokenAcces();
  const reponse = await fetch(`${URL_BASE}${PREFIXE}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  if (!reponse.ok) {
    let erreur: any = {};
    try { erreur = await reponse.json(); } catch {}
    throw new ErreurAPI(
      erreur.code_erreur || "UPLOAD",
      erreur.message || "Erreur d'upload",
      reponse.status,
    );
  }

  return reponse.json();
}

export const listerDocuments = () =>
  clientAPI.get<ListeDocuments>(PREFIXE, { authentifie: true });

export const supprimerDocument = (id: string) =>
  clientAPI.delete<void>(`${PREFIXE}/${id}`, { authentifie: true });
