import { clientAPI } from "./client_api";

// ---------- Types ----------

export interface ModulePermission {
  role_name: string;
  module_key: string;
  module_label: string | null;
  module_description: string | null;
  module_icon: string;
  is_enabled: boolean;
  is_read_only: boolean;
  updated_at: string | null;
}

export interface MatricePermissions {
  modules: ModulePermission[];
  total: number;
}

export interface ModulesRole {
  role: string;
  modules: ModulePermission[];
  total: number;
}

export interface ConfigUI {
  role: string;
  layout: string;
  modules: ModulePermission[];
}

export interface MiseAJourModulePayload {
  module_key: string;
  is_enabled?: boolean;
  is_read_only?: boolean;
}

export interface OverridesUtilisateurPayload {
  modules_overrides: Record<
    string,
    { is_enabled?: boolean; is_read_only?: boolean }
  >;
}

export interface OverridesUtilisateurResponse {
  utilisateur_id: string;
  modules_overrides: Record<string, unknown>;
  message: string;
}

// ---------- Endpoints ----------

export async function obtenirMatricePermissions(): Promise<MatricePermissions> {
  return clientAPI.get<MatricePermissions>("/api/v1/super-admin/ui-permissions", { authentifie: true });
}

export async function obtenirModulesRole(role: string): Promise<ModulesRole> {
  return clientAPI.get<ModulesRole>(`/api/v1/super-admin/ui-permissions/${role}`, { authentifie: true });
}

export async function mettreAJourModuleRole(role: string, payload: MiseAJourModulePayload): Promise<ModulePermission> {
  return clientAPI.put<ModulePermission>(`/api/v1/super-admin/ui-permissions/${role}`, payload, { authentifie: true });
}

export async function modifierOverridesUtilisateur(utilisateurId: string, payload: OverridesUtilisateurPayload): Promise<OverridesUtilisateurResponse> {
  return clientAPI.post<OverridesUtilisateurResponse>(`/api/v1/super-admin/ui-permissions/utilisateurs/${utilisateurId}/overrides`, payload, { authentifie: true });
}

export async function obtenirConfigUI(): Promise<ConfigUI> {
  return clientAPI.get<ConfigUI>("/api/v1/auth/me/ui-config", { authentifie: true });
}

// ---------- Utilitaires ----------

export function modulesParDefaut(role: string): ModulePermission[] {
  const aliases: Record<string, string> = {
    agent: "agent_terrain",
    medecin: "agent_medical",
    police: "agent_police",
    ong: "agent_ong",
  };
  const roleCanonique = aliases[role] || role;

  const modulesParRole: Record<string, ModulePermission[]> = {
    super_administrateur: [
      { role_name: "super_administrateur", module_key: "gestion_roles", module_label: "Gestion des rôles", module_description: null, module_icon: "shield", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "super_administrateur", module_key: "matrice_droits_ui", module_label: "Matrice des droits UI", module_description: null, module_icon: "grid", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "super_administrateur", module_key: "audit_logs", module_label: "Journal d'audit", module_description: null, module_icon: "file-text", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "super_administrateur", module_key: "config_systeme", module_label: "Configuration système", module_description: null, module_icon: "settings", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "super_administrateur", module_key: "gestion_utilisateurs", module_label: "Gestion des utilisateurs", module_description: null, module_icon: "users", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "super_administrateur", module_key: "statistiques_globales", module_label: "Statistiques globales", module_description: null, module_icon: "bar-chart", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "super_administrateur", module_key: "monitoring_temps_reel", module_label: "Monitoring temps réel", module_description: null, module_icon: "activity", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "super_administrateur", module_key: "gestion_admins", module_label: "Gestion des admins", module_description: null, module_icon: "user-plus", is_enabled: true, is_read_only: false, updated_at: null },
    ],
    administrateur: [
      { role_name: "administrateur", module_key: "gestion_utilisateurs_admin", module_label: "Gestion utilisateurs", module_description: null, module_icon: "users", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "administrateur", module_key: "matrice_droits", module_label: "Matrice des droits", module_description: null, module_icon: "grid", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "administrateur", module_key: "audit_logs_admin", module_label: "Journal d'audit", module_description: null, module_icon: "file-text", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "administrateur", module_key: "statistiques_admin", module_label: "Statistiques", module_description: null, module_icon: "bar-chart", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "administrateur", module_key: "alertes_securite", module_label: "Alertes sécurité", module_description: null, module_icon: "alert-triangle", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "administrateur", module_key: "mon_profil_admin", module_label: "Mon profil admin", module_description: null, module_icon: "user", is_enabled: true, is_read_only: true, updated_at: null },
    ],
    citoyen: [
      { role_name: "citoyen", module_key: "mon_profil", module_label: "Mon profil", module_description: null, module_icon: "user", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "citoyen", module_key: "mes_attestations", module_label: "Mes attestations", module_description: null, module_icon: "award", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "citoyen", module_key: "mon_score", module_label: "Mon score", module_description: null, module_icon: "trending-up", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "citoyen", module_key: "mes_documents", module_label: "Mes documents", module_description: null, module_icon: "file", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "citoyen", module_key: "historique_acces", module_label: "Historique d'accès", module_description: null, module_icon: "clock", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "citoyen", module_key: "verification_cni", module_label: "Vérification CNI", module_description: null, module_icon: "credit-card", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "citoyen", module_key: "verification_faciale", module_label: "Vérification faciale", module_description: null, module_icon: "camera", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "citoyen", module_key: "consentements", module_label: "Mes consentements", module_description: null, module_icon: "check-square", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "citoyen", module_key: "chatbot", module_label: "Assistant DigiID", module_description: null, module_icon: "message-circle", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "citoyen", module_key: "badges", module_label: "Mes badges", module_description: null, module_icon: "award", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "citoyen", module_key: "parrainage", module_label: "Mon parrainage", module_description: null, module_icon: "share-2", is_enabled: true, is_read_only: false, updated_at: null },
    ],
    agent_terrain: [
      { role_name: "agent_terrain", module_key: "enrolement_citoyen", module_label: "Enrôlement citoyen", module_description: null, module_icon: "user-plus", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "agent_terrain", module_key: "scan_ocr_cni", module_label: "Scan OCR CNI", module_description: null, module_icon: "scan", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "agent_terrain", module_key: "capture_biometrique", module_label: "Capture biométrique", module_description: null, module_icon: "fingerprint", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "agent_terrain", module_key: "liste_enrollements", module_label: "Liste des enrôlements", module_description: null, module_icon: "list", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "agent_terrain", module_key: "recherche_citoyen", module_label: "Recherche citoyen", module_description: null, module_icon: "search", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "agent_terrain", module_key: "stats_enrolement", module_label: "Statistiques enrôlement", module_description: null, module_icon: "bar-chart", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "agent_terrain", module_key: "mon_profil_agent", module_label: "Mon profil agent", module_description: null, module_icon: "user", is_enabled: true, is_read_only: true, updated_at: null },
    ],
    agent_medical: [
      { role_name: "agent_medical", module_key: "creation_dossier", module_label: "Création dossier médical", module_description: null, module_icon: "file-plus", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "agent_medical", module_key: "suivi_dossier", module_label: "Suivi des dossiers", module_description: null, module_icon: "folder", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "agent_medical", module_key: "recherche_patient", module_label: "Recherche patient", module_description: null, module_icon: "search", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "agent_medical", module_key: "attestations_medicales", module_label: "Attestations médicales", module_description: null, module_icon: "file-text", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "agent_medical", module_key: "historique_consultations", module_label: "Historique consultations", module_description: null, module_icon: "clock", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "agent_medical", module_key: "ordonnances", module_label: "Ordonnances", module_description: null, module_icon: "file", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "agent_medical", module_key: "calendrier_rendezvous", module_label: "Calendrier rendez-vous", module_description: null, module_icon: "calendar", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "agent_medical", module_key: "mon_profil_agent", module_label: "Mon profil agent", module_description: null, module_icon: "user", is_enabled: true, is_read_only: true, updated_at: null },
    ],
    agent_police: [
      { role_name: "agent_police", module_key: "verification_identite", module_label: "Vérification d'identité", module_description: null, module_icon: "search", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "agent_police", module_key: "consultation_score", module_label: "Consultation score", module_description: null, module_icon: "trending-up", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "agent_police", module_key: "recherche_personne", module_label: "Recherche personne", module_description: null, module_icon: "fingerprint", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "agent_police", module_key: "audit_acces_police", module_label: "Audit accès police", module_description: null, module_icon: "clock", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "agent_police", module_key: "signalement_fraude", module_label: "Signalement fraude", module_description: null, module_icon: "alert-triangle", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "agent_police", module_key: "mon_profil_agent", module_label: "Mon profil agent", module_description: null, module_icon: "user", is_enabled: true, is_read_only: true, updated_at: null },
    ],
    agent_ong: [
      { role_name: "agent_ong", module_key: "consultation_beneficiaires", module_label: "Bénéficiaires", module_description: null, module_icon: "users", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "agent_ong", module_key: "attestations_communautaires", module_label: "Attestations communautaires", module_description: null, module_icon: "award", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "agent_ong", module_key: "rapports_terrain", module_label: "Rapports terrain", module_description: null, module_icon: "file-text", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "agent_ong", module_key: "gestion_programme", module_label: "Gestion programme", module_description: null, module_icon: "bar-chart", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "agent_ong", module_key: "mon_profil_agent", module_label: "Mon profil agent", module_description: null, module_icon: "user", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "agent_ong", module_key: "statistiques_ong", module_label: "Statistiques ONG", module_description: null, module_icon: "pie-chart", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "agent_ong", module_key: "calendrier_missions", module_label: "Calendrier missions", module_description: null, module_icon: "calendar", is_enabled: true, is_read_only: false, updated_at: null },
    ],
    chef_police: [
      { role_name: "chef_police", module_key: "gestion_equipe", module_label: "Gestion équipe", module_description: null, module_icon: "users", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "chef_police", module_key: "statistiques_chef", module_label: "Statistiques", module_description: null, module_icon: "bar-chart", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "chef_police", module_key: "audit_equipe", module_label: "Audit équipe", module_description: null, module_icon: "clock", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "chef_police", module_key: "gestion_missions", module_label: "Missions", module_description: null, module_icon: "target", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "chef_police", module_key: "invitations", module_label: "Invitations", module_description: null, module_icon: "mail", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "chef_police", module_key: "rapports_chef", module_label: "Rapports", module_description: null, module_icon: "file-text", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "chef_police", module_key: "recherche_chef", module_label: "Recherche", module_description: null, module_icon: "search", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "chef_police", module_key: "mon_profil_chef", module_label: "Mon profil", module_description: null, module_icon: "user", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "chef_police", module_key: "programmes", module_label: "Programmes", module_description: null, module_icon: "bookmark", is_enabled: true, is_read_only: false, updated_at: null },
    ],
    chef_medical: [
      { role_name: "chef_medical", module_key: "gestion_equipe", module_label: "Gestion équipe", module_description: null, module_icon: "users", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "chef_medical", module_key: "statistiques_chef", module_label: "Statistiques", module_description: null, module_icon: "bar-chart", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "chef_medical", module_key: "audit_equipe", module_label: "Audit équipe", module_description: null, module_icon: "clock", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "chef_medical", module_key: "gestion_missions", module_label: "Missions", module_description: null, module_icon: "target", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "chef_medical", module_key: "invitations", module_label: "Invitations", module_description: null, module_icon: "mail", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "chef_medical", module_key: "rapports_chef", module_label: "Rapports", module_description: null, module_icon: "file-text", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "chef_medical", module_key: "recherche_chef", module_label: "Recherche", module_description: null, module_icon: "search", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "chef_medical", module_key: "mon_profil_chef", module_label: "Mon profil", module_description: null, module_icon: "user", is_enabled: true, is_read_only: true, updated_at: null },
    ],
    chef_ong: [
      { role_name: "chef_ong", module_key: "gestion_equipe", module_label: "Gestion équipe", module_description: null, module_icon: "users", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "chef_ong", module_key: "statistiques_chef", module_label: "Statistiques", module_description: null, module_icon: "bar-chart", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "chef_ong", module_key: "audit_equipe", module_label: "Audit équipe", module_description: null, module_icon: "clock", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "chef_ong", module_key: "gestion_missions", module_label: "Missions", module_description: null, module_icon: "target", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "chef_ong", module_key: "invitations", module_label: "Invitations", module_description: null, module_icon: "mail", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "chef_ong", module_key: "rapports_chef", module_label: "Rapports", module_description: null, module_icon: "file-text", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "chef_ong", module_key: "recherche_chef", module_label: "Recherche", module_description: null, module_icon: "search", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "chef_ong", module_key: "mon_profil_chef", module_label: "Mon profil", module_description: null, module_icon: "user", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "chef_ong", module_key: "programmes", module_label: "Programmes", module_description: null, module_icon: "bookmark", is_enabled: true, is_read_only: false, updated_at: null },
    ],
    chef_agent: [
      { role_name: "chef_agent", module_key: "gestion_equipe", module_label: "Gestion équipe", module_description: null, module_icon: "users", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "chef_agent", module_key: "statistiques_chef", module_label: "Statistiques", module_description: null, module_icon: "bar-chart", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "chef_agent", module_key: "audit_equipe", module_label: "Audit équipe", module_description: null, module_icon: "clock", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "chef_agent", module_key: "invitations", module_label: "Invitations", module_description: null, module_icon: "mail", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "chef_agent", module_key: "rapports_chef", module_label: "Rapports", module_description: null, module_icon: "file-text", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "chef_agent", module_key: "recherche_chef", module_label: "Recherche", module_description: null, module_icon: "search", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "chef_agent", module_key: "mon_profil_chef", module_label: "Mon profil", module_description: null, module_icon: "user", is_enabled: true, is_read_only: true, updated_at: null },
    ],
  };

  return modulesParRole[roleCanonique] || [];
}