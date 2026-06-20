/**
 * Service API pour le module médical (dossiers, consultations, ordonnances).
 */
import { clientAPI } from "./client_api";

export interface DossierMedical {
  id: string;
  medecin_id: string;
  patient_nom: string;
  patient_digiid: string;
  patient_date_naissance: string | null;
  motif: string;
  diagnostic: string | null;
  statut: string;
  consultations_count: number;
  ordonnances_count: number;
  date_creation: string;
  date_modification: string;
}

export interface Consultation {
  id: string;
  dossier_id: string;
  medecin_id: string;
  motif: string;
  observations: string | null;
  diagnostic: string | null;
  date_consultation: string;
}

export interface Ordonnance {
  id: string;
  dossier_id: string;
  medecin_id: string;
  medicaments: string;
  instructions: string | null;
  date_prescription: string;
  date_expiration: string | null;
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
export async function verifierPatient(
  digiid: string,
): Promise<VerificationPatient> {
  return clientAPI.get<VerificationPatient>(
    `/api/v1/utilisateur/medical/verifier-patient/${encodeURIComponent(digiid)}`,
    { authentifie: true },
  );
}


export async function listerDossiers(
  statut?: string,
  recherche?: string,
): Promise<DossierMedical[]> {
  const params = new URLSearchParams();
  if (statut) params.set("statut", statut);
  if (recherche) params.set("recherche", recherche);
  const query = params.toString() ? `?${params.toString()}` : "";
  return clientAPI.get<DossierMedical[]>(`/api/v1/utilisateur/medical/dossiers${query}`, {
    authentifie: true,
  });
}

export async function creerDossier(data: {
  patient_nom: string;
  patient_digiid: string;
  motif: string;
  diagnostic?: string;
}): Promise<DossierMedical> {
  return clientAPI.post<DossierMedical>("/api/v1/utilisateur/medical/dossiers", data, {
    authentifie: true,
  });
}

export async function obtenirDossier(id: string): Promise<DossierMedical> {
  return clientAPI.get<DossierMedical>(`/api/v1/utilisateur/medical/dossiers/${id}`, {
    authentifie: true,
  });
}

export async function modifierDossier(
  id: string,
  data: { motif?: string; diagnostic?: string; statut?: string },
): Promise<DossierMedical> {
  return clientAPI.patch<DossierMedical>(`/api/v1/utilisateur/medical/dossiers/${id}`, data, {
    authentifie: true,
  });
}

export async function listerConsultations(dossierId: string): Promise<Consultation[]> {
  return clientAPI.get<Consultation[]>(
    `/api/v1/utilisateur/medical/dossiers/${dossierId}/consultations`,
    { authentifie: true },
  );
}

export async function ajouterConsultation(data: {
  dossier_id: string;
  motif: string;
  observations?: string;
  diagnostic?: string;
}): Promise<Consultation> {
  return clientAPI.post<Consultation>("/api/v1/utilisateur/medical/consultations", data, {
    authentifie: true,
  });
}

export async function listerOrdonnances(dossierId: string): Promise<Ordonnance[]> {
  return clientAPI.get<Ordonnance[]>(
    `/api/v1/utilisateur/medical/dossiers/${dossierId}/ordonnances`,
    { authentifie: true },
  );
}

/** Liste toutes les ordonnances du médecin connecté. */
export async function listerToutesOrdonnances(): Promise<Ordonnance[]> {
  return clientAPI.get<Ordonnance[]>("/api/v1/utilisateur/medical/ordonnances", {
    authentifie: true,
  });
}

export async function creerOrdonnance(data: {
  dossier_id: string;
  medicaments: string;
  instructions?: string;
  date_expiration?: string;
}): Promise<Ordonnance> {
  return clientAPI.post<Ordonnance>("/api/v1/utilisateur/medical/ordonnances", data, {
    authentifie: true,
  });
}

export async function modifierOrdonnance(
  id: string,
  data: { medicaments?: string; instructions?: string; date_expiration?: string },
): Promise<Ordonnance> {
  return clientAPI.patch<Ordonnance>(
    `/api/v1/utilisateur/medical/ordonnances/${id}`,
    data,
    { authentifie: true },
  );
}

export async function supprimerOrdonnance(id: string): Promise<void> {
  return clientAPI.delete(
    `/api/v1/utilisateur/medical/ordonnances/${id}`,
    { authentifie: true },
  );
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
  motif: string,
): Promise<{ succes: boolean; message: string }> {
  return clientAPI.post<{ succes: boolean; message: string }>(
    `/api/v1/utilisateur/mes-ordonnances/${id}/signaler`,
    { motif },
    { authentifie: true },
  );
}
