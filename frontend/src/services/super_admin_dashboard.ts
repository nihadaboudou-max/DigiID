/**
 * Service super admin dashboard — récupération et gestion des données du tableau de bord.
 * Branché sur /api/v1/super-admin/tableau-de-bord
 */
import { clientAPI } from "./client_api";

export interface EvenementAudit {
  id: string;
  date: string;
  type: string;
  description: string;
  utilisateur: string | null;
  ip: string | null;
}

export interface SantéSystème {
  total_utilisateurs: number;
  utilisateurs_actifs: number;
  utilisateurs_2fa: number;
  emails_verifies: number;
  audits_aujourd_hui: number;
}

export interface DonneesSuperAdmin {
  message: string;
  configuration: Record<string, string | boolean>;
  santé_système: SantéSystème;
  repartition_roles: Record<string, number>;
  derniers_evenements_audit: EvenementAudit[];
}

/**
 * Récupère l'intégralité des données du tableau de bord super admin.
 * Requiert l'authentification en tant que super administrateur.
 */
export const obtenirTableauDeBord = () =>
  clientAPI.get<DonneesSuperAdmin>("/api/v1/super-admin/tableau-de-bord", {
    authentifie: true,
  });

/**
 * Calcule le pourcentage de 2FA activé.
 */
export const calculerPourcentage2FA = (santé: SantéSystème): number => {
  if (santé.total_utilisateurs === 0) return 0;
  return Math.round((santé.utilisateurs_2fa / santé.total_utilisateurs) * 100);
};

/**
 * Calcule le pourcentage d'emails vérifiés.
 */
export const calculerPourcentageEmailsVerifies = (santé: SantéSystème): number => {
  if (santé.total_utilisateurs === 0) return 0;
  return Math.round((santé.emails_verifies / santé.total_utilisateurs) * 100);
};

/**
 * Récupère l'état de santé global du système (vert, orange, rouge).
 */
export const obtenirEtatSanté = (santé: SantéSystème): "vert" | "orange" | "rouge" => {
  const pourcentage2FA = calculerPourcentage2FA(santé);
  const pourcentageEmails = calculerPourcentageEmailsVerifies(santé);

  // Rouge si moins de 80% de protection globale
  if (pourcentage2FA < 50 || pourcentageEmails < 80) return "rouge";
  // Orange si moins de 90%
  if (pourcentage2FA < 80 || pourcentageEmails < 95) return "orange";
  // Vert sinon
  return "vert";
};
