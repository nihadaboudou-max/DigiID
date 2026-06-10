/**
 * Service gamification — badges, streak, recommandations, notifications, parrainage.
 * Branche sur /api/v1/utilisateur/{badges,engagement,recommandations,notifications,parrainage}
 */
import { clientAPI } from "./client_api";

const PREFIXE = "/api/v1/utilisateur";

// ============================================================================
// Badges
// ============================================================================

export interface BadgeDetail {
  code: string;
  titre: string;
  description: string;
  icone: string;
  bonus_score: number;
  rarete: "commun" | "rare" | "epique" | "legendaire";
  est_debloque: boolean;
  date_obtention: string | null;
}

export interface ListeBadges {
  badges: BadgeDetail[];
  total_debloques: number;
  total_disponibles: number;
  bonus_total: number;
}

export const listerMesBadges = () =>
  clientAPI.get<ListeBadges>(`${PREFIXE}/badges`, { authentifie: true });

// ============================================================================
// Engagement
// ============================================================================

export interface StatistiquesEngagement {
  streak_actuel: number;
  streak_record: number;
  jours_actifs_30j: number;
  bonus_score_cumule: number;
  bonus_streak_actuel: number;
  prochain_palier_streak: number;
  jours_jusqu_au_palier: number;
}

export const obtenirMonEngagement = () =>
  clientAPI.get<StatistiquesEngagement>(`${PREFIXE}/engagement`, { authentifie: true });

// ============================================================================
// Recommandations
// ============================================================================

export interface RecommandationDetail {
  code: string;
  titre: string;
  description: string;
  icone: string;
  gain_estime: number;
  lien_action: string;
  priorite: "haute" | "moyenne" | "basse";
}

export interface ListeRecommandations {
  recommandations: RecommandationDetail[];
  total: number;
  gain_total_potentiel: number;
}

export const obtenirMesRecommandations = () =>
  clientAPI.get<ListeRecommandations>(`${PREFIXE}/recommandations`, { authentifie: true });

// ============================================================================
// Notifications
// ============================================================================

export interface NotificationDetail {
  id: string;
  type_notification: "info" | "succes" | "avertissement" | "alerte";
  categorie: string;
  titre: string;
  message: string;
  lien_action: string | null;
  est_lue: boolean;
  date_lecture: string | null;
  cree_le: string;
}

export interface ListeNotifications {
  notifications: NotificationDetail[];
  total: number;
  non_lues: number;
}

export const listerMesNotifications = (seulementNonLues = false) =>
  clientAPI.get<ListeNotifications>(
    `${PREFIXE}/notifications?seulement_non_lues=${seulementNonLues}`,
    { authentifie: true },
  );

export const marquerNotificationLue = (id: string) =>
  clientAPI.patch<void>(`${PREFIXE}/notifications/${id}/lue`, undefined, { authentifie: true });

export const marquerToutesNotificationsLues = () =>
  clientAPI.post<{ nombre_marquees: number }>(
    `${PREFIXE}/notifications/toutes-lues`,
    undefined,
    { authentifie: true },
  );

// ============================================================================
// Parrainage
// ============================================================================

export interface CodeParrainage {
  code: string;
  lien_invitation: string;
  nombre_filleuls: number;
  bonus_recus: number;
}

export const obtenirMonParrainage = () =>
  clientAPI.get<CodeParrainage>(`${PREFIXE}/parrainage`, { authentifie: true });
