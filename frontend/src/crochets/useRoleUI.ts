/**
 * Hook useRoleUI — Configuration UI dynamique par rôle.
 *
 * Charge la configuration UI de l'utilisateur connecté via
 * GET /api/v1/auth/me/ui-config et expose :
 *   - modules : liste des modules accessibles avec leur statut
 *   - can : objet avec des helpers booléens (ex: can.createMedicalRecord)
 *   - layout : le layout préféré (default, compact, etc.)
 *   - chargement : état de chargement
 *   - erreur : erreur éventuelle
 *
 * Utilisation :
 *   const { can, modules, layout } = useRoleUI();
 *   if (can.createMedicalRecord) { ... }
 *   if (can.enroll) { ... }
 */
"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useAuthentification } from "@/contextes/authentification";
import { obtenirConfigUI, modulesParDefaut } from "@/services/ui_permissions";
import type { ModulePermission } from "@/services/ui_permissions";

// ---------- Types ----------

export interface CanActions {
  /** Modules Super Admin */
  manageRoles: boolean;
  manageUIMatrix: boolean;
  viewAuditLogs: boolean;
  configureSystem: boolean;
  manageUsers: boolean;
  viewGlobalStats: boolean;
  monitorRealtime: boolean;
  manageAdmins: boolean;

  /** Modules Citoyen */
  viewProfile: boolean;
  viewAttestations: boolean;
  viewScore: boolean;
  viewDocuments: boolean;
  viewAccessHistory: boolean;
  verifyCNI: boolean;
  verifyFace: boolean;
  manageConsent: boolean;
  useChatbot: boolean;
  viewBadges: boolean;
  manageReferral: boolean;

  /** Modules Agent */
  enroll: boolean;
  scanCNI: boolean;
  captureBiometrics: boolean;
  viewEnrollments: boolean;
  searchCitizen: boolean;
  viewEnrollmentStats: boolean;

  /** Modules Médecin */
  createMedicalRecord: boolean;
  viewMedicalRecords: boolean;
  searchPatient: boolean;
  manageMedicalAttestations: boolean;
  viewConsultationHistory: boolean;
  managePrescriptions: boolean;
  manageAppointments: boolean;

  /** Modules Police */
  verifyIdentity: boolean;
  viewScoreInfo: boolean;
  searchPerson: boolean;
  viewPoliceAudit: boolean;
  reportFraud: boolean;

  /** Modules ONG */
  viewBeneficiaries: boolean;
  manageCommunityAttestations: boolean;
  viewFieldReports: boolean;
  manageProgram: boolean;
  viewONGStats: boolean;
  manageMissions: boolean;

  /** Helper générique — vérifier par module_key */
  hasModule: (moduleKey: string) => boolean;
}

export interface UseRoleUIReturn {
  modules: ModulePermission[];
  can: CanActions;
  layout: string;
  chargement: boolean;
  erreur: string | null;
  role: string;
}

// ---------- Mapping module_key → clé can ----------

const MODULE_TO_CAN_KEY: Record<string, keyof CanActions> = {
  // Super Admin
  gestion_roles: "manageRoles",
  matrice_droits_ui: "manageUIMatrix",
  audit_logs: "viewAuditLogs",
  config_systeme: "configureSystem",
  gestion_utilisateurs: "manageUsers",
  statistiques_globales: "viewGlobalStats",
  monitoring_temps_reel: "monitorRealtime",
  gestion_admins: "manageAdmins",

  // Citoyen
  mon_profil: "viewProfile",
  mes_attestations: "viewAttestations",
  mon_score: "viewScore",
  mes_documents: "viewDocuments",
  historique_acces: "viewAccessHistory",
  verification_cni: "verifyCNI",
  verification_faciale: "verifyFace",
  consentements: "manageConsent",
  chatbot: "useChatbot",
  badges: "viewBadges",
  parrainage: "manageReferral",

  // Agent
  enrolement_citoyen: "enroll",
  scan_ocr_cni: "scanCNI",
  capture_biometrique: "captureBiometrics",
  liste_enrollements: "viewEnrollments",
  recherche_citoyen: "searchCitizen",
  stats_enrolement: "viewEnrollmentStats",

  // Médecin
  creation_dossier: "createMedicalRecord",
  suivi_dossier: "viewMedicalRecords",
  recherche_patient: "searchPatient",
  attestations_medicales: "manageMedicalAttestations",
  historique_consultations: "viewConsultationHistory",
  ordonnances: "managePrescriptions",
  calendrier_rendezvous: "manageAppointments",

  // Police
  verification_identite: "verifyIdentity",
  consultation_score: "viewScoreInfo",
  recherche_personne: "searchPerson",
  audit_acces_police: "viewPoliceAudit",
  signalement_fraude: "reportFraud",

  // ONG
  consultation_beneficiaires: "viewBeneficiaries",
  attestations_communautaires: "manageCommunityAttestations",
  rapports_terrain: "viewFieldReports",
  gestion_programme: "manageProgram",
  statistiques_ong: "viewONGStats",
  calendrier_missions: "manageMissions",
};

// ---------- Hook ----------

export function useRoleUI(): UseRoleUIReturn {
  const { utilisateur, estConnecte } = useAuthentification();
  const [modules, setModules] = useState<ModulePermission[]>([]);
  const [layout, setLayout] = useState<string>("default");
  const [chargement, setChargement] = useState<boolean>(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const dernierTokenRef = useRef<string | null>(null);

  // Récupère la config UI de l'utilisateur
  const chargerConfig = useCallback(async () => {
    if (!estConnecte || !utilisateur) {
      setModules([]);
      setLayout("default");
      setChargement(false);
      return;
    }

    setChargement(true);
    setErreur(null);

    try {
      const config = await obtenirConfigUI();
      setModules(config.modules || []);
      setLayout(config.layout || "default");
    } catch {
      // Fallback : utiliser les modules par défaut du rôle
      const fallback = modulesParDefaut(utilisateur.role);
      setModules(fallback);
      setLayout("default");
      setErreur("Mode hors-ligne : configuration UI non disponible");
    } finally {
      setChargement(false);
    }
  }, [estConnecte, utilisateur]);

  // Re-fetcher si le token change
  useEffect(() => {
    const token = localStorage.getItem("token_acces");
    if (token !== dernierTokenRef.current) {
      dernierTokenRef.current = token;
      chargerConfig();
    }
  }, [chargerConfig]);

  // Construire l'objet can
  const can = useMemo<CanActions>(() => {
    // Initialiser toutes les actions à false
    const actions: CanActions = {
      manageRoles: false,
      manageUIMatrix: false,
      viewAuditLogs: false,
      configureSystem: false,
      manageUsers: false,
      viewGlobalStats: false,
      monitorRealtime: false,
      manageAdmins: false,
      viewProfile: false,
      viewAttestations: false,
      viewScore: false,
      viewDocuments: false,
      viewAccessHistory: false,
      verifyCNI: false,
      verifyFace: false,
      manageConsent: false,
      useChatbot: false,
      viewBadges: false,
      manageReferral: false,
      enroll: false,
      scanCNI: false,
      captureBiometrics: false,
      viewEnrollments: false,
      searchCitizen: false,
      viewEnrollmentStats: false,
      createMedicalRecord: false,
      viewMedicalRecords: false,
      searchPatient: false,
      manageMedicalAttestations: false,
      viewConsultationHistory: false,
      managePrescriptions: false,
      manageAppointments: false,
      verifyIdentity: false,
      viewScoreInfo: false,
      searchPerson: false,
      viewPoliceAudit: false,
      reportFraud: false,
      viewBeneficiaries: false,
      manageCommunityAttestations: false,
      viewFieldReports: false,
      manageProgram: false,
      viewONGStats: false,
      manageMissions: false,
      hasModule: (moduleKey: string) => {
        return modules.some(
          (m) => m.module_key === moduleKey && m.is_enabled
        );
      },
    };

    // Activer chaque module trouvé
    for (const mod of modules) {
      if (!mod.is_enabled) continue;
      const canKey = MODULE_TO_CAN_KEY[mod.module_key];
      if (canKey) {
        (actions as unknown as Record<string, unknown>)[canKey] = true;
      }
    }

    return actions;
  }, [modules]);

  return {
    modules,
    can,
    layout,
    chargement,
    erreur,
    role: utilisateur?.role || "",
  };
}

export default useRoleUI;
