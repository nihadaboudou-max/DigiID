"use client";
/**
Page Super Admin — Attribution des droits aux personnes.
Supporte TOUS les rôles : citoyen, agent, medecin, police, ong,
administrateur, super_administrateur, admin_domaine, chef_*, agent_*
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

// ---------- PROFILS PRÉDÉFINIS (étendus aux nouveaux rôles) ----------
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
      { role_name: "medecin", module_key: "ordonnances", module_label: "Ordonnances", module_description: null, module_icon: "file", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "medecin", module_key: "calendrier_rendezvous", module_label: "Calendrier rendez-vous", module_description: null, module_icon: "calendar", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "medecin", module_key: "mon_profil_medecin", module_label: "Mon profil médecin", module_description: null, module_icon: "user", is_enabled: true, is_read_only: true, updated_at: null },
    ],
  },
  // ─── AGENT TERRAIN ───
  {
    id: "agent_enrolement",
    nom: "Agent d'enrôlement",
    description: "Enrôlement citoyen, scan CNI, biométrie",
    role_cible: "agent_terrain",
    modules: [
      { role_name: "agent_terrain", module_key: "enrolement_citoyen", module_label: "Enrôlement citoyen", module_description: null, module_icon: "user-plus", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "agent_terrain", module_key: "scan_ocr_cni", module_label: "Scan OCR CNI", module_description: null, module_icon: "scan", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "agent_terrain", module_key: "capture_biometrique", module_label: "Capture biométrique", module_description: null, module_icon: "fingerprint", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "agent_terrain", module_key: "liste_enrollements", module_label: "Liste des enrôlements", module_description: null, module_icon: "list", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "agent_terrain", module_key: "mon_profil_agent", module_label: "Mon profil agent", module_description: null, module_icon: "user", is_enabled: true, is_read_only: true, updated_at: null },
    ],
  },
  // ─── POLICE TERRAIN ───
  {
    id: "police_terrain",
    nom: "Police terrain",
    description: "Vérification identité, signalement, recherche",
    role_cible: "agent_police",
    modules: [
      { role_name: "agent_police", module_key: "verification_identite", module_label: "Vérification d'identité", module_description: null, module_icon: "search", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "agent_police", module_key: "consultation_score", module_label: "Consultation score", module_description: null, module_icon: "trending-up", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "agent_police", module_key: "recherche_personne", module_label: "Recherche personne", module_description: null, module_icon: "fingerprint", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "agent_police", module_key: "signalement_fraude", module_label: "Signalement fraude", module_description: null, module_icon: "alert-triangle", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "agent_police", module_key: "mon_profil_police", module_label: "Mon profil police", module_description: null, module_icon: "user", is_enabled: true, is_read_only: true, updated_at: null },
    ],
  },
  // ─── CHEF POLICE ──
  {
    id: "chef_police_complet",
    nom: "Chef Police (complet)",
    description: "Gestion équipe + vérifications + signalements + statistiques",
    role_cible: "chef_police",
    modules: [
      { role_name: "chef_police", module_key: "gestion_equipe", module_label: "Gestion équipe", module_description: null, module_icon: "users", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "chef_police", module_key: "verification_identite", module_label: "Vérification d'identité", module_description: null, module_icon: "search", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "chef_police", module_key: "signalement_fraude", module_label: "Signalement fraude", module_description: null, module_icon: "alert-triangle", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "chef_police", module_key: "statistiques_departement", module_label: "Statistiques département", module_description: null, module_icon: "bar-chart", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "chef_police", module_key: "rapports", module_label: "Rapports", module_description: null, module_icon: "file-text", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "chef_police", module_key: "mon_profil_chef", module_label: "Mon profil chef", module_description: null, module_icon: "user", is_enabled: true, is_read_only: true, updated_at: null },
    ],
  },
  // ─── CHEF MÉDICAL ───
  {
    id: "chef_medical_complet",
    nom: "Chef Médical (complet)",
    description: "Gestion médecins + dossiers + ordonnances + statistiques",
    role_cible: "chef_medical",
    modules: [
      { role_name: "chef_medical", module_key: "gestion_medecins", module_label: "Gestion médecins", module_description: null, module_icon: "users", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "chef_medical", module_key: "suivi_dossiers", module_label: "Suivi des dossiers", module_description: null, module_icon: "folder", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "chef_medical", module_key: "ordonnances", module_label: "Ordonnances", module_description: null, module_icon: "file", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "chef_medical", module_key: "statistiques_departement", module_label: "Statistiques département", module_description: null, module_icon: "bar-chart", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "chef_medical", module_key: "rapports", module_label: "Rapports", module_description: null, module_icon: "file-text", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "chef_medical", module_key: "mon_profil_chef", module_label: "Mon profil chef", module_description: null, module_icon: "user", is_enabled: true, is_read_only: true, updated_at: null },
    ],
  },
  // ─── CHEF ONG ───
  {
    id: "chef_ong_complet",
    nom: "Chef ONG (complet)",
    description: "Gestion agents + bénéficiaires + missions + rapports",
    role_cible: "chef_ong",
    modules: [
      { role_name: "chef_ong", module_key: "gestion_agents", module_label: "Gestion agents", module_description: null, module_icon: "users", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "chef_ong", module_key: "beneficiaires", module_label: "Bénéficiaires", module_description: null, module_icon: "user-check", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "chef_ong", module_key: "missions", module_label: "Missions", module_description: null, module_icon: "map", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "chef_ong", module_key: "statistiques_departement", module_label: "Statistiques département", module_description: null, module_icon: "bar-chart", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "chef_ong", module_key: "rapports", module_label: "Rapports", module_description: null, module_icon: "file-text", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "chef_ong", module_key: "mon_profil_chef", module_label: "Mon profil chef", module_description: null, module_icon: "user", is_enabled: true, is_read_only: true, updated_at: null },
    ],
  },
  // ─── ADMIN DOMAINE ───
  {
    id: "admin_domaine_complet",
    nom: "Admin Domaine (complet)",
    description: "Gestion départements + chefs + statistiques domaine",
    role_cible: "admin_domaine",
    modules: [
      { role_name: "admin_domaine", module_key: "gestion_departements", module_label: "Gestion départements", module_description: null, module_icon: "building", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "admin_domaine", module_key: "gestion_chefs", module_label: "Gestion chefs", module_description: null, module_icon: "users", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "admin_domaine", module_key: "statistiques_domaine", module_label: "Statistiques domaine", module_description: null, module_icon: "bar-chart", is_enabled: true, is_read_only: true, updated_at: null },
      { role_name: "admin_domaine", module_key: "invitations", module_label: "Invitations", module_description: null, module_icon: "mail", is_enabled: true, is_read_only: false, updated_at: null },
      { role_name: "admin_domaine", module_key: "mon_profil_admin", module_label: "Mon profil admin", module_description: null, module_icon: "user", is_enabled: true, is_read_only: true, updated_at: null },
    ],
  },
];

// ---------- Constantes ----------
const COULEURS_ROLE: Record<string, string> = {
  citoyen: "text-gray-700 bg-gray-100 border-gray-300",
  agent: "text-blue-700 bg-blue-50 border-blue-300",
  agent_terrain: "text-blue-700 bg-blue-50 border-blue-300",
  agent_police: "text-indigo-700 bg-indigo-50 border-indigo-300",
  agent_medical: "text-green-700 bg-green-50 border-green-300",
  agent_ong: "text-teal-700 bg-teal-50 border-teal-300",
  medecin: "text-green-700 bg-green-50 border-green-300",
  police: "text-indigo-700 bg-indigo-50 border-indigo-300",
  ong: "text-teal-700 bg-teal-50 border-teal-300",
  administrateur: "text-purple-700 bg-purple-50 border-purple-300",
  admin_domaine: "text-purple-700 bg-purple-50 border-purple-300",
  super_administrateur: "text-rose-700 bg-rose-50 border-rose-300",
  super_admin: "text-rose-700 bg-rose-50 border-rose-300",
  chef_police: "text-orange-700 bg-orange-50 border-orange-300",
  chef_medical: "text-emerald-700 bg-emerald-50 border-emerald-300",
  chef_ong: "text-cyan-700 bg-cyan-50 border-cyan-300",
  chef_agent: "text-blue-700 bg-blue-50 border-blue-300",
};

const LIBELLES_ROLE: Record<string, string> = {
  citoyen: "Citoyen",
  agent: "Agent",
  agent_terrain: "Agent Terrain",
  agent_police: "Agent Police",
  agent_medical: "Agent Médical",
  agent_ong: "Agent ONG",
  medecin: "Médecin",
  police: "Police",
  ong: "ONG",
  administrateur: "Administrateur",
  admin_domaine: "Admin Domaine",
  super_administrateur: "Super administrateur",
  super_admin: "Super Admin",
  chef_police: "Chef Police",
  chef_medical: "Chef Médical",
  chef_ong: "Chef ONG",
  chef_agent: "Chef Enrôlement",
};

// ---------- Page ----------
export default function PageSuperAdminDroits() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["super_administrateur", "super_admin"]}>
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
  const [montrerChangerRole, setMontrerChangerRole] = useState(false);
  const [nouveauRole, setNouveauRole] = useState("");
  const [motifRole, setMotifRole] = useState("");
  const [chargementRole, setChargementRole] = useState(false);
  const [profilChoisi, setProfilChoisi] = useState<string>("");
  const [profilSelectionne, setProfilSelectionne] = useState<string>("");

  const rechercher = useCallback(async () => {
    if (!recherche.trim()) return;
    setChargementUsers(true);
    setErreur(null);
    try {
      const data = await listerTousUtilisateurs({ recherche: recherche.trim(), page: 1, limite: 20 });
      setUtilisateurs(data.utilisateurs || []);
      if (data.utilisateurs?.length === 0) setErreur("Aucun utilisateur trouvé.");
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la recherche");
      setUtilisateurs([]);
    } finally {
      setChargementUsers(false);
    }
  }, [recherche]);

  const selectionnerUtilisateur = useCallback(async (user: UtilisateurSimple) => {
    setSelectedUser(user);
    setProfilSelectionne("");
    setChargementModules(true);
    setErreur(null);
    try {
      const modules = await obtenirModulesRole(user.role);
      setModulesUtilisateur(modules.modules);
    } catch {
      const defauts = modulesParDefaut(user.role);
      setModulesUtilisateur(defauts.length > 0 ? defauts : []);
    } finally {
      setChargementModules(false);
    }
  }, []);

  const basculerModule = useCallback(async (module: ModulePermission, champ: "is_enabled" | "is_read_only") => {
    if (!selectedUser) return;
    const cle = `${module.module_key}:${champ}`;
    setSauvegardeEnCours(cle);
    setErreur(null);
    setSuccesMessage(null);
    try {
      let newEnabled = module.is_enabled;
      let newReadOnly = module.is_read_only;
      if (champ === "is_enabled") {
        newEnabled = !module.is_enabled;
        if (!newEnabled) newReadOnly = false;
      } else {
        newReadOnly = !module.is_read_only;
        if (newReadOnly) newEnabled = true;
      }
      await mettreAJourModuleRole(module.role_name, {
        module_key: module.module_key,
        is_enabled: newEnabled,
        is_read_only: newReadOnly,
      });
      await modifierOverridesUtilisateur(selectedUser.id, {
        modules_overrides: {
          [module.module_key]: { is_enabled: newEnabled, is_read_only: newReadOnly },
        },
      });
      setModulesUtilisateur((prev) =>
        prev.map((m) => m.module_key === module.module_key ? { ...m, is_enabled: newEnabled, is_read_only: newReadOnly } : m)
      );
      setSuccesMessage(`Module "${module.module_label || module.module_key}" mis à jour pour ${selectedUser.prenom || selectedUser.email}`);
      setTimeout(() => setSuccesMessage(null), 3000);
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la mise à jour");
    } finally {
      setSauvegardeEnCours(null);
    }
  }, [selectedUser]);

  const appliquerProfil = useCallback(async (profilId: string) => {
    if (!selectedUser) return;
    const profil = PROFILS_PREDEFINIS.find((p) => p.id === profilId);
    if (!profil) return;
    setProfilSelectionne(profilId);
    setChargementModules(true);
    setErreur(null);
    setSuccesMessage(null);
    try {
      const overrides: Record<string, { is_enabled: boolean; is_read_only: boolean }> = {};
      profil.modules.forEach((mod) => {
        overrides[mod.module_key] = { is_enabled: mod.is_enabled, is_read_only: mod.is_read_only };
      });
      await modifierOverridesUtilisateur(selectedUser.id, { modules_overrides: overrides });
      setModulesUtilisateur(profil.modules);
      setSuccesMessage(`✅ Profil "${profil.nom}" appliqué à ${selectedUser.prenom || selectedUser.email}`);
      setTimeout(() => setSuccesMessage(null), 5000);
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de l'application du profil");
    } finally {
      setChargementModules(false);
    }
  }, [selectedUser]);

  const profilsPourNouveauRole = PROFILS_PREDEFINIS.filter((p) => nouveauRole && p.role_cible === nouveauRole);

  const gererChangementRole = useCallback(async () => {
    if (!selectedUser || !nouveauRole) return;
    setChargementRole(true);
    setErreur(null);
    setSuccesMessage(null);
    try {
      await changerRoleUtilisateur(selectedUser.id, { role: nouveauRole, motif: motifRole || "Changement via page Droits" });
      const profil = PROFILS_PREDEFINIS.find((p) => p.id === profilChoisi);
      if (profil) {
        const overrides: Record<string, { is_enabled: boolean; is_read_only: boolean }> = {};
        profil.modules.forEach((mod) => {
          overrides[mod.module_key] = { is_enabled: mod.is_enabled, is_read_only: mod.is_read_only };
        });
        try { await modifierOverridesUtilisateur(selectedUser.id, { modules_overrides: overrides }); } catch {}
      }
      const libelleRole = LIBELLES_ROLE[nouveauRole] || nouveauRole;
      const libelleProfil = profil ? ` (${profil.nom})` : "";
      setSuccesMessage(`✅ Rôle changé en "${libelleRole}"${libelleProfil} pour ${selectedUser.prenom || selectedUser.email}`);
      setMontrerChangerRole(false);
      setMotifRole("");
      setProfilChoisi("");
      setProfilSelectionne("");
      setSelectedUser({ ...selectedUser, role: nouveauRole });
      setChargementModules(true);
      try {
        if (profil) {
          setModulesUtilisateur(profil.modules);
        } else {
          const resultatModules = await obtenirModulesRole(nouveauRole);
          setModulesUtilisateur(resultatModules.modules);
        }
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
  }, [selectedUser, nouveauRole, motifRole, profilChoisi]);

  const profilsDisponibles = PROFILS_PREDEFINIS.filter((p) => selectedUser && p.role_cible === selectedUser.role);

  return (
    <div className="space-y-4">
      <header>
        <p className="text-ocre font-semibold text-xs uppercase tracking-wider">Super administration</p>
        <h1 className="mt-1 text-2xl">Attribution des droits aux personnes</h1>
        <p className="text-ardoise-clair mt-1 text-sm max-w-3xl">
          Recherche un utilisateur, consulte ses permissions actuelles et
          assigne-lui des droits spécifiques module par module,
          ou applique-lui un profil de permissions prédéfini.
        </p>
      </header>

      {succesMessage && <Alerte variante="succes" titre="✓ Succès">{succesMessage}</Alerte>}
      {erreur && <Alerte variante="erreur" titre="Erreur">{erreur}</Alerte>}

      <Carte titre="👤 Rechercher un utilisateur">
        <div className="flex gap-2">
          <input
            type="text"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && rechercher()}
            placeholder="Email, nom, prénom ou ID..."
            className="flex-1 champ-saisie"
          />
          <Bouton variante="primaire" chargement={chargementUsers} onClick={rechercher}>🔍 Rechercher</Bouton>
        </div>
        {utilisateurs.length > 0 && (
          <div className="mt-3 space-y-1.5 max-h-80 overflow-y-auto">
            {utilisateurs.map((user) => (
              <button
                key={user.id}
                onClick={() => selectionnerUtilisateur(user)}
                className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition-all text-left ${
                  selectedUser?.id === user.id ? "bg-lagune/5 border-lagune" : "bg-white border-ardoise-clair/10 hover:bg-sable"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold ${user.est_actif ? "bg-lagune" : "bg-gray-400"}`}>
                    {(user.prenom?.charAt(0) || user.email.charAt(0)).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-ardoise">{user.prenom ? `${user.prenom} ${user.nom || ""}` : user.email}</p>
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

      {selectedUser && (
        <>
          <div className={`rounded-xl border-2 p-4 ${COULEURS_ROLE[selectedUser.role] || "border-gray-200 bg-white"}`}>
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white text-base font-bold ${selectedUser.est_actif ? "bg-lagune" : "bg-gray-400"}`}>
                  {(selectedUser.prenom?.charAt(0) || selectedUser.email.charAt(0)).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-ardoise">{selectedUser.prenom ? `${selectedUser.prenom} ${selectedUser.nom || ""}` : selectedUser.email}</h2>
                  <p className="text-xs text-ardoise-clair">{selectedUser.email}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs uppercase font-bold px-2 py-0.5 rounded-full border ${COULEURS_ROLE[selectedUser.role] || ""}`}>
                      {LIBELLES_ROLE[selectedUser.role] || selectedUser.role}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${selectedUser.est_actif ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {selectedUser.est_actif ? "Actif" : "Inactif"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Link href="/super-admin/droits-ui">
                  <Bouton variante="secondaire" taille="petit">️ Droits UI (par rôle)</Bouton>
                </Link>
                <Bouton variante="primaire" taille="petit" onClick={() => setMontrerChangerRole(true)}> Changer le rôle</Bouton>
              </div>
            </div>
          </div>

          {montrerChangerRole && (
            <Carte titre="🎭 Changer le rôle de l'utilisateur" sous-titre={`Rôle actuel : ${LIBELLES_ROLE[selectedUser.role] || selectedUser.role} → Nouveau rôle`}>
              <div className="space-y-3 max-w-lg">
                <div>
                  <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Nouveau rôle</label>
                  <select value={nouveauRole} onChange={(e) => setNouveauRole(e.target.value)} className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm bg-white">
                    <option value="">Sélectionne un rôle...</option>
                    {Object.entries(LIBELLES_ROLE).map(([cle, libelle]) => (
                      <option key={cle} value={cle} disabled={cle === selectedUser.role}>{libelle} {cle === selectedUser.role ? "(actuel)" : ""}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Motif du changement</label>
                  <textarea value={motifRole} onChange={(e) => setMotifRole(e.target.value)} placeholder="Explique pourquoi ce changement de rôle..." className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm resize-none" rows={3} />
                </div>
                {profilsPourNouveauRole.length > 0 && (
                  <div>
                    <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1.5">Profil spécifique</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {profilsPourNouveauRole.map((profil) => (
                        <button
                          key={profil.id}
                          type="button"
                          onClick={() => setProfilChoisi(profilChoisi === profil.id ? "" : profil.id)}
                          className={`p-2.5 rounded-xl border-2 text-left transition-all ${profilChoisi === profil.id ? "border-lagune bg-lagune/5 ring-2 ring-lagune/20" : "border-ardoise-clair/10 hover:border-lagune/30"}`}
                        >
                          <p className="font-bold text-sm text-ardoise">{profil.nom}</p>
                          <p className="text-xs text-ardoise-clair mt-0.5">{profil.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Bouton variante="primaire" taille="petit" chargement={chargementRole} disabled={!nouveauRole} onClick={gererChangementRole}>🎭 Confirmer le changement</Bouton>
                  <Bouton variante="ghost" taille="petit" onClick={() => { setMontrerChangerRole(false); setNouveauRole(""); setMotifRole(""); }}>Annuler</Bouton>
                </div>
              </div>
            </Carte>
          )}

          {profilsDisponibles.length > 0 && (
            <Carte titre="📋 Profils de permissions" sous-titre={`Sélectionne un profil pour appliquer une configuration prédéfinie au rôle "${LIBELLES_ROLE[selectedUser.role]}"`}>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {profilsDisponibles.map((profil) => {
                  const actif = profilSelectionne === profil.id;
                  const nbActifs = profil.modules.filter((m) => m.is_enabled).length;
                  return (
                    <button
                      key={profil.id}
                      onClick={() => appliquerProfil(profil.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${actif ? "border-lagune bg-lagune/5 ring-2 ring-lagune/20" : "border-ardoise-clair/10 hover:border-lagune/30 hover:bg-sable"}`}
                    >
                      <p className="font-bold text-sm text-ardoise">{profil.nom}</p>
                      <p className="text-xs text-ardoise-clair mt-0.5">{profil.description}</p>
                      <div className="flex gap-2 mt-1.5 text-xs">
                        <span className="text-green-600">{nbActifs} activés</span>
                      </div>
                      {actif && <p className="text-xs text-lagune font-semibold mt-1.5">✓ Profil actif</p>}
                    </button>
                  );
                })}
              </div>
            </Carte>
          )}

          <Carte titre="🎛️ Permissions module par module" sous-titre={`Modules UI pour "${LIBELLES_ROLE[selectedUser.role] || selectedUser.role}"`}>
            {chargementModules ? (
              <p className="text-ardoise-clair italic text-center py-6">Chargement des modules...</p>
            ) : modulesUtilisateur.length === 0 ? (
              <p className="text-ardoise-clair italic text-center py-6">Aucun module configuré pour ce rôle.</p>
            ) : (
              <div className="space-y-1.5">
                {modulesUtilisateur.map((mod) => {
                  const enSauvegarde = sauvegardeEnCours === `${mod.module_key}:is_enabled` || sauvegardeEnCours === `${mod.module_key}:is_read_only`;
                  return (
                    <div key={mod.module_key} className="flex items-center justify-between p-2.5 bg-sable rounded-lg hover:bg-sable/80 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ardoise truncate">{mod.module_label || mod.module_key}</p>
                        <p className="text-xs text-ardoise-clair truncate">{mod.module_key}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <span className={`text-xs font-semibold ${mod.is_enabled ? "text-green-600" : "text-red-500"}`}>{mod.is_enabled ? "Activé" : "Désactivé"}</span>
                          <button
                            onClick={() => basculerModule(mod, "is_enabled")}
                            disabled={enSauvegarde}
                            className={`relative w-10 h-5 rounded-full transition-colors ${enSauvegarde ? "opacity-50" : mod.is_enabled ? "bg-green-500" : "bg-gray-300"}`}
                          >
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${mod.is_enabled ? "translate-x-5" : ""}`} />
                          </button>
                        </label>
                        {mod.is_enabled && (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <span className={`text-xs font-semibold ${mod.is_read_only ? "text-ocre" : "text-ardoise-clair"}`}>R/O</span>
                            <button
                              onClick={() => basculerModule(mod, "is_read_only")}
                              disabled={enSauvegarde}
                              className={`relative w-8 h-4 rounded-full transition-colors ${enSauvegarde ? "opacity-50" : mod.is_read_only ? "bg-ocre" : "bg-gray-300"}`}
                            >
                              <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${mod.is_read_only ? "translate-x-4" : ""}`} />
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

      <div className="flex gap-2 flex-wrap pt-3 border-t border-ardoise-clair/10">
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