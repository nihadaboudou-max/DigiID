"use client";
/**
Page Super Admin — Matrice des droits UI.
Permet au Super Admin de configurer finement les modules UI
accessibles par chaque rôle (citoyen, agent, medecin, police,
ong, administrateur, super_administrateur, admin_domaine, chef_*, agent_*).
*/
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { ChampRecherche } from "@/composants/commun/ChampRecherche";
import { ErreurAPI } from "@/services/client_api";
import {
  obtenirMatricePermissions,
  mettreAJourModuleRole,
  modifierOverridesUtilisateur,
  modulesParDefaut,
} from "@/services/ui_permissions";
import type { ModulePermission } from "@/services/ui_permissions";

// ---------- Constantes ----------
const COULEURS_ROLES: Record<string, string> = {
  citoyen: "bg-gray-100 text-gray-700 border-gray-300",
  agent: "bg-blue-50 text-blue-700 border-blue-300",
  agent_terrain: "bg-blue-50 text-blue-700 border-blue-300",
  agent_police: "bg-indigo-50 text-indigo-700 border-indigo-300",
  agent_medical: "bg-green-50 text-green-700 border-green-300",
  agent_ong: "bg-teal-50 text-teal-700 border-teal-300",
  medecin: "bg-green-50 text-green-700 border-green-300",
  police: "bg-indigo-50 text-indigo-700 border-indigo-300",
  ong: "bg-teal-50 text-teal-700 border-teal-300",
  administrateur: "bg-purple-50 text-purple-700 border-purple-300",
  admin_domaine: "bg-purple-50 text-purple-700 border-purple-300",
  super_administrateur: "bg-rose-50 text-rose-700 border-rose-300",
  super_admin: "bg-rose-50 text-rose-700 border-rose-300",
  chef_police: "bg-orange-50 text-orange-700 border-orange-300",
  chef_medical: "bg-emerald-50 text-emerald-700 border-emerald-300",
  chef_ong: "bg-cyan-50 text-cyan-700 border-cyan-300",
  chef_agent: "bg-blue-50 text-blue-700 border-blue-300",
};

// ---------- Page ----------
export default function PageDroitsUI() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["super_administrateur", "super_admin"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [modules, setModules] = useState<ModulePermission[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [vue, setVue] = useState<"matrice" | "overrides">("matrice");
  const [rechercheRole, setRechercheRole] = useState("");
  const [rechercheModule, setRechercheModule] = useState("");
  const [sauvegardeEnCours, setSauvegardeEnCours] = useState<string | null>(null);
  const [succesMessage, setSuccesMessage] = useState<string | null>(null);

  // Overrides
  const [overrideUtilisateurId, setOverrideUtilisateurId] = useState("");
  const [overrideModules, setOverrideModules] = useState<Record<string, { is_enabled?: boolean; is_read_only?: boolean }>>({});
  const [overrideEnCours, setOverrideEnCours] = useState(false);
  const [overrideResultat, setOverrideResultat] = useState<string | null>(null);

  // Tous les rôles gérés par la matrice Droits UI
  const TOUS_LES_ROLES = [
    "super_admin",
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
    "citoyen",
    "agent",
    "medecin",
    "police",
    "ong",
  ];

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
      for (const role of TOUS_LES_ROLES) {
        const defauts = modulesParDefaut(role);
        if (defauts.length > 0) {
          modulesFallback.push(...defauts);
        }
      }
      setModules(modulesFallback);
      if (e instanceof ErreurAPI) {
        console.warn("⚠️ Droits UI : API indisponible, utilisation du fallback local");
      }
    } finally {
      setChargement(false);
    }
  };

  const roles = Array.from(new Set(modules.map((m) => m.role_name))).filter(
    (r) => !rechercheRole || r.toLowerCase().includes(rechercheRole.toLowerCase())
  );

  const modulesFiltres = rechercheModule
    ? modules.filter((m) =>
        m.module_label?.toLowerCase().includes(rechercheModule.toLowerCase()) ||
        m.module_key.toLowerCase().includes(rechercheModule.toLowerCase())
      )
    : modules;

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
        const resultat = await mettreAJourModuleRole(module.role_name, payload);
        setModules((prev) =>
          prev.map((m) =>
            m.role_name === module.role_name && m.module_key === module.module_key
              ? { ...m, is_enabled: resultat.is_enabled, is_read_only: resultat.is_read_only }
              : m
          )
        );
        setSuccesMessage(`Module "${module.module_label || module.module_key}" mis à jour avec succès`);
        setTimeout(() => setSuccesMessage(null), 3000);
      } catch (e) {
        setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la mise à jour");
      } finally {
        setSauvegardeEnCours(null);
      }
    },
    []
  );

  const sauvegarderOverrides = async () => {
    if (!overrideUtilisateurId) return;
    setOverrideEnCours(true);
    setOverrideResultat(null);
    try {
      const result = await modifierOverridesUtilisateur(overrideUtilisateurId, {
        modules_overrides: overrideModules,
      });
      setOverrideResultat(result.message);
      setOverrideUtilisateurId("");
      setOverrideModules({});
      setTimeout(() => setOverrideResultat(null), 5000);
    } catch (e) {
      setOverrideResultat(
        e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la sauvegarde"
      );
    } finally {
      setOverrideEnCours(false);
    }
  };

  const modulesParRole = (role: string) =>
    modulesFiltres.filter((m) => m.role_name === role);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-ocre font-semibold text-xs uppercase tracking-wider">Super administration</p>
          <h1 className="mt-1 text-2xl">Configuration des droits UI</h1>
          <p className="text-ardoise-clair mt-1 text-sm max-w-2xl">
            Configure les modules UI accessibles par chaque rôle.
            Un module peut être <strong>activé/désactivé</strong> ou en <strong>lecture seule</strong>.
          </p>
        </div>
        <div className="flex gap-2">
          <Bouton variante={vue === "matrice" ? "primaire" : "ghost"} taille="petit" onClick={() => setVue("matrice")}>
            Matrice
          </Bouton>
          <Bouton variante={vue === "overrides" ? "primaire" : "ghost"} taille="petit" onClick={() => setVue("overrides")}>
            Overrides individuels
          </Bouton>
        </div>
      </div>

      {chargement ? (
        <p className="text-ardoise-clair italic text-center py-6">Chargement de la matrice des droits UI...</p>
      ) : (
        <>
          {erreur && (
            <Alerte variante="info" titre="Mode hors-ligne">
              {erreur} — Les données affichées sont les valeurs par défaut.
              <div className="mt-2">
                <Bouton variante="ghost" taille="petit" onClick={chargerMatrice}>↻ Réessayer</Bouton>
              </div>
            </Alerte>
          )}
          {succesMessage && (
            <Alerte variante="succes" titre="✓ Succès">{succesMessage}</Alerte>
          )}

          {vue === "matrice" && (
            <>
              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <ChampRecherche placeholder="Filtrer par rôle..." onChange={(e) => setRechercheRole(e.target.value)} />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <ChampRecherche placeholder="Filtrer par module..." onChange={(e) => setRechercheModule(e.target.value)} />
                </div>
              </div>

              {roles.map((role) => {
                const roleModules = modulesParRole(role);
                if (roleModules.length === 0) return null;
                return (
                  <section key={role}>
                    <div className={`inline-block px-3 py-1 rounded-lg border text-xs font-bold uppercase mb-2 ${COULEURS_ROLES[role] || "bg-gray-100"}`}>
                      {role.replace(/_/g, " ")}
                    </div>
                    <div className="space-y-1.5">
                      {roleModules.map((mod) => {
                        const cle = `${mod.role_name}:${mod.module_key}`;
                        const enSauvegarde = sauvegardeEnCours === cle;
                        return (
                          <ModuleLigne
                            key={cle}
                            module={mod}
                            enSauvegarde={enSauvegarde}
                            onToggle={(champ) => basculerModule(mod, champ)}
                          />
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </>
          )}

          {vue === "overrides" && (
            <Carte titre="Overrides individuels">
              <p className="text-sm text-ardoise-clair mb-3">
                Permet de définir des permissions UI spécifiques pour un utilisateur donné.
              </p>
              <div className="space-y-3 max-w-lg">
                <div>
                  <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">ID de l'utilisateur</label>
                  <input
                    type="text"
                    value={overrideUtilisateurId}
                    onChange={(e) => setOverrideUtilisateurId(e.target.value)}
                    placeholder="UUID de l'utilisateur..."
                    className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Modules (JSON)</label>
                  <textarea
                    value={JSON.stringify(overrideModules, null, 2)}
                    onChange={(e) => {
                      try {
                        setOverrideModules(JSON.parse(e.target.value));
                      } catch {}
                    }}
                    rows={6}
                    className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm font-mono"
                    placeholder='{"creation_dossier": {"is_enabled": false}}'
                  />
                </div>
                {overrideResultat && (
                  <div className={`p-2.5 rounded-lg text-sm ${
                    overrideResultat.includes("succès") ? "bg-green-50 text-green-700 border border-green-300" : "bg-red-50 text-red-700 border border-red-300"
                  }`}>
                    {overrideResultat}
                  </div>
                )}
                <Bouton variante="primaire" chargement={overrideEnCours} disabled={!overrideUtilisateurId} onClick={sauvegarderOverrides}>
                  Sauvegarder les overrides
                </Bouton>
              </div>
            </Carte>
          )}
        </>
      )}

      <div className="flex gap-2 pt-3 border-t border-ardoise-clair/10">
        <Link href="/super-admin/droits">
          <Bouton variante="primaire" taille="petit">← Retour à la gestion des droits</Bouton>
        </Link>
        <Link href="/super-admin/tableau-de-bord">
          <Bouton variante="ghost" taille="petit">Tableau de bord</Bouton>
        </Link>
      </div>
    </div>
  );
}

function ModuleLigne({
  module: mod,
  enSauvegarde,
  onToggle,
}: {
  module: ModulePermission;
  enSauvegarde: boolean;
  onToggle: (champ: "is_enabled" | "is_read_only") => void;
}) {
  return (
    <div className="flex items-center justify-between p-2.5 bg-sable rounded-lg hover:bg-sable/80 transition-colors">
      <div className="flex-1">
        <p className="text-sm font-semibold text-ardoise">{mod.module_label || mod.module_key}</p>
        <p className="text-xs text-ardoise-clair">{mod.module_key}</p>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <span className={`text-xs ${mod.is_enabled ? "text-succes" : "text-terre"} font-semibold`}>
            {mod.is_enabled ? "Activé" : "Désactivé"}
          </span>
          <button
            onClick={() => onToggle("is_enabled")}
            disabled={enSauvegarde}
            className={`relative w-10 h-5 rounded-full transition-colors ${enSauvegarde ? "opacity-50" : mod.is_enabled ? "bg-succes" : "bg-gray-300"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${mod.is_enabled ? "translate-x-5" : ""}`} />
          </button>
        </label>
        {mod.is_enabled && (
          <label className="flex items-center gap-2 cursor-pointer">
            <span className={`text-xs ${mod.is_read_only ? "text-ocre" : "text-ardoise-clair"} font-semibold`}>R/O</span>
            <button
              onClick={() => onToggle("is_read_only")}
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
}