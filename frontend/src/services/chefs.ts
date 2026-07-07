/**
 * Service API pour le module Chefs.
 * Permet aux chefs de département de créer et gérer leurs agents.
 *
 * ✅ Utilise clientAPI centralisé pour :
 *   - Gestion automatique du token JWT
 *   - Rafraîchissement automatique (401)
 *   - Gestion uniforme des erreurs
 */
import { clientAPI } from "./client_api";

// =============================================================================
// TYPES
// =============================================================================

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
  date_creation: string;
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
// CRÉATION D'AGENTS
// =============================================================================

/**
 * Crée un agent police (réservé aux chefs police).
 */
export async function creerAgentPolice(
  data: AgentPoliceCreate
): Promise<AgentResponse> {
  return clientAPI.post<AgentResponse>(
    "/api/v1/chefs/police/agents",
    data,
    { authentifie: true }
  );
}

/**
 * Crée un médecin (réservé aux chefs médicaux).
 */
export async function creerMedecin(
  data: MedecinCreate
): Promise<AgentResponse> {
  return clientAPI.post<AgentResponse>(
    "/api/v1/chefs/medical/medecins",
    data,
    { authentifie: true }
  );
}

/**
 * Crée un agent ONG (réservé aux chefs ONG).
 */
export async function creerAgentONG(
  data: AgentONGCreate
): Promise<AgentResponse> {
  return clientAPI.post<AgentResponse>(
    "/api/v1/chefs/ong/agents",
    data,
    { authentifie: true }
  );
}

/**
 * Crée un agent enrôlement (réservé aux chefs enrôlement).
 */
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

/**
 * Liste les agents créés par le chef connecté (tous types confondus).
 */
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

/**
 * Liste les agents ONG créés par le chef ONG connecté.
 */
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

/**
 * Liste les agents police créés par le chef police connecté.
 */
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

/**
 * Liste les médecins créés par le chef médical connecté.
 */
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

/**
 * Liste les agents d'enrôlement créés par le chef enrôlement connecté.
 */
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

/**
 * Obtient les statistiques pour le dashboard du chef.
 */
export async function obtenirStatistiquesChef(): Promise<StatistiquesChefResponse> {
  return clientAPI.get<StatistiquesChefResponse>(
    "/api/v1/chefs/statistiques",
    { authentifie: true }
  );
}

// =============================================================================
// GESTION DES AGENTS (suspendre, réactiver, supprimer)
// =============================================================================

/**
 * Suspend un agent.
 */
export async function suspendreAgent(agentId: string): Promise<AgentResponse> {
  return clientAPI.patch<AgentResponse>(
    `/api/v1/chefs/agents/${agentId}/suspendre`,
    undefined,
    { authentifie: true }
  );
}

/**
 * Réactive un agent suspendu.
 */
export async function reactiverAgent(agentId: string): Promise<AgentResponse> {
  return clientAPI.patch<AgentResponse>(
    `/api/v1/chefs/agents/${agentId}/reactiver`,
    undefined,
    { authentifie: true }
  );
}

/**
 * Supprime un agent.
 */
export async function supprimerAgent(agentId: string): Promise<void> {
  return clientAPI.delete<void>(
    `/api/v1/chefs/agents/${agentId}`,
    { authentifie: true }
  );
}