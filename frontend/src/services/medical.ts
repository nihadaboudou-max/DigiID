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
