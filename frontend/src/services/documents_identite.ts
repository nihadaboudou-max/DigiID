/**
 * Service API — Documents d'Identité (CNI + Permis + Assurance).
 *
 * L'utilisateur peut :
 *   - Ajouter ses documents (CNI, Permis, Assurance)
 *   - Corriger/modifier chaque champ si mal extrait
 *   - Supprimer un document
 *
 * Chaque modification déclenche un recalcul du score.
 */
import { clientAPI } from "./client_api";

const PREFIXE = "/api/v1/utilisateur/documents-identite";

// =============================================================================
// Types
// =============================================================================

export interface DocumentIdentiteDetail {
  id: string;
  utilisateur_id: string;
  type_document: "cni" | "permis" | "assurance";
  est_actif: boolean;
  source: "manuel" | "ocr" | null;
  a_ete_corrige: boolean;
  verification_id: string | null;

  // Communs
  numero_document: string | null;
  nom_complet: string | null;
  date_naissance: string | null;
  lieu_naissance: string | null;
  nationalite: string | null;
  sexe: string | null;
  adresse: string | null;
  date_delivrance: string | null;
  date_expiration: string | null;
  pays_emetteur: string | null;

  // CNI
  autorite_delivrance: string | null;
  profession: string | null;
  taille_cm: number | null;

  // Permis
  categories_permis: string | null;
  centre_examen: string | null;
  numero_permis: string | null;

  // Assurance
  compagnie_assurance: string | null;
  type_couverture: string | null;
  numero_contrat: string | null;
  immatriculation_vehicule: string | null;
  marque_vehicule: string | null;
  modele_vehicule: string | null;
  annee_vehicule: number | null;

  // Métadonnées
  cree_le: string;
  modifie_le: string;
}

export interface ListeDocumentsIdentite {
  documents: DocumentIdentiteDetail[];
  total: number;
}

export interface DocumentIdentitePayload {
  type_document: "cni" | "permis" | "assurance";
  source?: "manuel" | "ocr";
  numero_document?: string | null;
  nom_complet?: string | null;
  date_naissance?: string | null;
  lieu_naissance?: string | null;
  nationalite?: string | null;
  sexe?: string | null;
  adresse?: string | null;
  date_delivrance?: string | null;
  date_expiration?: string | null;
  pays_emetteur?: string | null;

  // CNI
  autorite_delivrance?: string | null;
  profession?: string | null;
  taille_cm?: number | null;

  // Permis
  categories_permis?: string | null;
  centre_examen?: string | null;
  numero_permis?: string | null;

  // Assurance
  compagnie_assurance?: string | null;
  type_couverture?: string | null;
  numero_contrat?: string | null;
  immatriculation_vehicule?: string | null;
  marque_vehicule?: string | null;
  modele_vehicule?: string | null;
  annee_vehicule?: number | null;
}

// =============================================================================
// API
// =============================================================================

/**
 * Liste tous les documents d'identité de l'utilisateur.
 */
export async function listerDocumentsIdentite(
  typeDocument?: "cni" | "permis" | "assurance"
): Promise<ListeDocumentsIdentite> {
  const params = typeDocument ? `?type_document=${typeDocument}` : "";
  return clientAPI.get<ListeDocumentsIdentite>(`${PREFIXE}${params}`, {
    authentifie: true,
  });
}

/**
 * Ajoute un nouveau document d'identité (CNI, Permis ou Assurance).
 */
export async function ajouterDocumentIdentite(
  payload: DocumentIdentitePayload
): Promise<DocumentIdentiteDetail> {
  return clientAPI.post<DocumentIdentiteDetail>(PREFIXE, payload, {
    authentifie: true,
  });
}

/**
 * Récupère un document par son ID.
 */
export async function obtenirDocumentIdentite(
  id: string
): Promise<DocumentIdentiteDetail> {
  return clientAPI.get<DocumentIdentiteDetail>(`${PREFIXE}/${id}`, {
    authentifie: true,
  });
}

/**
 * Modifie un document existant (correction des champs).
 * Seuls les champs fournis sont mis à jour.
 */
export async function modifierDocumentIdentite(
  id: string,
  payload: Partial<DocumentIdentitePayload>
): Promise<DocumentIdentiteDetail> {
  return clientAPI.patch<DocumentIdentiteDetail>(`${PREFIXE}/${id}`, payload, {
    authentifie: true,
  });
}

/**
 * Supprime (soft-delete) un document d'identité.
 */
export async function supprimerDocumentIdentite(
  id: string
): Promise<void> {
  return clientAPI.delete(`${PREFIXE}/${id}`, { authentifie: true });
}

// =============================================================================
// Utilitaires
// =============================================================================

export const LIBELLES_TYPE_DOCUMENT: Record<string, string> = {
  cni: "Carte Nationale d'Identité",
  permis: "Permis de Conduire",
  assurance: "Attestation d'Assurance",
};

export const ICONES_TYPE_DOCUMENT: Record<string, string> = {
  cni: "🆔",
  permis: "🚗",
  assurance: "🛡️",
};

export const COULEURS_TYPE_DOCUMENT: Record<string, string> = {
  cni: "bg-blue-100 text-blue-700 border-blue-200",
  permis: "bg-amber-100 text-amber-700 border-amber-200",
  assurance: "bg-green-100 text-green-700 border-green-200",
};

export const COULEURS_BORDURE: Record<string, string> = {
  cni: "border-l-blue-500",
  permis: "border-l-amber-500",
  assurance: "border-l-green-500",
};

/**
 * Retourne les champs pertinents pour un type de document donné.
 */
export function champsParType(type: string): { key: string; libelle: string; type_champ: string }[] {
  const communs = [
    { key: "numero_document", libelle: "Numéro du document", type_champ: "text" },
    { key: "nom_complet", libelle: "Nom complet", type_champ: "text" },
    { key: "date_naissance", libelle: "Date de naissance", type_champ: "date" },
    { key: "lieu_naissance", libelle: "Lieu de naissance", type_champ: "text" },
    { key: "nationalite", libelle: "Nationalité", type_champ: "text" },
    { key: "sexe", libelle: "Sexe", type_champ: "select" },
    { key: "adresse", libelle: "Adresse", type_champ: "text" },
    { key: "date_delivrance", libelle: "Date de délivrance", type_champ: "date" },
    { key: "date_expiration", libelle: "Date d'expiration", type_champ: "date" },
    { key: "pays_emetteur", libelle: "Pays émetteur", type_champ: "text" },
  ];

  const specifiques: Record<string, { key: string; libelle: string; type_champ: string }[]> = {
    cni: [
      { key: "autorite_delivrance", libelle: "Autorité de délivrance", type_champ: "text" },
      { key: "profession", libelle: "Profession", type_champ: "text" },
      { key: "taille_cm", libelle: "Taille (cm)", type_champ: "number" },
    ],
    permis: [
      { key: "numero_permis", libelle: "Numéro de permis", type_champ: "text" },
      { key: "categories_permis", libelle: "Catégories (A, B, C...)", type_champ: "text" },
      { key: "centre_examen", libelle: "Centre d'examen", type_champ: "text" },
    ],
    assurance: [
      { key: "compagnie_assurance", libelle: "Compagnie d'assurance", type_champ: "text" },
      { key: "type_couverture", libelle: "Type de couverture", type_champ: "select" },
      { key: "numero_contrat", libelle: "Numéro de contrat", type_champ: "text" },
      { key: "immatriculation_vehicule", libelle: "Immatriculation", type_champ: "text" },
      { key: "marque_vehicule", libelle: "Marque du véhicule", type_champ: "text" },
      { key: "modele_vehicule", libelle: "Modèle du véhicule", type_champ: "text" },
      { key: "annee_vehicule", libelle: "Année", type_champ: "number" },
    ],
  };

  return [...communs, ...(specifiques[type] || [])];
}

export const OPTIONS_COUVERTURE = [
  { value: "responsabilite_civile", label: "Responsabilité Civile" },
  { value: "tiers", label: "Tiers" },
  { value: "tous_risques", label: "Tous Risques" },
  { value: "vol_incendie", label: "Vol et Incendie" },
];

export const OPTIONS_SEXE = [
  { value: "M", label: "Masculin" },
  { value: "F", label: "Féminin" },
];
