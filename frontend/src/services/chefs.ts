/**
 * Service API pour le module Chefs.
 * Permet aux chefs de département de créer et gérer leurs agents.
 */
import { clientAPI } from "./client_api";

// =============================================================================
// TYPES (Alignés strictement avec backend/src/modules/chefs/schemas.py)
// =============================================================================

export interface InvitationAgentCreate {
  email: string;
  message?: string;
}

export interface AgentPoliceCreate {
  email: string;
  prenom: string;
  nom: string;
  telephone?: string;
  ville?: string;
  pays?: string;
}

export interface MedecinCreate {
  email: string;
  prenom: string;
  nom: string;
  telephone?: string;
  ville?: string;
  pays?: string;
  specialite?: string;
}

export interface AgentONGCreate {
  email: string;
  prenom: string;
  nom: string;
  telephone?: string;
  ville?: string;
  pays?: string;
  mission?: string;
}

export interface AgentEnrolementCreate {
  email: string;
  prenom: string;
  nom: string;
  telephone?: string;
  ville?: string;
  pays?: string;
}

export interface AgentResponse {
  id: string;
  digiid_public: string;
  email: string;
  prenom: string;
  nom: string;
  role: string;
  domaine_id: string | null;
  departement_id: string | null;
  superieur_id: string | null;
  est_actif: boolean;
  ville: string | null;
  date_creation: string;
}

export interface InvitationResponse {
  id: string;
  email: string;
  role: string;
  statut: string;
  date_creation: string;
  date_expiration: string;
  date_acceptation: string | null;
}

export interface ListeAgentsResponse {
  agents: AgentResponse[];
  total: number;
  page: number;
  par_page: number;
}

export interface StatistiquesChefResponse {
  total_agents: number;
  agents_actifs: number;
  agents_inactifs: number;
  agents_crees_aujourdhui: number;
  agents_crees_ce_mois: number;
  dernier_agent_cree: AgentResponse | null;
}

// =============================================================================
// INVITATIONS
// =============================================================================

export async function inviterAgent(
  typeChef: "ong" | "police" | "medical" | "enrolement",
  data: InvitationAgentCreate
): Promise<any> {
  return clientAPI.post<any>(
    `/api/v1/chefs/${typeChef}/invitations`,
    data,
    { authentifie: true }
  );
}

export async function listerInvitations(params?: {
  page?: number;
  par_page?: number;
  statut?: string;
}): Promise<{ invitations: InvitationResponse[]; total: number }> {
  return clientAPI.get<any>(
    "/api/v1/chefs/invitations",
    {
      authentifie: true,
      params: params as Record<string, unknown>,
    }
  );
}

export async function annulerInvitation(invitationId: string): Promise<void> {
  return clientAPI.delete<void>(
    `/api/v1/chefs/invitations/${invitationId}`,
    { authentifie: true }
  );
}

export async function renvoyerInvitation(invitationId: string): Promise<any> {
  return clientAPI.post<any>(
    `/api/v1/chefs/invitations/${invitationId}/renvoyer`,
    {},
    { authentifie: true }
  );
}

// =============================================================================
// CRÉATION DIRECTE D'AGENTS
// =============================================================================

export async function creerAgentPolice(
  data: AgentPoliceCreate
): Promise<AgentResponse> {
  return clientAPI.post<AgentResponse>(
    "/api/v1/chefs/police/agents",
    data,
    { authentifie: true }
  );
}

export async function creerMedecin(
  data: MedecinCreate
): Promise<AgentResponse> {
  return clientAPI.post<AgentResponse>(
    "/api/v1/chefs/medical/medecins",
    data,
    { authentifie: true }
  );
}

export async function creerAgentONG(
  data: AgentONGCreate
): Promise<AgentResponse> {
  return clientAPI.post<AgentResponse>(
    "/api/v1/chefs/ong/agents",
    data,
    { authentifie: true }
  );
}

export async function creerAgentEnrolement(
  data: AgentEnrolementCreate
): Promise<AgentResponse> {
  return clientAPI.post<AgentResponse>(
    "/api/v1/chefs/enrolement/agents",
    data,
    { authentifie: true }
  );
}

// =============================================================================
// LISTE DES AGENTS
// =============================================================================

export async function listerEquipe(params?: {
  page?: number;
  par_page?: number;
}): Promise<ListeAgentsResponse> {
  return clientAPI.get<ListeAgentsResponse>(
    "/api/v1/chefs/equipe",
    {
      authentifie: true,
      params: params as Record<string, unknown>,
    }
  );
}

export async function listerAgentsONG(params?: {
  page?: number;
  par_page?: number;
}): Promise<ListeAgentsResponse> {
  return clientAPI.get<ListeAgentsResponse>(
    "/api/v1/chefs/ong/agents",
    {
      authentifie: true,
      params: params as Record<string, unknown>,
    }
  );
}

export async function listerAgentsPolice(params?: {
  page?: number;
  par_page?: number;
}): Promise<ListeAgentsResponse> {
  return clientAPI.get<ListeAgentsResponse>(
    "/api/v1/chefs/police/agents",
    {
      authentifie: true,
      params: params as Record<string, unknown>,
    }
  );
}

export async function listerMedecins(params?: {
  page?: number;
  par_page?: number;
}): Promise<ListeAgentsResponse> {
  return clientAPI.get<ListeAgentsResponse>(
    "/api/v1/chefs/medical/medecins",
    {
      authentifie: true,
      params: params as Record<string, unknown>,
    }
  );
}

export async function listerAgentsEnrolement(params?: {
  page?: number;
  par_page?: number;
}): Promise<ListeAgentsResponse> {
  return clientAPI.get<ListeAgentsResponse>(
    "/api/v1/chefs/enrolement/agents",
    {
      authentifie: true,
      params: params as Record<string, unknown>,
    }
  );
}

// =============================================================================
// STATISTIQUES
// =============================================================================

export async function obtenirStatistiquesChef(): Promise<StatistiquesChefResponse> {
  return clientAPI.get<StatistiquesChefResponse>(
    "/api/v1/chefs/statistiques",
    { authentifie: true }
  );
}

// =============================================================================
// GESTION DES AGENTS
// =============================================================================

export async function suspendreAgent(agentId: string): Promise<AgentResponse> {
  return clientAPI.patch<AgentResponse>(
    `/api/v1/chefs/agents/${agentId}/suspendre`,
    {},
    { authentifie: true }
  );
}

export async function reactiverAgent(agentId: string): Promise<AgentResponse> {
  return clientAPI.patch<AgentResponse>(
    `/api/v1/chefs/agents/${agentId}/reactiver`,
    {},
    { authentifie: true }
  );
}

export async function supprimerAgent(agentId: string): Promise<void> {
  return clientAPI.delete<void>(
    `/api/v1/chefs/agents/${agentId}`,
    { authentifie: true }
  );
}

export interface AuditLog {
  id: string;
  date_evenement: string;
  agent_nom: string;
  agent_role: string;
  type_evenement: string;
  description: string;
  adresse_ip: string | null;
  donnees_supplementaires: Record<string, unknown> | null;
}

export async function listerAuditChef(params?: {
  date_debut?: string;
  date_fin?: string;
  agent_id?: string;
  type_action?: string;
  page?: number;
  par_page?: number;
}): Promise<{ logs: AuditLog[]; total: number; page: number; par_page: number }> {
  return clientAPI.get("/api/v1/chefs/audit", {
    authentifie: true,
    params,
  });
}