/**
 * Service score — appels API pour la page /score, le tableau de bord.
 * Branché sur /api/v1/utilisateur/score/*
 */
import { clientAPI } from "./client_api";

const PREFIXE = "/api/v1/utilisateur/score";

export interface FacteurScore {
  nom: string;
  libelle: string;
  valeur: number;
  poids_maximum: number;
  pourcentage_utilisation: number;
}

export interface ScoreDetail {
  utilisateur_id: string;
  score_total: number;
  niveau: string;
  interpretation: string;
  facteurs: FacteurScore[];
  methode: string;
  date_calcul: string;
  prochaine_mise_a_jour: string | null;
}

export interface PointHistorique {
  date_calcul: string;
  score_total: number;
  methode: string;
}

export interface ListeHistoriqueScore {
  historique: PointHistorique[];
  nombre_points: number;
}

export const obtenirMonScore = () =>
  clientAPI.get<ScoreDetail>(PREFIXE, { authentifie: true });

export const recalculerMonScore = () =>
  clientAPI.post<ScoreDetail>(`${PREFIXE}/recalculer`, undefined, { authentifie: true });

export const obtenirHistoriqueScore = (limite: number = 24) =>
  clientAPI.get<ListeHistoriqueScore>(
    `${PREFIXE}/historique?limite=${limite}`,
    { authentifie: true },
  );
