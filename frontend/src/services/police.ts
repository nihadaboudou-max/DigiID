/**
 * Service API pour le module Police — vérifications et signalements.
 */
import { clientAPI } from "./client_api";

export interface VerificationPolice {
  id: string;
  officier_id: string;
  personne_digiid: string;
  personne_nom: string | null;
  type_verification: string;
  resultat: string | null;
  notes: string | null;
  date_verification: string;
  est_signalement_fraude: boolean;
}

export interface SignalementFraude {
  id: string;
  officier_id: string;
  personne_digiid: string;
  motif: string;
  description: string | null;
  statut: string;
  date_signalement: string;
  date_traitement: string | null;
}

export interface PersonneRecherchee {
  digiid: string;
  nom: string;
  email: string;
  score: number;
  est_actif: boolean;
}

export async function verifierIdentite(data: {
  personne_digiid: string;
  personne_nom?: string;
  notes?: string;
}): Promise<VerificationPolice> {
  return clientAPI.post<VerificationPolice>("/api/v1/utilisateur/police/verifier", data, {
    authentifie: true,
  });
}

export async function listerVerifications(): Promise<VerificationPolice[]> {
  return clientAPI.get<VerificationPolice[]>("/api/v1/utilisateur/police/verifications", {
    authentifie: true,
  });
}

export async function rechercherPersonne(digiid: string): Promise<PersonneRecherchee | null> {
  return clientAPI.get<PersonneRecherchee>(`/api/v1/utilisateur/police/rechercher/${digiid}`, {
    authentifie: true,
  });
}

export async function creerSignalement(data: {
  personne_digiid: string;
  motif: string;
  description?: string;
}): Promise<SignalementFraude> {
  return clientAPI.post<SignalementFraude>("/api/v1/utilisateur/police/signalements", data, {
    authentifie: true,
  });
}

export async function listerSignalements(): Promise<SignalementFraude[]> {
  return clientAPI.get<SignalementFraude[]>("/api/v1/utilisateur/police/signalements", {
    authentifie: true,
  });
}
