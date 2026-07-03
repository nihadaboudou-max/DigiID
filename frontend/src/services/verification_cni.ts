/**
 * Service API pour le module OCR CNI (Carte Nationale d'Identité).
 *
 * Permet d'uploader des photos de CNI, d'obtenir les résultats OCR
 * et de gérer l'historique des vérifications.
 */
import { clientAPI, obtenirTokenAcces, ErreurAPI } from "./client_api";

export interface DonneesCNIExtraites {
  nom_famille: string | null;
  prenoms: string | null;
  sexe: string | null;
  date_naissance: string | null;
  lieu_naissance: string | null;
  numero_cni: string | null;
  date_delivrance: string | null;
  date_expiration: string | null;
  autorite_delivrance: string | null;
  taille: string | null;
  mrz_ligne_1: string | null;
  mrz_ligne_2: string | null;
  mrz_ligne_3: string | null;
  format_carte: string | null;
  taux_confiance_moyen: number | null;
  texte_brut?: string | null;
}

export interface ResultatOCRCNI {
  succes: boolean;
  donnees: DonneesCNIExtraites;
  erreurs: string[];
  champs_extraits: number;
  temps_analyse_ms: number | null;
}

export interface ValidationCNIResultat {
  est_valide: boolean;
  scores_validation: Record<string, boolean>;
  verification_mrz: boolean | null;
  message: string;
}

export interface ReponseUploadCNI {
  id: string;
  face: "recto" | "verso";
  statut: "en_attente" | "approuve" | "rejete";
  resultat_ocr: ResultatOCRCNI;
  message: string;
}

export interface SyntheseVerificationCNI {
  id_recto: string | null;
  id_verso: string | null;
  statut: "en_attente" | "approuve" | "rejete";
  donnees_recto: DonneesCNIExtraites | null;
  donnees_verso: DonneesCNIExtraites | null;
  validation_globale: ValidationCNIResultat | null;
  message: string;
  champs_verifies: number;
  champs_total: number;
}

export interface VerificationCNIDetail {
  id: string;
  utilisateur_id: string;
  statut: "en_attente" | "approuve" | "rejete";
  face: "recto" | "verso";
  nom_fichier: string;
  type_mime: string;
  taille_octets: number;
  nom_famille: string | null;
  prenoms: string | null;
  sexe: string | null;
  date_naissance: string | null;
  lieu_naissance: string | null;
  numero_cni: string | null;
  date_delivrance: string | null;
  date_expiration: string | null;
  autorite_delivrance: string | null;
  taille: string | null;
  mrz_ligne_1: string | null;
  mrz_ligne_2: string | null;
  mrz_ligne_3: string | null;
  format_carte: string | null;
  taux_confiance_ocr: number | null;
  validation_mrz: boolean | null;
  est_valide: boolean | null;
  scores_validation: Record<string, boolean> | null;
  erreurs_ocr: string[] | null;
  date_traitement: string | null;
  cree_le: string;
  est_supprime: boolean;
  date_suppression?: string | null;
}

export interface ListeVerificationsCNI {
  historique: VerificationCNIDetail[];
  total: number;
}

// ✅ FIX : Toujours utiliser le proxy Next.js pour éviter les erreurs CORS
// Le proxy redirige /api/backend/* vers le backend réel via next.config.js
const URL_BASE = "/api/backend";

/**
 * Upload une photo de CNI (recto ou verso) pour analyse OCR.
 * Utilise fetch directement car le clientAPI ne gère pas le multipart/form-data.
 */
export async function uploaderCNI(
  fichier: File,
  face: "recto" | "verso" = "recto"
): Promise<ReponseUploadCNI> {
  const formData = new FormData();
  formData.append("fichier", fichier);
  formData.append("face", face);

  const token = obtenirTokenAcces();

  // ✅ FIX : Toujours passer par le proxy Next.js (dev ET production)
  // Cela évite les erreurs CORS et les problèmes ECONNRESET entre services Render
  const urlUpload = `${URL_BASE}/api/v1/utilisateur/verification-cni/upload`;

  let reponse: Response;
  try {
    reponse = await fetch(urlUpload, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });
  } catch (erreur: unknown) {
    // Erreur réseau : backend injoignable (crash, timeout, DNS...)
    const message = erreur instanceof TypeError
      ? "Le serveur backend est inaccessible. Vérifie qu'il est bien lancé sur Render."
      : (erreur as Error)?.message || "Erreur réseau lors de l'upload";
    throw new ErreurAPI("RESEAU", message, 0);
  }

  if (!reponse.ok) {
    let erreur: any = {};
    try { erreur = await reponse.json(); } catch {}
    throw new ErreurAPI(
      erreur.code_erreur || "UPLOAD_CNI",
      erreur.message || "Erreur lors de l'upload de la CNI",
      reponse.status,
    );
  }

  return reponse.json();
}

/**
 * Récupère la synthèse de la dernière vérification complète (recto + verso).
 */
export async function obtenirSynthese(): Promise<SyntheseVerificationCNI> {
  return clientAPI.get<SyntheseVerificationCNI>(
    "/api/v1/utilisateur/verification-cni/synthese",
    { authentifie: true }
  );
}

/**
 * Liste l'historique des vérifications CNI de l'utilisateur.
 * ✅ CORRECTION : Ajout de /historique dans l'URL (endpoint backend)
 */
export async function listerVerifications(
  limite: number = 20
): Promise<ListeVerificationsCNI> {
  return clientAPI.get<ListeVerificationsCNI>(
    `/api/v1/utilisateur/verification-cni/historique?limite=${limite}`,
    { authentifie: true }
  );
}

/**
 * Supprime une vérification CNI (corbeille).
 */
export async function supprimerVerification(
  id: string
): Promise<{ id: string; message: string }> {
  return clientAPI.delete<{ id: string; message: string }>(
    `/api/v1/utilisateur/verification-cni/${id}`,
    { authentifie: true }
  );
}

/**
 * Restaure une vérification CNI depuis la corbeille.
 * ✅ CORRECTION : Utilisation de POST au lieu de PATCH (endpoint backend)
 */
export async function restaurerVerification(
  id: string
): Promise<{ id: string; message: string }> {
  return clientAPI.post<{ id: string; message: string }>(
    `/api/v1/utilisateur/verification-cni/${id}/restaurer`,
    undefined,
    { authentifie: true }
  );
}

/**
 * Formate une date OCR (JJ/MM/AAAA) en format lisible.
 */
export function formaterDateCNI(date: string | null): string {
  if (!date) return "Non détectée";
  // Vérifier le format JJ/MM/AAAA
  const match = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    const [, jour, mois, annee] = match;
    const moisNoms = [
      "janvier", "février", "mars", "avril", "mai", "juin",
      "juillet", "août", "septembre", "octobre", "novembre", "décembre",
    ];
    const moisIndex = parseInt(mois, 10) - 1;
    return `${parseInt(jour, 10)} ${moisNoms[moisIndex] || mois} ${annee}`;
  }
  return date;
}

/**
 * Retourne la classe CSS pour le statut.
 */
export function classeStatutCNI(
  statut: "en_attente" | "approuve" | "rejete"
): string {
  switch (statut) {
    case "approuve":
      return "text-green-600 bg-green-50 border-green-200";
    case "rejete":
      return "text-red-600 bg-red-50 border-red-200";
    case "en_attente":
    default:
      return "text-amber-600 bg-amber-50 border-amber-200";
  }
}

/**
 * Icône pour le statut.
 */
export function iconeStatutCNI(statut: string): string {
  switch (statut) {
    case "approuve":
      return "✅";
    case "rejete":
      return "❌";
    case "en_attente":
      return "⏳";
    default:
      return "❓";
  }
}