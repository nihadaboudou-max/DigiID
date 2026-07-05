/**
 * Service API pour le module Chefs.
 * Permet aux chefs de département de créer et gérer leurs agents.
 */
import { clientAPI, obtenirTokenAcces, ErreurAPI } from "./client_api";

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
  const token = obtenirTokenAcces();

  try {
    const reponse = await fetch("/api/backend/api/v1/chefs/police/agents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });

    if (!reponse.ok) {
      let erreur: any = {};
      try {
        erreur = await reponse.json();
      } catch {}
      throw new ErreurAPI(
        erreur.detail || "CREATION_AGENT_POLICE",
        erreur.detail || "Impossible de créer l'agent police.",
        reponse.status
      );
    }

    return reponse.json();
  } catch (erreur: unknown) {
    if (erreur instanceof ErreurAPI) throw erreur;
    throw new ErreurAPI(
      "RESEAU",
      "Erreur réseau lors de la création de l'agent police.",
      0
    );
  }
}

/**
 * Crée un médecin (réservé aux chefs médicaux).
 */
export async function creerMedecin(
  data: MedecinCreate
): Promise<AgentResponse> {
  const token = obtenirTokenAcces();

  try {
    const reponse = await fetch("/api/backend/api/v1/chefs/medical/medecins", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });

    if (!reponse.ok) {
      let erreur: any = {};
      try {
        erreur = await reponse.json();
      } catch {}
      throw new ErreurAPI(
        erreur.detail || "CREATION_MEDECIN",
        erreur.detail || "Impossible de créer le médecin.",
        reponse.status
      );
    }

    return reponse.json();
  } catch (erreur: unknown) {
    if (erreur instanceof ErreurAPI) throw erreur;
    throw new ErreurAPI(
      "RESEAU",
      "Erreur réseau lors de la création du médecin.",
      0
    );
  }
}

/**
 * Crée un agent ONG (réservé aux chefs ONG).
 */
export async function creerAgentONG(
  data: AgentONGCreate
): Promise<AgentResponse> {
  const token = obtenirTokenAcces();

  try {
    const reponse = await fetch("/api/backend/api/v1/chefs/ong/agents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });

    if (!reponse.ok) {
      let erreur: any = {};
      try {
        erreur = await reponse.json();
      } catch {}
      throw new ErreurAPI(
        erreur.detail || "CREATION_AGENT_ONG",
        erreur.detail || "Impossible de créer l'agent ONG.",
        reponse.status
      );
    }

    return reponse.json();
  } catch (erreur: unknown) {
    if (erreur instanceof ErreurAPI) throw erreur;
    throw new ErreurAPI(
      "RESEAU",
      "Erreur réseau lors de la création de l'agent ONG.",
      0
    );
  }
}

/**
 * Crée un agent enrôlement (réservé aux chefs enrôlement).
 */
export async function creerAgentEnrolement(
  data: AgentEnrolementCreate
): Promise<AgentResponse> {
  const token = obtenirTokenAcces();

  try {
    const reponse = await fetch(
      "/api/backend/api/v1/chefs/enrolement/agents",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      }
    );

    if (!reponse.ok) {
      let erreur: any = {};
      try {
        erreur = await reponse.json();
      } catch {}
      throw new ErreurAPI(
        erreur.detail || "CREATION_AGENT_ENROLEMENT",
        erreur.detail || "Impossible de créer l'agent enrôlement.",
        reponse.status
      );
    }

    return reponse.json();
  } catch (erreur: unknown) {
    if (erreur instanceof ErreurAPI) throw erreur;
    throw new ErreurAPI(
      "RESEAU",
      "Erreur réseau lors de la création de l'agent enrôlement.",
      0
    );
  }
}

// =============================================================================
// LISTE DES AGENTS
// =============================================================================

/**
 * Liste les agents créés par le chef connecté.
 */
export async function listerEquipe(params?: {
  page?: number;
  par_page?: number;
}): Promise<ListeAgentsResponse> {
  const token = obtenirTokenAcces();
  const queryParams = new URLSearchParams();

  if (params?.page) queryParams.set("page", params.page.toString());
  if (params?.par_page) queryParams.set("par_page", params.par_page.toString());

  try {
    const reponse = await fetch(
      `/api/backend/api/v1/chefs/equipe?${queryParams.toString()}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    );

    if (!reponse.ok) {
      let erreur: any = {};
      try {
        erreur = await reponse.json();
      } catch {}
      throw new ErreurAPI(
        erreur.detail || "LISTE_EQUIPE",
        erreur.detail || "Impossible de charger l'équipe.",
        reponse.status
      );
    }

    return reponse.json();
  } catch (erreur: unknown) {
    if (erreur instanceof ErreurAPI) throw erreur;
    throw new ErreurAPI(
      "RESEAU",
      "Erreur réseau lors du chargement de l'équipe.",
      0
    );
  }
}

// =============================================================================
// STATISTIQUES
// =============================================================================

/**
 * Obtient les statistiques pour le dashboard du chef.
 */
export async function obtenirStatistiquesChef(): Promise<StatistiquesChefResponse> {
  const token = obtenirTokenAcces();

  try {
    const reponse = await fetch("/api/backend/api/v1/chefs/statistiques", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!reponse.ok) {
      let erreur: any = {};
      try {
        erreur = await reponse.json();
      } catch {}
      throw new ErreurAPI(
        erreur.detail || "STATISTIQUES_CHEF",
        erreur.detail || "Impossible de charger les statistiques.",
        reponse.status
      );
    }

    return reponse.json();
  } catch (erreur: unknown) {
    if (erreur instanceof ErreurAPI) throw erreur;
    throw new ErreurAPI(
      "RESEAU",
      "Erreur réseau lors du chargement des statistiques.",
      0
    );
  }
}