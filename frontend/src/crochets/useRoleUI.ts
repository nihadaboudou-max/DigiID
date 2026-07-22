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
 *   const { can, modules, layout, chargement } = useRoleUI();
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
  /** Modules Super Admin / Admin */
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

  /** Modules Agent Terrain */
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
  /** Erreur bloquante (aucun module disponible). */
  erreur: string | null;
  /** Avertissement soft (fallback local appliqué, pages utilisables). */
  avertissement: string | null;
  role: string;
}

/** Anciens noms de rôles encore présents en base / seeds. */
const ALIAS_ROLES: Record<string, string> = {
  agent: "agent_terrain",
  medecin: "agent_medical",
  police: "agent_police",
  ong: "agent_ong",
};

function normaliserRole(role: string): string {
  return ALIAS_ROLES[role] || role;
}

// ---------- Mapping module_key → clé can ----------
// Ce mapping correspond EXACTEMENT aux clés définies dans service.py (MODULES_PAR_DEFAUT)

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

  // Administrateur
  gestion_utilisateurs_admin: "manageUsers",
  matrice_droits: "manageUIMatrix",
  audit_logs_admin: "viewAuditLogs",
  statistiques_admin: "viewGlobalStats",
  alertes_securite: "viewAuditLogs",
  mon_profil_admin: "viewProfile",

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

  // Agent Terrain (Correspondance exacte + tolérance orthographique pour la BDD)
  enrolement_citoyen: "enroll",       // Orthographe correcte (1 'l') - Backend
  enrollement_citoyen: "enroll",      // Tolérance en cas de faute de frappe en BDD (2 'l')
  scan_ocr_cni: "scanCNI",
  capture_biometrique: "captureBiometrics",
  liste_enrollements: "viewEnrollments",
  recherche_citoyen: "searchCitizen",
  stats_enrolement: "viewEnrollmentStats",
  mon_profil_agent: "viewProfile",

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

  // Rôles Chef (mappés sur les actions génériques correspondantes)
  gestion_equipe: "manageUsers",
  statistiques_chef: "viewGlobalStats",
  audit_equipe: "viewAuditLogs",
  gestion_missions: "manageMissions",
  invitations: "manageUsers",
  rapports_chef: "viewFieldReports",
  recherche_chef: "searchPerson",
  mon_profil_chef: "viewProfile",
  programmes: "manageProgram",
};

// ---------- Hook ----------

export function useRoleUI(): UseRoleUIReturn {
  const { utilisateur, estConnecte } = useAuthentification();
  const [modules, setModules] = useState<ModulePermission[]>([]);
  const [layout, setLayout] = useState<string>("default");
  const [chargement, setChargement] = useState<boolean>(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [avertissement, setAvertissement] = useState<string | null>(null);
  
  // Indique si un chargement a déjà été tenté (évite les boucles infinies)
  const chargementEffectueRef = useRef(false);

  // Récupère la config UI de l'utilisateur
  const chargerConfig = useCallback(async () => {
    if (!estConnecte || !utilisateur) return;

    const roleCanonique = normaliserRole(utilisateur.role);
    setChargement(true);
    setErreur(null);
    setAvertissement(null);

    try {
      const config = await obtenirConfigUI();
      let mods = config.modules || [];

      // Réponse vide (table absente / rôle mal seedé) → fallback local
      if (mods.length === 0) {
        const fallback = modulesParDefaut(roleCanonique);
        if (fallback.length > 0) {
          mods = fallback;
          setAvertissement("Configuration UI vide : modules par défaut appliqués");
        }
      }

      setModules(mods);
      setLayout(config.layout || "default");
    } catch (err) {
      console.warn("⚠️ Erreur de chargement UI, utilisation du fallback:", err);
      const fallback = modulesParDefaut(roleCanonique);
      setModules(fallback);
      setLayout("default");
      if (fallback.length === 0) {
        setErreur("Impossible de charger la configuration UI pour ce rôle.");
      } else {
        // Soft : les pages restent utilisables avec le fallback
        setAvertissement("Mode hors-ligne : configuration UI par défaut appliquée");
      }
    } finally {
      setChargement(false);
      chargementEffectueRef.current = true;
    }
  }, [estConnecte, utilisateur]);

  // Charger la config dès que l'utilisateur est connecté
  useEffect(() => {
    if (estConnecte && utilisateur && !chargementEffectueRef.current) {
      chargerConfig();
    }
    
    // Réinitialiser quand l'utilisateur change (déconnexion/reconnexion)
    if (!estConnecte || !utilisateur) {
      chargementEffectueRef.current = false;
      setModules([]);
      setLayout("default");
      setChargement(false);
      setErreur(null);
      setAvertissement(null);
    }
  }, [estConnecte, utilisateur, chargerConfig]);

  // Construire l'objet can de manière optimisée
  const can = useMemo<CanActions>(() => {
    // 1. Initialiser toutes les actions à false
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
        return modules.some((m) => m.module_key === moduleKey && m.is_enabled);
      },
    };

    // 2. Activer chaque module trouvé dans la réponse API (ou le fallback)
    for (const mod of modules) {
      if (!mod.is_enabled) continue;
      
      const canKey = MODULE_TO_CAN_KEY[mod.module_key];
      if (canKey) {
        // CORRECTION TS : Conversion via 'unknown' pour satisfaire le compilateur strict
        (actions as unknown as Record<string, boolean>)[canKey] = true;
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
    avertissement,
    role: utilisateur?.role || "",
  };
}

export default useRoleUI;