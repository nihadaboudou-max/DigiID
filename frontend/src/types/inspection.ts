// Types TypeScript pour le module d'inspection de documents
// Correspond aux schémas Pydantic du backend

export enum TypeDocument {
  CNI_BIOMETRIQUE = "cni_biometrique",
  CNI_PAPIER = "cni_papier",
  PASSEPORT = "passeport",
  PERMIS_CONDUIRE = "permis_conduire",
  CARTE_ASSURANCE = "carte_assurance",
  CARTE_SEJOUR = "carte_sejour",
  CARTE_VOTE = "carte_vote",
  CARTE_ETUDIANT = "carte_etudiant",
  INCONNU = "inconnu",
}

export enum StatutVerification {
  EN_ATTENTE = "en_attente",
  APPROUVE = "approuve",
  REJETE = "rejete",
  PARTIEL = "partiel",
}

export enum FaceDocument {
  RECTO = "recto",
  VERSO = "verso",
  UNIQUE = "unique",
}

export interface DonneesDocumentExtraites {
  type_document: TypeDocument;
  pays_emetteur?: string;
  face: FaceDocument;
  nom_famille?: string;
  prenoms?: string;
  date_naissance?: string;
  sexe: "M" | "F" | "non_detecte";
  numero_document?: string;
  date_expiration?: string;
  lieu_naissance?: string;
  date_delivrance?: string;
  autorite_delivrance?: string;
  nationalite?: string;
  taille?: string;
  mrz_ligne_1?: string;
  mrz_ligne_2?: string;
  mrz_ligne_3?: string;
  mrz_valide: boolean;
  donnees_specifiques: Record<string, any>;
  taux_confiance_ocr: number;
  texte_brut: string;
  format_carte?: string;
}

export interface ResultatValidation {
  est_valide: boolean;
  statut: StatutVerification;
  scores: Record<string, boolean>;
  message: string;
  erreurs: string[];
}

export interface ResultatCoherence {
  est_coherent: boolean;
  mode: "citoyen" | "agent_terrain";
  message: string;
  incoherences: string[];
}

export interface ReponseUploadDocument {
  id_verification: string;
  type_document: TypeDocument;
  statut: StatutVerification;
  donnees: DonneesDocumentExtraites;
  validation: ResultatValidation;
  coherence?: ResultatCoherence;
  message: string;
  temps_traitement_ms: number;
}

export interface DetailVerification {
  id: string;
  utilisateur_id: string;
  type_document: TypeDocument;
  statut: StatutVerification;
  face: FaceDocument;
  nom_fichier: string;
  numero_document?: string;
  nom_famille?: string;
  prenoms?: string;
  date_naissance?: string;
  taux_confiance_ocr: number;
  est_valide: boolean;
  cree_le: string;
  est_supprime: boolean;
}

export interface ListeVerifications {
  historique: DetailVerification[];
  total: number;
  limite: number;
}

export interface SyntheseVerification {
  id_recto?: string;
  id_verso?: string;
  statut: StatutVerification;
  donnees_recto?: DonneesDocumentExtraites;
  donnees_verso?: DonneesDocumentExtraites;
  validation_globale?: ResultatValidation;
  message: string;
  champs_verifies: number;
  champs_total: number;
}