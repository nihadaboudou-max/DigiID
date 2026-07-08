/**
 * Service API pour le module Chefs.
 * Permet aux chefs de département de créer et gérer leurs agents.
 */
import { clientAPI } from "./client_api";

// =============================================================================
// TYPES
// =============================================================================

export interface InvitationAgentCreate {
  email: string;
  prenom?: string;
  nom?: string;
  telephone?: string;
  ville?: string;
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
  zone_intervention?: string;
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
  ville?: string;
  date_creation: string;
}

export interface InvitationResponse {
  id: string;
  email: string;
  role: string;
  statut: "en_attente" | "acceptee" | "expiree" | "annulee";
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
// INVITATIONS - NOUVEAU !
// =============================================================================

/**
 * Envoie une invitation à un futur agent.
 */
export async function inviterAgent(
  typeChef: "ong" | "police" | "medical" | "enrolement",
  data: InvitationAgentCreate
): Promise<InvitationResponse> {
  return clientAPI.post<InvitationResponse>(
    `/api/v1/chefs/${typeChef}/invitations`,
    data,
    { authentifie: true }
  );
}

/**
 * Liste les invitations envoyées par le chef.
 */
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

/**
 * Annule une invitation en attente.
 */
export async function annulerInvitation(invitationId: string): Promise<void> {
  return clientAPI.delete<void>(
    `/api/v1/chefs/invitations/${invitationId}`,
    { authentifie: true }
  );
}

/**
 * Renvoie une invitation.
 */
export async function renvoyerInvitation(invitationId: string): Promise<InvitationResponse> {
  return clientAPI.post<InvitationResponse>(
    `/api/v1/chefs/invitations/${invitationId}/renvoyer`,
    undefined,
    { authentifie: true }
  );
}

// =============================================================================
// CRÉATION DIRECTE D'AGENTS (sans invitation)
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
// STATISTIQUES EN TEMPS RÉEL
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
    undefined,
    { authentifie: true }
  );
}

export async function reactiverAgent(agentId: string): Promise<AgentResponse> {
  return clientAPI.patch<AgentResponse>(
    `/api/v1/chefs/agents/${agentId}/reactiver`,
    undefined,
    { authentifie: true }
  );
}

export async function supprimerAgent(agentId: string): Promise<void> {
  return clientAPI.delete<void>(
    `/api/v1/chefs/agents/${agentId}`,
    { authentifie: true }
  );
}