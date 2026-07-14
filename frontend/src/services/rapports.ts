/**
 * Service API pour la gestion des rapports.
 */
import { clientAPI } from "./client_api";

export interface Rapport {
  id: string;
  titre: string;
  type: "activite" | "mission" | "financier" | "beneficiaires";
  description?: string;
  date_creation: string;
  statut: "brouillon" | "valide" | "archive";
  auteur: string;
  auteur_id?: string;
}

export interface RapportCreate {
  titre: string;
  type: "activite" | "mission" | "financier" | "beneficiaires";
  description?: string;
}

export async function listerRapports(
  typeOrganisation: "police" | "medical" | "ong" | "enrolement",
  params?: { page?: number; par_page?: number; type?: string; statut?: string }
): Promise<{ rapports: Rapport[]; total: number }> {
  const qs = new URLSearchParams(params as any).toString();
  return clientAPI.get(`/api/v1/${typeOrganisation}/rapports?${qs}`, {
    authentifie: true,
  });
}

export async function creerRapport(
  typeOrganisation: "police" | "medical" | "ong" | "enrolement",
  data: RapportCreate
): Promise<Rapport> {
  return clientAPI.post(`/api/v1/${typeOrganisation}/rapports`, data, {
    authentifie: true,
  });
}

export async function supprimerRapport(
  typeOrganisation: "police" | "medical" | "ong" | "enrolement",
  rapportId: string
): Promise<void> {
  return clientAPI.delete(
    `/api/v1/${typeOrganisation}/rapports/${rapportId}`,
    { authentifie: true }
  );
}

export async function validerRapport(
  typeOrganisation: "police" | "medical" | "ong" | "enrolement",
  rapportId: string
): Promise<Rapport> {
  return clientAPI.patch(
    `/api/v1/${typeOrganisation}/rapports/${rapportId}/valider`,
    {},
    { authentifie: true }
  );
}

export async function archiverRapport(
  typeOrganisation: "police" | "medical" | "ong" | "enrolement",
  rapportId: string
): Promise<Rapport> {
  return clientAPI.patch(
    `/api/v1/${typeOrganisation}/rapports/${rapportId}/archiver`,
    {},
    { authentifie: true }
  );
}