/**
 * Service API pour le module ONG — bénéficiaires, programmes, missions.
 */
import { clientAPI } from "./client_api";

export interface BeneficiaireONG {
  id: string;
  ong_id: string;
  nom: string;
  digiid: string | null;
  programme: string;
  zone: string | null;
  date_inscription: string;
  statut: string;
  notes: string | null;
}

export interface ProgrammeONG {
  id: string;
  ong_id: string;
  nom: string;
  description: string | null;
  zone: string | null;
  budget: number | null;
  date_debut: string;
  date_fin: string | null;
  statut: string;
}

export interface MissionTerrain {
  id: string;
  ong_id: string;
  programme_id: string | null;
  titre: string;
  zone: string | null;
  date_depart: string;
  date_retour: string | null;
  objectifs: string | null;
  statut: string;
}

export interface StatsONG {
  nb_beneficiaires: number;
  nb_programmes: number;
  nb_missions: number;
  zones: string[];
}

export async function listerBeneficiaires(): Promise<BeneficiaireONG[]> {
  return clientAPI.get<BeneficiaireONG[]>("/api/v1/utilisateur/ong/beneficiaires", {
    authentifie: true,
  });
}

export async function creerBeneficiaire(data: {
  nom: string;
  digiid?: string;
  programme: string;
  zone?: string;
  notes?: string;
}): Promise<BeneficiaireONG> {
  return clientAPI.post<BeneficiaireONG>("/api/v1/utilisateur/ong/beneficiaires", data, {
    authentifie: true,
  });
}

export async function listerProgrammes(): Promise<ProgrammeONG[]> {
  return clientAPI.get<ProgrammeONG[]>("/api/v1/utilisateur/ong/programmes", {
    authentifie: true,
  });
}

export async function creerProgramme(data: {
  nom: string;
  description?: string;
  zone?: string;
  budget?: number;
  date_debut: string;
  date_fin?: string;
}): Promise<ProgrammeONG> {
  return clientAPI.post<ProgrammeONG>("/api/v1/utilisateur/ong/programmes", data, {
    authentifie: true,
  });
}

export async function listerMissions(): Promise<MissionTerrain[]> {
  return clientAPI.get<MissionTerrain[]>("/api/v1/utilisateur/ong/missions", {
    authentifie: true,
  });
}

export async function creerMission(data: {
  programme_id?: string;
  titre: string;
  zone?: string;
  date_depart: string;
  date_retour?: string;
  objectifs?: string;
}): Promise<MissionTerrain> {
  return clientAPI.post<MissionTerrain>("/api/v1/utilisateur/ong/missions", data, {
    authentifie: true,
  });
}

export async function obtenirStats(): Promise<StatsONG> {
  return clientAPI.get<StatsONG>("/api/v1/utilisateur/ong/stats", {
    authentifie: true,
  });
}
