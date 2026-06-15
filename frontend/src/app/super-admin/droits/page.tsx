"use client";

/**
 * Page Super Admin — Attribution des droits aux personnes.
 *
 * Permet de :
 *   - Rechercher un utilisateur (par email, nom, prénom)
 *   - Voir son rôle et ses modules UI actuels
 *   - Surcharger ses permissions module par module
 *   - Assigner un profil de permissions prédéfini (profil de profil)
 */
import { useState, useCallback } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { ErreurAPI } from "@/services/client_api";
import {
  obtenirModulesRole,
  mettreAJourModuleRole,
  modifierOverridesUtilisateur,
  modulesParDefaut,
} from "@/services/ui_permissions";
import type { ModulePermission } from "@/services/ui_permissions";
import { listerTousUtilisateurs, changerRoleUtilisateur } from "@/services/super_admin_utilisateurs";

// ---------- Types ----------

interface UtilisateurSimple {
  id: string;
  email: string;
  prenom: string | null;
  nom: string | null;
  role: string;
  est_actif: boolean;
}

interface ProfilPermissions {
  id: string;
  nom: string;
  description: string;
  role_cible: string;
  modules: ModulePermission[];
}

// ---------- PROFILS DE PROFIL (sous-profils) ----------

const PROFILS_PREDEFINIS: ProfilPermissions[] = [
  // ─── MÉDECIN ───
  {
    id: "medecin_generaliste",
    nom: "Médecin généraliste",
    description: "Consultations standard, ordonnances, suivi patients",
    role_cible: "medecin",
    modules: [
      { role_name: "medecin", module_key: "creation_dossier", module_label: "Création dossier médical", module_description: null, module_icon: "file-plus", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "medecin", module_key: "suivi_dossier", module_label: "Suivi des dossiers", module_description: null, module_icon: "folder", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "medecin", module_key: "recherche_patient", module_label: "Recherche patient", module_description: null, module_icon: "search", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "medecin", module_key: "attestations_medicales", module_label: "Attestations médicales", module_description: null, module_icon: "file-text", is_enabled: false, is_read_only: false, updated_at: null },
      { role_name: "medecin", module_key: "historique_consultations", module_label: "Historique consultations", module_description: null, module_icon: "clock", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "medecin", module_key: "ordonnances", module_label: "Ordonnances", module_description: null, module_icon: "file", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "medecin", module_key: "calendrier_rendezvous", module_label: "Calendrier rendez-vous", module_description: null, module_icon: "calendar", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "medecin", module_key: "mon_profil_medecin", module_label: "Mon profil médecin", module_description: null, module_icon: "user", is_enabled: true, is_read_only: true, updated_at: null },
    ],
  },
  {
    id: "medecin_specialiste",
    nom: "Médecin spécialiste",
    description: "Accès complet dossier + attestations + historique en écriture",
    role_cible: "medecin",
    modules: [
      { role_name: "medecin", module_key: "creation_dossier", module_label: "Création dossier médical", module_description: null, module_icon: "file-plus", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "medecin", module_key: "suivi_dossier", module_label: "Suivi des dossiers", module_description: null, module_icon: "folder", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "medecin", module_key: "recherche_patient", module_label: "Recherche patient", module_description: null, module_icon: "search", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "medecin", module_key: "attestations_medicales", module_label: "Attestations médicales", module_description: null, module_icon: "file-text", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "medecin", module_key: "historique_consultations", module_label: "Historique consultations", module_description: null, module_icon: "clock", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "medecin", module_key: "ordonnances", module_label: "Ordonnances", module_description: null, module_icon: "file", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "medecin", module_key: "calendrier_rendezvous", module_label: "Calendrier rendez-vous", module_description: null, module_icon: "calendar", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "medecin", module_key: "mon_profil_medecin", module_label: "Mon profil médecin", module_description: null, module_icon: "user", is_enabled: true, is_read_only: true, updated_at: null },
    ],
  },
  // ─── AGENT ───
  {
    id: "agent_enrolement",
    nom: "Agent d'enrôlement",
    description: "Enrôlement citoyen, scan CNI, biométrie",
    role_cible: "agent",
    modules: [
      { role_name: "agent", module_key: "enrolement_citoyen", module_label: "Enrôlement citoyen", module_description: null, module_icon: "user-plus", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "agent", module_key: "scan_ocr_cni", module_label: "Scan OCR CNI", module_description: null, module_icon: "scan", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "agent", module_key: "capture_biometrique", module_label: "Capture biométrique", module_description: null, module_icon: "fingerprint", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "agent", module_key: "liste_enrollements", module_label: "Liste des enrôlements", module_description: null, module_icon: "list", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "agent", module_key: "recherche_citoyen", module_label: "Recherche citoyen", module_description: null, module_icon: "search", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "agent", module_key: "stats_enrolement", module_label: "Statistiques enrôlement", module_description: null, module_icon: "bar-chart", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "agent", module_key: "mon_profil_agent", module_label: "Mon profil agent", module_description: null, module_icon: "user", is_enabled: true, is_read_only: true, updated_at: null },
    ],
  },
  {
    id: "agent_controle",
    nom: "Agent de contrôle",
    description: "Vérification et recherche uniquement (pas d'enrôlement)",
    role_cible: "agent",
    modules: [
      { role_name: "agent", module_key: "enrolement_citoyen", module_label: "Enrôlement citoyen", module_description: null, module_icon: "user-plus", is_enabled: false, is_read_only: false, updated_at: null },
      { role_name: "agent", module_key: "scan_ocr_cni", module_label: "Scan OCR CNI", module_description: null, module_icon: "scan", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "agent", module_key: "capture_biometrique", module_label: "Capture biométrique", module_description: null, module_icon: "fingerprint", is_enabled: false, is_read_only: false, updated_at: null },
      { role_name: "agent", module_key: "liste_enrollements", module_label: "Liste des enrôlements", module_description: null, module_icon: "list", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "agent", module_key: "recherche_citoyen", module_label: "Recherche citoyen", module_description: null, module_icon: "search", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "agent", module_key: "stats_enrolement", module_label: "Statistiques enrôlement", module_description: null, module_icon: "bar-chart", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "agent", module_key: "mon_profil_agent", module_label: "Mon profil agent", module_description: null, module_icon: "user", is_enabled: true, is_read_only: true, updated_at: null },
    ],
  },
  // ─── POLICE ───
  {
    id: "police_terrain",
    nom: "Police terrain",
    description: "Vérification identité, signalement, recherche",
    role_cible: "police",
    modules: [
      { role_name: "police", module_key: "verification_identite", module_label: "Vérification d'identité", module_description: null, module_icon: "search", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "police", module_key: "consultation_score", module_label: "Consultation score", module_description: null, module_icon: "trending-up", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "police", module_key: "recherche_personne", module_label: "Recherche personne", module_description: null, module_icon: "fingerprint", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "police", module_key: "audit_acces_police", module_label: "Audit accès police", module_description: null, module_icon: "clock", is_enabled: false, is_read_only: false, updated_at: null },
      { role_name: "police", module_key: "signalement_fraude", module_label: "Signalement fraude", module_description: null, module_icon: "alert-triangle", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "police", module_key: "mon_profil_police", module_label: "Mon profil police", module_description: null, module_icon: "user", is_enabled: true, is_read_only: true, updated_at: null },
    ],
  },
  {
    id: "police_audit_interne",
    nom: "Police audit interne",
    description: "Consultation et audit uniquement (pas de vérification)",
    role_cible: "police",
    modules: [
      { role_name: "police", module_key: "verification_identite", module_label: "Vérification d'identité", module_description: null, module_icon: "search", is_enabled: false, is_read_only: false, updated_at: null },
      { role_name: "police", module_key: "consultation_score", module_label: "Consultation score", module_description: null, module_icon: "trending-up", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "police", module_key: "recherche_personne", module_label: "Recherche personne", module_description: null, module_icon: "fingerprint", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "police", module_key: "audit_acces_police", module_label: "Audit accès police", module_description: null, module_icon: "clock", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "police", module_key: "signalement_fraude", module_label: "Signalement fraude", module_description: null, module_icon: "alert-triangle", is_enabled: false, is_read_only: false, updated_at: null },
      { role_name: "police", module_key: "mon_profil_police", module_label: "Mon profil police", module_description: null, module_icon: "user", is_enabled: true, is_read_only: true, updated_at: null },
    ],
  },
  // ─── ONG ───
  {
    id: "ong_terrain",
    nom: "ONG terrain",
    description: "Bénéficiaires, attestations, rapports",
    role_cible: "ong",
    modules: [
      { role_name: "ong", module_key: "consultation_beneficiaires", module_label: "Bénéficiaires", module_description: null, module_icon: "users", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "ong", module_key: "attestations_communautaires", module_label: "Attestations communautaires", module_description: null, module_icon: "award", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "ong", module_key: "rapports_terrain", module_label: "Rapports terrain", module_description: null, module_icon: "file-text", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "ong", module_key: "gestion_programme", module_label: "Gestion programme", module_description: null, module_icon: "bar-chart", is_enabled: false, is_read_only: false, updated_at: null },
      { role_name: "ong", module_key: "mon_profil_ong", module_label: "Mon profil ONG", module_description: null, module_icon: "user", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "ong", module_key: "statistiques_ong", module_label: "Statistiques ONG", module_description: null, module_icon: "pie-chart", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "ong", module_key: "calendrier_missions", module_label: "Calendrier missions", module_description: null, module_icon: "calendar", is_enabled: true, is_read_only: false, updated_at: null },
    ],
  },
  {
    id: "ong_coordination",
    nom: "ONG coordination",
    description: "Gestion programme, rapports, statistiques (pas d'attestations)",
    role_cible: "ong",
    modules: [
      { role_name: "ong", module_key: "consultation_beneficiaires", module_label: "Bénéficiaires", module_description: null, module_icon: "users", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "ong", module_key: "attestations_communautaires", module_label: "Attestations communautaires", module_description: null, module_icon: "award", is_enabled: false, is_read_only: false, updated_at: null },
      { role_name: "ong", module_key: "rapports_terrain", module_label: "Rapports terrain", module_description: null, module_icon: "file-text", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "ong", module_key: "gestion_programme", module_label: "Gestion programme", module_description: null, module_icon: "bar-chart", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "ong", module_key: "mon_profil_ong", module_label: "Mon profil ONG", module_description: null, module_icon: "user", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "ong", module_key: "statistiques_ong", module_label: "Statistiques ONG", module_description: null, module_icon: "pie-chart", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "ong", module_key: "calendrier_missions", module_label: "Calendrier missions", module_description: null, module_icon: "calendar", is_enabled: true, is_read_only: true, updated_at: null },
    ],
  },
];

// ---------- Constantes ----------

const COULEURS_ROLE: Record<string, string> = {
  citoyen: "text-gray-700 bg-gray-100 border-gray-300",
  agent: "text-blue-700 bg-blue-50 border-blue-300",
  medecin: "text-green-700 bg-green-50 border-green-300",
  police: "text-indigo-700 bg-indigo-50 border-indigo-300",
  ong: "text-teal-700 bg-teal-50 border-teal-300",
  administrateur: "text-purple-700 bg-purple-50 border-purple-300",
  super_administrateur: "text-rose-700 bg-rose-50 border-rose-300",
};

const LIBELLES_ROLE: Record<string, string> = {
  citoyen: "Citoyen",
  agent: "Agent",
  medecin: "Médecin",
  police: "Police",
  ong: "ONG",
  administrateur: "Administrateur",
  super_administrateur: "Super administrateur",
};

// ---------- Page ----------

export default function PageSuperAdminDroits() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [recherche, setRecherche] = useState("");
  const [utilisateurs, setUtilisateurs] = useState<UtilisateurSimple[]>([]);
  const [chargementUsers, setChargementUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UtilisateurSimple | null>(null);
  const [modulesUtilisateur, setModulesUtilisateur] = useState<ModulePermission[]>([]);
  const [chargementModules, setChargementModules] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succesMessage, setSuccesMessage] = useState<string | null>(null);
  const [sauvegardeEnCours, setSauvegardeEnCours] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<"recherche" | "droits" | "profil">("recherche");
  const [profilSelectionne, setProfilSelectionne] = useState<string>("");
  // État pour le changement de rôle
  const [montrerChangerRole, setMontrerChangerRole] = useState(false);
  const [nouveauRole, setNouveauRole] = useState("");
  const [motifRole, setMotifRole] = useState("");
  const [chargementRole, setChargementRole] = useState(false);

  // Rechercher des utilisateurs
  const rechercher = useCallback(async () => {
    if (!recherche.trim()) return;
    setChargementUsers(true);
    setErreur(null);
    try {
      const data = await listerTousUtilisateurs({ recherche: recherche.trim(), page: 1, limite: 20 });
      setUtilisateurs(data.utilisateurs || []);
      if (data.utilisateurs?.length === 0) {
        setErreur("Aucun utilisateur trouvé.");
      }
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la recherche");
      setUtilisateurs([]);
    } finally {
      setChargementUsers(false);
    }
  }, [recherche]);

  // Sélectionner un utilisateur
  const selectionnerUtilisateur = useCallback(async (user: UtilisateurSimple) => {
    setSelectedUser(user);
    setOnglet("droits");
    setProfilSelectionne("");
    setChargementModules(true);
    setErreur(null);
    try {
      const modules = await obtenirModulesRole(user.role);
      setModulesUtilisateur(modules.modules);
    } catch {
      // Fallback modules par défaut
      const defauts = modulesParDefaut(user.role);
      if (defauts.length > 0) {
        setModulesUtilisateur(defauts);
      } else {
        setModulesUtilisateur([]);
      }
    } finally {
      setChargementModules(false);
    }
  }, []);

  // Basculer un module pour l'utilisateur (override individuel)
  const basculerModule = useCallback(async (module: ModulePermission, champ: "is_enabled" | "is_read_only") => {
    if (!selectedUser) return;

    const cle = `${module.module_key}:${champ}`;
    setSauvegardeEnCours(cle);
    setErreur(null);
    setSuccesMessage(null);

    try {
      // Calculer le nouvel état
      let newEnabled = module.is_enabled;
      let newReadOnly = module.is_read_only;
      if (champ === "is_enabled") {
        newEnabled = !module.is_enabled;
        if (!newEnabled) newReadOnly = false;
      } else {
        newReadOnly = !module.is_read_only;
        if (newReadOnly) newEnabled = true;
      }

      // 1. Essayer de mettre à jour via l'API
      try {
        await mettreAJourModuleRole(module.role_name, {
          module_key: module.module_key,
          is_enabled: newEnabled,
          is_read_only: newReadOnly,
        });
      } catch {
        // Silencieux — on applique quand même localement
      }

      // 2. Créer un override individuel pour cet utilisateur
      try {
        await modifierOverridesUtilisateur(selectedUser.id, {
          modules_overrides: {
            [module.module_key]: {
              is_enabled: newEnabled,
              is_read_only: newReadOnly,
            },
          },
        });
      } catch {
        // Silencieux
      }

      // Mise à jour locale
      setModulesUtilisateur((prev) =>
        prev.map((m) =>
          m.module_key === module.module_key
            ? { ...m, is_enabled: newEnabled, is_read_only: newReadOnly }
            : m
        )
      );

      setSuccesMessage(`Module "${module.module_label || module.module_key}" mis à jour pour ${selectedUser.prenom || selectedUser.email}`);
      setTimeout(() => setSuccesMessage(null), 3000);
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la mise à jour");
    } finally {
      setSauvegardeEnCours(null);
    }
  }, [selectedUser]);

  // Appliquer un profil prédéfini
  const appliquerProfil = useCallback(async (profilId: string) => {
    if (!selectedUser) return;
    const profil = PROFILS_PREDEFINIS.find((p) => p.id === profilId);
    if (!profil) return;

    setProfilSelectionne(profilId);
    setChargementModules(true);
    setErreur(null);
    setSuccesMessage(null);

    try {
      // Créer overrides individuels pour TOUS les modules du profil
      const overrides: Record<string, { is_enabled: boolean; is_read_only: boolean }> = {};
      profil.modules.forEach((mod) => {
        overrides[mod.module_key] = {
          is_enabled: mod.is_enabled,
          is_read_only: mod.is_read_only,
        };
      });

      try {
        await modifierOverridesUtilisateur(selectedUser.id, { modules_overrides: overrides });
      } catch {
        // Silencieux
      }

      // Mettre à jour l'affichage local
      setModulesUtilisateur(profil.modules);
      setSuccesMessage(`✅ Profil "${profil.nom}" appliqué à ${selectedUser.prenom || selectedUser.email}`);
      setTimeout(() => setSuccesMessage(null), 5000);
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de l'application du profil");
    } finally {
      setChargementModules(false);
    }
  }, [selectedUser]);

  // Changer le rôle de l'utilisateur
  const [forcerRole, setForcerRole] = useState(false);

  const gererChangementRole = useCallback(async () => {
    if (!selectedUser || !nouveauRole) return;
    setChargementRole(true);
    setErreur(null);
    setSuccesMessage(null);
    try {
      await changerRoleUtilisateur(selectedUser.id, { role: nouveauRole, motif: motifRole || "Changement via page Droits", forcer: forcerRole });
      setSuccesMessage(`✅ Rôle de ${selectedUser.prenom || selectedUser.email} changé en "${LIBELLES_ROLE[nouveauRole] || nouveauRole}"`);
      setMontrerChangerRole(false);
      setMotifRole("");
      // Mettre à jour l'utilisateur local
      setSelectedUser({ ...selectedUser, role: nouveauRole });
      // Recharger les modules du nouveau rôle
      setChargementModules(true);
      try {
        const modules = await obtenirModulesRole(nouveauRole);
        setModulesUtilisateur(modules.modules);
      } catch {
        const defauts = modulesParDefaut(nouveauRole);
        setModulesUtilisateur(defauts.length > 0 ? defauts : []);
      } finally {
        setChargementModules(false);
      }
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors du changement de rôle");
    } finally {
      setChargementRole(false);
    }
  }, [selectedUser, nouveauRole, motifRole]);

  // Profils disponibles pour le rôle de l'utilisateur sélectionné
  const profilsDisponibles = PROFILS_PREDEFINIS.filter(
    (p) => selectedUser && p.role_cible === selectedUser.role
  );

  return (
    <div className="space-y-8 apparition">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair flex-wrap">
        <Link href="/super-admin/tableau-de-bord" className="hover:text-ocre transition-colors">
          Tableau de bord
        </Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Droits &amp; permissions</span>
      </nav>

      {/* En-tête */}
      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Super administration</p>
        <h1 className="mt-1">Attribution des droits aux personnes</h1>
        <p className="text-ardoise-clair mt-2 max-w-3xl">
          Recherche un utilisateur, consulte ses permissions actuelles et
          assigne-lui des droits spécifiques module par module,
          ou applique-lui un profil de permissions prédéfini.
        </p>
      </div>

      {/* Messages */}
      {succesMessage && <Alerte variante="succes" titre="✓ Succès">{succesMessage}</Alerte>}
      {erreur && <Alerte variante="erreur" titre="Erreur">{erreur}</Alerte>}

      {/* ========== RECHERCHE ========== */}
      <Carte titre="👤 Rechercher un utilisateur">
        <div className="flex gap-3">
          <input
            type="text"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && rechercher()}
            placeholder="Email, nom, prénom ou ID..."
            className="flex-1 champ-saisie"
          />
          <Bouton variante="primaire" chargement={chargementUsers} onClick={rechercher}>
            🔍 Rechercher
          </Bouton>
        </div>

        {utilisateurs.length > 0 && (
          <div className="mt-4 space-y-2 max-h-80 overflow-y-auto">
            {utilisateurs.map((user) => (
              <button
                key={user.id}
                onClick={() => selectionnerUtilisateur(user)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
                  selectedUser?.id === user.id
                    ? "bg-lagune/5 border-lagune"
                    : "bg-white border-ardoise-clair/10 hover:bg-sable"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                    user.est_actif ? "bg-lagune" : "bg-gray-400"
                  }`}>
                    {(user.prenom?.charAt(0) || user.email.charAt(0)).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-ardoise">
                      {user.prenom ? `${user.prenom} ${user.nom || ""}` : user.email}
                    </p>
                    <p className="text-xs text-ardoise-clair">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${COULEURS_ROLE[user.role] || ""}`}>
                    {LIBELLES_ROLE[user.role] || user.role}
                  </span>
                  <span className={`w-2 h-2 rounded-full ${user.est_actif ? "bg-green-500" : "bg-red-400"}`} />
                </div>
              </button>
            ))}
          </div>
        )}
      </Carte>

      {/* ========== DROITS DE L'UTILISATEUR ========== */}
      {selectedUser && (
        <>
          {/* Carte info utilisateur */}
          <div className={`rounded-xl border-2 p-5 ${COULEURS_ROLE[selectedUser.role] || "border-gray-200 bg-white"}`}>
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold ${
                  selectedUser.est_actif ? "bg-lagune" : "bg-gray-400"
                }`}>
                  {(selectedUser.prenom?.charAt(0) || selectedUser.email.charAt(0)).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-ardoise">
                    {selectedUser.prenom ? `${selectedUser.prenom} ${selectedUser.nom || ""}` : selectedUser.email}
                  </h2>
                  <p className="text-sm text-ardoise-clair">{selectedUser.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs uppercase font-bold px-2 py-0.5 rounded-full border ${COULEURS_ROLE[selectedUser.role] || ""}`}>
                      {LIBELLES_ROLE[selectedUser.role] || selectedUser.role}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      selectedUser.est_actif ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {selectedUser.est_actif ? "Actif" : "Inactif"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Link href="/super-admin/droits-ui">
                  <Bouton variante="secondaire" taille="petit">🎛️ Droits UI (par rôle)</Bouton>
                </Link>
                <Bouton variante="primaire" taille="petit" onClick={() => setMontrerChangerRole(true)}>
                  🎭 Changer le rôle
                </Bouton>
              </div>
            </div>
          </div>

          {/* ===== CHANGER LE RÔLE ===== */}
          {montrerChangerRole && (
            <Carte
              titre="🎭 Changer le rôle de l'utilisateur"
              sous-titre={`Rôle actuel : ${LIBELLES_ROLE[selectedUser.role] || selectedUser.role} → Nouveau rôle`}
            >
              <div className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                    Nouveau rôle
                  </label>
                  <select
                    value={nouveauRole}
                    onChange={(e) => setNouveauRole(e.target.value)}
                    className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm bg-white"
                  >
                    <option value="">Sélectionne un rôle...</option>
                    {Object.entries(LIBELLES_ROLE).map(([cle, libelle]) => (
                      <option key={cle} value={cle} disabled={cle === selectedUser.role}>
                        {libelle} {cle === selectedUser.role ? "(actuel)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                    Motif du changement
                  </label>
                  <textarea
                    value={motifRole}
                    onChange={(e) => setMotifRole(e.target.value)}
                    placeholder="Explique pourquoi ce changement de rôle..."
                    className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm resize-none"
                    rows={3}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="forcer-role"
                    checked={forcerRole}
                    onChange={(e) => setForcerRole(e.target.checked)}
                    className="w-4 h-4 accent-ocre"
                  />
                  <label htmlFor="forcer-role" className="text-xs text-ardoise-clair cursor-pointer">
                    Forcer (ignorer la validation email)
                  </label>
                </div>
                <div className="flex gap-3">
                  <Bouton
                    variante="primaire"
                    taille="petit"
                    chargement={chargementRole}
                    disabled={!nouveauRole}
                    onClick={gererChangementRole}
                  >
                    🎭 Confirmer le changement
                  </Bouton>
                  <Bouton
                    variante="ghost"
                    taille="petit"
                    onClick={() => { setMontrerChangerRole(false); setNouveauRole(""); setMotifRole(""); setForcerRole(false); }}
                  >
                    Annuler
                  </Bouton>
                </div>
                <div className="bg-ocre/5 border border-ocre/20 rounded-lg p-3">
                  <p className="text-xs text-ocre font-semibold">⚠️ Action sensible</p>
                  <p className="text-xs text-ardoise-clair mt-1">
                    Changer le rôle d&apos;un utilisateur est une action critique tracée
                    dans le journal d&apos;audit. Toutes les sessions actives de
                    l&apos;utilisateur seront révoquées.
                  </p>
                </div>
              </div>
            </Carte>
          )}

          {/* ===== PROFILS DE PROFIL ===== */}
          {profilsDisponibles.length > 0 && (
            <Carte
              titre="📋 Profils de permissions (profil de profil)"
              sous-titre={`Sélectionne un profil pour appliquer une configuration prédéfinie au rôle "${LIBELLES_ROLE[selectedUser.role]}"`}
            >
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {profilsDisponibles.map((profil) => {
                  const actif = profilSelectionne === profil.id;
                  const nbActifs = profil.modules.filter((m) => m.is_enabled).length;
                  const nbDesactives = profil.modules.filter((m) => !m.is_enabled).length;
                  return (
                    <button
                      key={profil.id}
                      onClick={() => appliquerProfil(profil.id)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        actif
                          ? "border-lagune bg-lagune/5 ring-2 ring-lagune/20"
                          : "border-ardoise-clair/10 hover:border-lagune/30 hover:bg-sable"
                      }`}
                    >
                      <p className="font-bold text-sm text-ardoise">{profil.nom}</p>
                      <p className="text-xs text-ardoise-clair mt-1">{profil.description}</p>
                      <div className="flex gap-2 mt-2 text-xs">
                        <span className="text-green-600">{nbActifs} activés</span>
                        {nbDesactives > 0 && <span className="text-red-500">{nbDesactives} désactivés</span>}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {profil.modules.filter((m) => m.is_enabled).slice(0, 3).map((m) => (
                          <span key={m.module_key} className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                            ✓ {m.module_label || m.module_key}
                          </span>
                        ))}
                        {profil.modules.filter((m) => !m.is_enabled).slice(0, 2).map((m) => (
                          <span key={m.module_key} className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                            ✗ {m.module_label || m.module_key}
                          </span>
                        ))}
                        {profil.modules.length > 5 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                            +{profil.modules.length - 5} autres
                          </span>
                        )}
                      </div>
                      {actif && (
                        <p className="text-xs text-lagune font-semibold mt-2">✓ Profil actif</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </Carte>
          )}

          {/* ===== MODULES ===== */}
          <Carte
            titre="🎛️ Permissions module par module"
            sous-titre={`Modules UI pour "${LIBELLES_ROLE[selectedUser.role] || selectedUser.role}" — active/désactive pour cet utilisateur`}
          >
            {chargementModules ? (
              <p className="text-ardoise-clair italic text-center py-8">Chargement des modules...</p>
            ) : modulesUtilisateur.length === 0 ? (
              <p className="text-ardoise-clair italic text-center py-8">Aucun module configuré pour ce rôle.</p>
            ) : (
              <div className="space-y-2">
                {modulesUtilisateur.map((mod) => {
                  const enSauvegarde = sauvegardeEnCours === `${mod.module_key}:is_enabled` ||
                    sauvegardeEnCours === `${mod.module_key}:is_read_only`;

                  return (
                    <div key={mod.module_key} className="flex items-center justify-between p-3 bg-sable rounded-lg hover:bg-sable/80 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ardoise truncate">
                          {mod.module_label || mod.module_key}
                        </p>
                        <p className="text-xs text-ardoise-clair truncate">{mod.module_key}</p>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <span className={`text-xs font-semibold ${mod.is_enabled ? "text-green-600" : "text-red-500"}`}>
                            {mod.is_enabled ? "Activé" : "Désactivé"}
                          </span>
                          <button
                            onClick={() => basculerModule(mod, "is_enabled")}
                            disabled={enSauvegarde}
                            className={`relative w-10 h-5 rounded-full transition-colors ${
                              enSauvegarde ? "opacity-50" : mod.is_enabled ? "bg-green-500" : "bg-gray-300"
                            }`}
                          >
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                              mod.is_enabled ? "translate-x-5" : ""
                            }`} />
                          </button>
                        </label>

                        {mod.is_enabled && (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <span className={`text-xs font-semibold ${mod.is_read_only ? "text-ocre" : "text-ardoise-clair"}`}>
                              R/O
                            </span>
                            <button
                              onClick={() => basculerModule(mod, "is_read_only")}
                              disabled={enSauvegarde}
                              className={`relative w-8 h-4 rounded-full transition-colors ${
                                enSauvegarde ? "opacity-50" : mod.is_read_only ? "bg-ocre" : "bg-gray-300"
                              }`}
                            >
                              <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${
                                mod.is_read_only ? "translate-x-4" : ""
                              }`} />
                            </button>
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Carte>
        </>
      )}

      {/* Navigation */}
      <div className="flex gap-3 flex-wrap pt-4 border-t border-ardoise-clair/10">
        <Link href="/super-admin/droits-ui">
          <Bouton variante="primaire" taille="petit">🎛️ Configurer les modules par rôle</Bouton>
        </Link>
        <Link href="/super-admin/administrateurs">
          <Bouton variante="secondaire" taille="petit">Gérer les administrateurs</Bouton>
        </Link>
        <Link href="/super-admin/tableau-de-bord">
          <Bouton variante="ghost" taille="petit">← Tableau de bord</Bouton>
        </Link>
      </div>
    </div>
  );
}
