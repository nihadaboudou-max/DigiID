"use client";
/**
 * Page Super Admin — Matrice des droits UI (version améliorée).
 * Navigation interactive par modules.
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import { ChampRecherche } from "@/composants/commun/ChampRecherche";
import { Modal } from "@/composants/commun/Modal";
import { ErreurAPI } from "@/services/client_api";
import {
  obtenirMatricePermissions,
  mettreAJourModuleRole,
  modifierOverridesUtilisateur,
  modulesParDefaut,
} from "@/services/ui_permissions";
import type { ModulePermission } from "@/services/ui_permissions";

// ---------- Constantes ----------
const COULEURS_ROLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  super_administrateur: { bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-300", label: "Super Admin" },
  super_admin: { bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-300", label: "Super Admin" },
  admin_domaine: { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-300", label: "Admin Domaine" },
  administrateur: { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-300", label: "Administrateur" },
  chef_police: { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-300", label: "Chef Police" },
  chef_medical: { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-300", label: "Chef Médical" },
  chef_ong: { bg: "bg-cyan-100", text: "text-cyan-700", border: "border-cyan-300", label: "Chef ONG" },
  chef_agent: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300", label: "Chef Enrôlement" },
  agent_police: { bg: "bg-indigo-100", text: "text-indigo-700", border: "border-indigo-300", label: "Agent Police" },
  agent_medical: { bg: "bg-green-100", text: "text-green-700", border: "border-green-300", label: "Agent Médical" },
  agent_ong: { bg: "bg-teal-100", text: "text-teal-700", border: "border-teal-300", label: "Agent ONG" },
  agent_terrain: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300", label: "Agent Terrain" },
  medecin: { bg: "bg-green-100", text: "text-green-700", border: "border-green-300", label: "Médecin" },
  police: { bg: "bg-indigo-100", text: "text-indigo-700", border: "border-indigo-300", label: "Police" },
  ong: { bg: "bg-teal-100", text: "text-teal-700", border: "border-teal-300", label: "ONG" },
  agent: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300", label: "Agent" },
  citoyen: { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300", label: "Citoyen" },
};

const ORDRE_ROLES = [
  "super_administrateur",
  "admin_domaine",
  "administrateur",
  "chef_police",
  "chef_medical",
  "chef_ong",
  "chef_agent",
  "agent_police",
  "agent_medical",
  "agent_ong",
  "agent_terrain",
  "medecin",
  "police",
  "ong",
  "agent",
  "citoyen",
];

// ---------- Page ----------
export default function PageDroitsUI() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [modules, setModules] = useState<ModulePermission[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [filtreRole, setFiltreRole] = useState<string>("tous");
  const [moduleSelectionne, setModuleSelectionne] = useState<string | null>(null);
  const [sauvegardeEnCours, setSauvegardeEnCours] = useState<string | null>(null);
  const [succesMessage, setSuccesMessage] = useState<string | null>(null);

  // Stats
  const stats = useMemo(() => {
    const rolesUniques = new Set(modules.map((m) => m.role_name));
    const modulesUniques = new Set(modules.map((m) => m.module_key));
    const actives = modules.filter((m) => m.is_enabled).length;
    return {
      roles: rolesUniques.size,
      modules: modulesUniques.size,
      total: modules.length,
      actives,
      tauxActivation: modules.length > 0 ? Math.round((actives / modules.length) * 100) : 0,
    };
  }, [modules]);

  useEffect(() => {
    chargerMatrice();
  }, []);

  const chargerMatrice = async () => {
    setChargement(true);
    setErreur(null);
    try {
      const data = await obtenirMatricePermissions();
      setModules(data.modules);
    } catch (e) {
      const modulesFallback: ModulePermission[] = [];
      for (const role of ORDRE_ROLES) {
        const defauts = modulesParDefaut(role);
        if (defauts.length > 0) {
          modulesFallback.push(...defauts);
        }
      }
      setModules(modulesFallback);
    } finally {
      setChargement(false);
    }
  };

  // Modules uniques filtrés
  const modulesUniques = useMemo(() => {
    const map = new Map<string, { key: string; label: string }>();
    for (const m of modules) {
      if (!map.has(m.module_key)) {
        map.set(m.module_key, { key: m.module_key, label: m.module_label || m.module_key });
      }
    }
    return Array.from(map.values()).filter(
      (m) =>
        !recherche ||
        m.label.toLowerCase().includes(recherche.toLowerCase()) ||
        m.key.toLowerCase().includes(recherche.toLowerCase())
    );
  }, [modules, recherche]);

  // Permissions du module sélectionné
  const permissionsModule = useMemo(() => {
    if (!moduleSelectionne) return null;
    return modules.filter((m) => m.module_key === moduleSelectionne);
  }, [modules, moduleSelectionne]);

  // Basculer un module
  const basculerModule = useCallback(
    async (module: ModulePermission, champ: "is_enabled" | "is_read_only") => {
      const cleSauvegarde = `${module.role_name}:${module.module_key}:${champ}`;
      setSauvegardeEnCours(cleSauvegarde);
      setErreur(null);
      setSuccesMessage(null);
      try {
        const payload: { module_key: string; is_enabled?: boolean; is_read_only?: boolean } = {
          module_key: module.module_key,
        };
        if (champ === "is_enabled") {
          payload.is_enabled = !module.is_enabled;
          if (!payload.is_enabled) payload.is_read_only = false;
        } else {
          payload.is_read_only = !module.is_read_only;
          if (payload.is_read_only) payload.is_enabled = true;
        }
        await mettreAJourModuleRole(module.role_name, payload);
        await chargerMatrice();
        setSuccesMessage(`${module.module_label} mis à jour`);
        setTimeout(() => setSuccesMessage(null), 3000);
      } catch (e) {
        setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur");
      } finally {
        setSauvegardeEnCours(null);
      }
    },
    []
  );

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div>
        <p className="text-ocre font-semibold text-xs uppercase tracking-wider">Super administration</p>
        <h1 className="mt-1 text-2xl"> Configuration des droits UI</h1>
        <p className="text-ardoise-clair mt-1 text-sm max-w-2xl">
          Cliquez sur un module pour configurer ses permissions par rôle.
        </p>
      </div>

      {/* Statistiques */}
      {!chargement && (
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          <Carte className="text-center p-3">
            <p className="text-2xl font-bold text-lagune">{stats.roles}</p>
            <p className="text-[10px] uppercase text-ardoise-clair font-semibold">Rôles</p>
          </Carte>
          <Carte className="text-center p-3">
            <p className="text-2xl font-bold text-ocre">{stats.modules}</p>
            <p className="text-[10px] uppercase text-ardoise-clair font-semibold">Modules</p>
          </Carte>
          <Carte className="text-center p-3">
            <p className="text-2xl font-bold text-ardoise">{stats.total}</p>
            <p className="text-[10px] uppercase text-ardoise-clair font-semibold">Permissions</p>
          </Carte>
          <Carte className="text-center p-3">
            <p className="text-2xl font-bold text-succes">{stats.actives}</p>
            <p className="text-[10px] uppercase text-ardoise-clair font-semibold">Activées</p>
          </Carte>
          <Carte className="text-center p-3">
            <p className="text-2xl font-bold text-lagune">{stats.tauxActivation}%</p>
            <p className="text-[10px] uppercase text-ardoise-clair font-semibold">Taux</p>
          </Carte>
        </div>
      )}

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}
      {succesMessage && <Alerte variante="succes">{succesMessage}</Alerte>}

      {chargement ? (
        <p className="text-ardoise-clair italic text-center py-6">Chargement...</p>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {/* Sidebar - Liste des modules */}
          <Carte className="md:col-span-1">
            <div className="space-y-3">
              <ChampRecherche
                placeholder="Rechercher un module..."
                value={recherche}
                onChange={(e) => {
                  setRecherche(e.target.value);
                  setModuleSelectionne(null);
                }}
              />
              <select
                value={filtreRole}
                onChange={(e) => setFiltreRole(e.target.value)}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm"
              >
                <option value="tous">Tous les rôles</option>
                {ORDRE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {COULEURS_ROLES[r]?.label || r}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 space-y-1 max-h-[600px] overflow-y-auto">
              {modulesUniques.map((mod) => {
                const isSelected = moduleSelectionne === mod.key;
                return (
                  <button
                    key={mod.key}
                    onClick={() => setModuleSelectionne(mod.key)}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      isSelected
                        ? "bg-lagune/10 border-2 border-lagune"
                        : "bg-sable hover:bg-sable/80 border-2 border-transparent"
                    }`}
                  >
                    <p className={`font-semibold text-sm ${isSelected ? "text-lagune" : "text-ardoise"}`}>
                      {mod.label}
                    </p>
                    <p className="text-xs text-ardoise-clair font-mono mt-1">{mod.key}</p>
                  </button>
                );
              })}
            </div>
          </Carte>

          {/* Panneau de détails */}
          <Carte className="md:col-span-2">
            {moduleSelectionne && permissionsModule ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-ardoise">
                      {permissionsModule[0]?.module_label || permissionsModule[0]?.module_key}
                    </h2>
                    <p className="text-sm text-ardoise-clair font-mono">
                      {permissionsModule[0]?.module_key}
                    </p>
                  </div>
                  <Bouton variante="ghost" taille="petit" onClick={() => setModuleSelectionne(null)}>
                    ✕ Fermer
                  </Bouton>
                </div>

                <div className="space-y-2">
                  {permissionsModule.map((perm) => {
                    const roleConfig = COULEURS_ROLES[perm.role_name];
                    const cleSauvegarde = `${perm.role_name}:${perm.module_key}`;
                    const enSauvegarde = sauvegardeEnCours?.startsWith(cleSauvegarde);

                    return (
                      <div
                        key={perm.role_name}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          roleConfig?.bg || "bg-gray-100"
                        } ${roleConfig?.border || "border-gray-300"}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`font-semibold text-sm ${roleConfig?.text || "text-gray-700"}`}>
                            {roleConfig?.label || perm.role_name}
                          </span>
                        </div>

                        <div className="flex items-center gap-4">
                          {/* Toggle Activé/Désactivé */}
                          <label className="flex items-center gap-2 cursor-pointer">
                            <span className="text-xs text-ardoise-clair">
                              {perm.is_enabled ? "✓ Activé" : "✗ Désactivé"}
                            </span>
                            <button
                              onClick={() => basculerModule(perm, "is_enabled")}
                              disabled={enSauvegarde}
                              className={`relative w-10 h-5 rounded-full transition-colors ${
                                enSauvegarde ? "opacity-50" : perm.is_enabled ? "bg-succes" : "bg-gray-300"
                              }`}
                            >
                              <span
                                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                  perm.is_enabled ? "translate-x-5" : ""
                                }`}
                              />
                            </button>
                          </label>

                          {/* Toggle Lecture seule */}
                          {perm.is_enabled && (
                            <label className="flex items-center gap-2 cursor-pointer">
                              <span className="text-xs text-ardoise-clair">Lecture seule</span>
                              <button
                                onClick={() => basculerModule(perm, "is_read_only")}
                                disabled={enSauvegarde}
                                className={`relative w-8 h-4 rounded-full transition-colors ${
                                  enSauvegarde ? "opacity-50" : perm.is_read_only ? "bg-ocre" : "bg-gray-300"
                                }`}
                              >
                                <span
                                  className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${
                                    perm.is_read_only ? "translate-x-4" : ""
                                  }`}
                                />
                              </button>
                            </label>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">📋</p>
                <p className="text-ardoise-clair italic">
                  {modulesUniques.length === 0
                    ? "Aucun module trouvé."
                    : "Sélectionnez un module pour voir ses permissions"}
                </p>
              </div>
            )}
          </Carte>
        </div>
      )}

      {/* Pied de page */}
      <div className="flex gap-2 pt-3 border-t border-ardoise-clair/10">
        <Link href="/super-admin/droits">
          <Bouton variante="primaire" taille="petit">← Retour</Bouton>
        </Link>
        <Link href="/super-admin/tableau-de-bord">
          <Bouton variante="ghost" taille="petit">Tableau de bord</Bouton>
        </Link>
      </div>
    </div>
  );
}