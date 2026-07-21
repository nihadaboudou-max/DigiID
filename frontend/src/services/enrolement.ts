/**
 * Service API pour l'enrôlement citoyen (agent terrain).
 */
import { clientAPI } from "./client_api";

export interface Enrolement {
  id: string;
  agent_id: string;
  citoyen_nom: string;
  citoyen_prenom: string;
  citoyen_digiid: string | null;
  citoyen_telephone: string | null;
  citoyen_email: string | null;
  statut: string;
  notes: string | null;
  scan_cni: boolean;
  capture_biometrique: boolean;
  date_enrolement: string;
  date_validation: string | null;
}

export async function listerEnrolements(statut?: string): Promise<Enrolement[]> {
    const params = statut && statut !== "tous" ? `?statut=${statut}` : "";
    return clientAPI.get<Enrolement[]>(`/api/v1/enrolement/liste${params}`, {
      authentifie: true,
    });
  }
  
  export async function creerEnrolement(data: {
    citoyen_nom: string;
    citoyen_prenom: string;
    citoyen_telephone: string;
    citoyen_email?: string;
    notes?: string;
  }): Promise<Enrolement> {
    return clientAPI.post<Enrolement>("/api/v1/enrolement/creer", data, {
      authentifie: true,
    });
  }
  export async function modifierEnrolement(
    id: string,
    data: { statut?: string; scan_cni?: boolean; capture_biometrique?: boolean; notes?: string },
  ): Promise<Enrolement> {
    return clientAPI.patch<Enrolement>(`/api/v1/enrolement/${id}`, data, {
      authentifie: true,
    });
}
