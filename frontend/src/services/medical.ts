/**
 * Service API pour le module médical (dossiers, consultations, ordonnances).
 * Aligné avec les routes backend /api/v1/medical et /api/v1/utilisateur
 */
import { clientAPI } from "./client_api";

export interface DossierMedical {
  id: string;
  medecin_id: string;
  patient_nom: string;
  patient_prenom: string | null;
  patient_digiid: string;
  patient_date_naissance: string | null;
  hopital: string | null;
  motif: string;
  diagnostic: string | null;
  statut: string;
  consultations_count: number;
  ordonnances_count: number;
  date_creation: string;
  date_modification: string;
  // --- Cloisonnement ---
  domaine_id: string | null;
  departement_id: string | null;
}

export interface Consultation {
  id: string;
  dossier_id: string;
  medecin_id: string;
  hopital: string | null;
  motif: string;
  type_consultation: string | null;
  poids: number | null;
  taille: number | null;
  temperature: number | null;
  pression_arterielle: string | null;
  observations: string | null;
  diagnostic: string | null;
  conclusion: string | null;
  date_controle: string | null;
  date_consultation: string;
  // --- Cloisonnement ---
  domaine_id: string | null;
  departement_id: string | null;
}

export interface Ordonnance {
  id: string;
  dossier_id: string;
  medecin_id: string;
  numero_ordonnance: string;
  hopital: string | null;
  medecin_nom: string | null;
  medicaments: string;
  instructions: string | null;
  statut: string;
  date_prescription: string;
  date_expiration: string | null;
  // --- Cloisonnement ---
  domaine_id: string | null;
  departement_id: string | null;
}

export interface VerificationPatient {
  trouvé: boolean;
  digiid: string;
  nom: string | null;
  prenom: string | null;
  email: string | null;
}

/**
 * Vérifie qu'un DigiID correspond à un citoyen existant dans le système.
 */
export async function verifierPatient(digiid: string): Promise<VerificationPatient> {
  return clientAPI.get<VerificationPatient>(
    `/api/v1/medical/verifier-patient/${encodeURIComponent(digiid)}`,
    { authentifie: true }
  );
}

export async function listerDossiers(
  statut?: string,
  recherche?: string
): Promise<DossierMedical[]> {
  const params = new URLSearchParams();
  if (statut) params.set("statut", statut);
  if (recherche) params.set("recherche", recherche);
  const query = params.toString() ? `?${params.toString()}` : "";
  
  return clientAPI.get<DossierMedical[]>(`/api/v1/medical/dossiers${query}`, {
    authentifie: true,
  });
}

export async function creerDossier(data: {
  patient_nom: string;
  patient_prenom?: string;
  patient_digiid: string;
  patient_date_naissance?: string;
  hopital?: string;
  motif: string;
  diagnostic?: string;
}): Promise<DossierMedical> {
  return clientAPI.post<DossierMedical>("/api/v1/medical/dossiers", data, {
    authentifie: true,
  });
}

export async function obtenirDossier(id: string): Promise<DossierMedical> {
  return clientAPI.get<DossierMedical>(`/api/v1/medical/dossiers/${id}`, {
    authentifie: true,
  });
}

export async function modifierDossier(
  id: string,
  data: { motif?: string; diagnostic?: string; statut?: string; hopital?: string }
): Promise<DossierMedical> {
  return clientAPI.patch<DossierMedical>(`/api/v1/medical/dossiers/${id}`, data, {
    authentifie: true,
  });
}

export async function listerConsultations(dossierId: string): Promise<Consultation[]> {
  return clientAPI.get<Consultation[]>(
    `/api/v1/medical/dossiers/${dossierId}/consultations`,
    { authentifie: true }
  );
}

export async function ajouterConsultation(data: {
  dossier_id: string;
  motif: string;
  type_consultation?: string;
  observations?: string;
  diagnostic?: string;
  conclusion?: string;
  poids?: number;
  taille?: number;
  temperature?: number;
  pression_arterielle?: string;
  date_controle?: string;
  hopital?: string;
}): Promise<Consultation> {
  return clientAPI.post<Consultation>("/api/v1/medical/consultations", data, {
    authentifie: true,
  });
}

export async function listerOrdonnances(dossierId: string): Promise<Ordonnance[]> {
  return clientAPI.get<Ordonnance[]>(
    `/api/v1/medical/dossiers/${dossierId}/ordonnances`,
    { authentifie: true }
  );
}

/** Liste toutes les ordonnances du médecin connecté. */
export async function listerToutesOrdonnances(): Promise<Ordonnance[]> {
  return clientAPI.get<Ordonnance[]>("/api/v1/medical/ordonnances", {
    authentifie: true,
  });
}

export async function creerOrdonnance(data: {
  dossier_id: string;
  hopital?: string;
  medicaments: string;
  instructions?: string;
  date_expiration?: string;
}): Promise<Ordonnance> {
  return clientAPI.post<Ordonnance>("/api/v1/medical/ordonnances", data, {
    authentifie: true,
  });
}

export async function modifierOrdonnance(
  id: string,
  data: { medicaments?: string; instructions?: string; date_expiration?: string }
): Promise<Ordonnance> {
  return clientAPI.patch<Ordonnance>(
    `/api/v1/medical/ordonnances/${id}`,
    data,
    { authentifie: true }
  );
}

export async function supprimerOrdonnance(id: string): Promise<void> {
  return clientAPI.delete(`/api/v1/medical/ordonnances/${id}`, {
    authentifie: true,
  });
}

// =============================================================================
// ROUTES PATIENT (Citoyen)
// =============================================================================

/** Récupère le dossier médical complet du citoyen connecté. */
export async function monDossierMedical(): Promise<{
  dossier: DossierMedical;
  consultations: Consultation[];
  ordonnances: Ordonnance[];
}[]> {
  return clientAPI.get<
    { dossier: DossierMedical; consultations: Consultation[]; ordonnances: Ordonnance[] }[]
  >("/api/v1/utilisateur/mon-dossier-medical", { authentifie: true });
}

/** Liste les ordonnances du citoyen connecté (patient). */
export async function mesOrdonnances(): Promise<Ordonnance[]> {
  return clientAPI.get<Ordonnance[]>("/api/v1/utilisateur/mes-ordonnances", {
    authentifie: true,
  });
}

/** Signale un problème sur une ordonnance (patient). */
export async function signalerOrdonnance(
  id: string,
  motif: string
): Promise<{ succes: boolean; message: string }> {
  return clientAPI.post<{ succes: boolean; message: string }>(
    `/api/v1/utilisateur/mes-ordonnances/${id}/signaler`,
    { motif },
    { authentifie: true }
  );
}

// =============================================================================
// RECONNAISSANCE FACIALE - RECHERCHE PAR PHOTO
// =============================================================================

export interface Personne {
  id: string;
  nom: string;
  prenom: string | null;
  date_naissance: string | null;
  groupe_sanguin: string | null;
  telephone: string | null;
  contact_urgence: string | null;
  photo: string | null;
  antecedents: string[];
  allergies: string[];
  digiid?: string;
}

export interface RecherchePersonne {
  trouve: boolean;
  personne: Personne | null;
  score_confiance: number;
  temps_analyse_ms: number;
  candidats_possibles?: Personne[];
}

/**
 * Recherche une personne dans la base de données par reconnaissance faciale.
 */
export async function rechercherPersonneParPhoto(data: {
  photo: string; // base64 ou URL
}): Promise<RecherchePersonne> {
  return clientAPI.post<RecherchePersonne>(
    "/api/v1/medical/recherche-par-photo",
    data,
    { authentifie: true }
  );
}