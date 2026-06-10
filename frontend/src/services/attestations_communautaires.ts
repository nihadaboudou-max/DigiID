/**
 * Service Attestations Communautaires — Étape 4.
 * 
 * Permet aux utilisateurs de :
 *   - Créer des attestations de confiance envers d'autres membres
 *   - Approuver ou refuser les attestations reçues
 *   - Consulter leurs attestations (reçues, envoyées, en attente)
 *   - Voir les statistiques de leur réseau de confiance
 * 
 * API : /api/v1/utilisateur/attestations
 */
import { clientAPI } from "./client_api";

const PREFIXE = "/api/v1/utilisateur/attestations";

// ============================================================================
// Types — Schémas de données
// ============================================================================

/** Types d'attestation disponibles */
export type TypeAttestation =
  | "identite"       // Confirmation d'identité et de connaissance réelle
  | "competence"     // Certificat de compétence professionnelle
  | "moralite"       // Attestation de bonne moralité
  | "residence"      // Confirmation d'adresse de résidence
  | "activite"       // Confirmation d'activité/emploi
  | "personnalise";  // Attestation personnalisée

/** Statuts possibles d'une attestation */
export type StatutAttestation =
  | "EN_ATTENTE"     // En attente de décision par l'attesté
  | "APPROUVEE"      // Approuvée par l'attesté
  | "REFUSEE"        // Refusée par l'attesté
  | "EXPIREE";       // Expirée (1 an après approbation)

/** Nature du lien entre attestant et attesté */
export type LienNature =
  | "famille" | "ami" | "collegue" | "voisin"
  | "associatif" | "religieux" | "professionnel"
  | "academique" | "autre";

// ============================================================================
// Interfaces — Réponses API
// ============================================================================

/** Détail complet d'une attestation */
export interface AttestationDetail {
  id: string;
  attestant_id: string;
  attestant_nom: string;
  attestant_prenom: string;
  attestant_digiid: string;
  atteste_id: string;
  atteste_nom: string;
  atteste_prenom: string;
  atteste_digiid: string;
  type_attestation: TypeAttestation;
  titre: string;
  description: string | null;
  forces: string | null;
  lien_connu_depuis: string | null;
  lien_nature: string | null;
  statut: StatutAttestation;
  motif_refus: string | null;
  poids_score: number;
  est_visible_public: boolean;
  est_active: boolean;
  date_soumission: string;
  date_decision: string | null;
  date_expiration: string | null;
}

/** Version résumée pour les listes */
export interface AttestationResume {
  id: string;
  attestant_nom_complet: string;
  atteste_nom_complet: string;
  type_attestation: TypeAttestation;
  titre: string;
  statut: StatutAttestation;
  poids_score: number;
  est_active: boolean;
  date_soumission: string;
  date_decision: string | null;
  date_expiration: string | null;
}

/** Liste paginée d'attestations */
export interface ListeAttestations {
  attestations: AttestationResume[];
  total: number;
  page: number;
  limite: number;
  pages_totales: number;
}

/** Statistiques des attestations */
export interface StatistiquesAttestations {
  total_recues: number;
  total_envoyees: number;
  approuvees_recues: number;
  approuvees_envoyees: number;
  en_attente_recues: number;
  en_attente_envoyees: number;
  refusees_recues: number;
  expirees_recues: number;
  score_total_attestations: number;
  attestants_uniques: number;
}

/** Résultat de création d'une attestation */
export interface ResultatCreation {
  message: string;
  attestation: AttestationDetail;
}

/** Résultat d'une décision (approbation/refus) */
export interface ResultatDecision {
  message: string;
  attestation: AttestationDetail;
  score_mis_a_jour: number | null;
}

// ============================================================================
// Constantes
// ============================================================================

/** Étiquettes des types d'attestation en français */
export const ETIQUETTES_TYPES: Record<TypeAttestation, string> = {
  identite: "Identité",
  competence: "Compétence",
  moralite: "Moralité",
  residence: "Résidence",
  activite: "Activité",
  personnalise: "Personnalisé",
};

/** Étiquettes des statuts en français */
export const ETIQUETTES_STATUTS: Record<StatutAttestation, string> = {
  EN_ATTENTE: "En attente",
  APPROUVEE: "Approuvée",
  REFUSEE: "Refusée",
  EXPIREE: "Expirée",
};

/** Étiquettes des natures de lien en français */
export const ETIQUETTES_LIENS: Record<LienNature, string> = {
  famille: "Famille",
  ami: "Ami(e)",
  collegue: "Collègue",
  voisin: "Voisin(e)",
  associatif: "Associatif",
  religieux: "Religieux",
  professionnel: "Professionnel",
  academique: "Académique",
  autre: "Autre",
};

// ============================================================================
// Fonctions API
// ============================================================================

/**
 * Récupère la liste paginée des attestations de l'utilisateur.
 * 
 * @param direction "recues" (défaut) ou "envoyees"
 * @param statut Filtrer par statut (optionnel)
 * @param typeAttestation Filtrer par type (optionnel)
 * @param page Numéro de page (défaut: 1)
 * @param limite Éléments par page (défaut: 20)
 */
export const listerAttestations = (
  direction: "recues" | "envoyees" = "recues",
  statut?: StatutAttestation,
  typeAttestation?: TypeAttestation,
  page: number = 1,
  limite: number = 20,
) => {
  // Construction des paramètres de requête
  const params = new URLSearchParams();
  params.set("direction", direction);
  params.set("page", String(page));
  params.set("limite", String(limite));
  if (statut) params.set("statut", statut);
  if (typeAttestation) params.set("type_attestation", typeAttestation);

  return clientAPI.get<ListeAttestations>(
    `${PREFIXE}?${params.toString()}`,
    { authentifie: true },
  );
};

/**
 * Récupère les statistiques d'attestation de l'utilisateur.
 */
export const obtenirStatistiquesAttestations = () =>
  clientAPI.get<StatistiquesAttestations>(
    `${PREFIXE}/statistiques`,
    { authentifie: true },
  );

/**
 * Crée une nouvelle attestation communautaire.
 * 
 * @param donnees Données de l'attestation à créer
 */
export const creerAttestation = (donnees: {
  atteste_digiid: string;
  type_attestation: TypeAttestation;
  titre: string;
  description?: string;
  forces?: string;
  lien_connu_depuis?: string;
  lien_nature?: LienNature;
  poids_score?: number;
  est_visible_public?: boolean;
}) =>
  clientAPI.post<ResultatCreation>(PREFIXE, donnees, { authentifie: true });

/**
 * Récupère le détail complet d'une attestation.
 * 
 * @param id UUID de l'attestation
 */
export const obtenirDetailAttestation = (id: string) =>
  clientAPI.get<AttestationDetail>(`${PREFIXE}/${id}`, { authentifie: true });

/**
 * Met à jour une attestation (titre, description, forces, visibilité).
 * 
 * @param id UUID de l'attestation
 * @param donnees Données à modifier
 */
export const modifierAttestation = (
  id: string,
  donnees: {
    titre?: string;
    description?: string;
    forces?: string;
    est_visible_public?: boolean;
  },
) =>
  clientAPI.patch<AttestationDetail>(`${PREFIXE}/${id}`, donnees, {
    authentifie: true,
  });

/**
 * Supprime définitivement une attestation.
 * 
 * @param id UUID de l'attestation
 */
export const supprimerAttestation = (id: string) =>
  clientAPI.delete<{ message: string }>(`${PREFIXE}/${id}`, {
    authentifie: true,
  });

/**
 * Approuve une attestation reçue.
 * 
 * @param id UUID de l'attestation à approuver
 */
export const approuverAttestation = (id: string) =>
  clientAPI.post<ResultatDecision>(
    `${PREFIXE}/${id}/approuver`,
    undefined,
    { authentifie: true },
  );

/**
 * Refuse une attestation reçue avec un motif.
 * 
 * @param id UUID de l'attestation à refuser
 * @param motif Motif du refus
 */
export const refuserAttestation = (id: string, motif: string) =>
  clientAPI.post<ResultatDecision>(
    `${PREFIXE}/${id}/refuser`,
    { decision: "REFUSER", motif_refus: motif },
    { authentifie: true },
  );
