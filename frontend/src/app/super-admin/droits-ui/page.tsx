"use client";
/**
Page Super Admin — Matrice des droits UI (version corrigée avec synchronisation).
Navigation par rôles : on clique sur un rôle pour voir ses droits.
*/
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import { ChampRecherche } from "@/composants/commun/ChampRecherche";
import { ErreurAPI } from "@/services/client_api";
import {
  obtenirMatricePermissions,
  mettreAJourModuleRole,
  modulesParDefaut,
} from "@/services/ui_permissions";
import type { ModulePermission } from "@/services/ui_permissions";

// ---------- Constantes ----------
const COULEURS_ROLES: Record<string, { bg: string; text: string; border: string; label: string; icone: string }> = {
  super_administrateur: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-300", label: "Super Admin", icone: "👑" },
  super_admin: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-300", label: "Super Admin", icone: "" },
  admin_domaine: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-300", label: "Admin Domaine", icone: "🌐" },
  administrateur: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-300", label: "Administrateur", icone: "⚙️" },
  chef_police: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-300", label: "Chef Police", icone: "👮" },
  chef_medical: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300", label: "Chef Médical", icone: "" },
  chef_ong: { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-300", label: "Chef ONG", icone: "🤝" },
  chef_agent: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-300", label: "Chef Enrôlement", icone: "" },
  agent_police: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-300", label: "Agent Police", icone: "👮" },
  agent_medical: { bg: "bg-green-50", text: "text-green-700", border: "border-green-300", label: "Agent Médical", icone: "🩺" },
  medecin: { bg: "bg-green-50", text: "text-green-700", border: "border-green-300", label: "Médecin", icone: "🩺" },
  agent_ong: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-300", label: "Agent ONG", icone: "🤝" },
  agent_terrain: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-300", label: "Agent Terrain", icone: "📋" },
  police: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-300", label: "Police", icone: "🚔" },
  ong: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-300", label: "ONG", icone: "🌍" },
  agent: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-300", label: "Agent", icone: "👤" },
  citoyen: { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-300", label: "Citoyen", icone: "" },
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
  "medecin",
  "agent_ong",
  "agent_terrain",
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
  const [roleSelectionne, setRoleSelectionne] = useState<string | null>(null);
  const [sauvegardeEnCours, setSauvegardeEnCours] = useState<string | null>(null);
  const [succesMessage, setSuccesMessage] = useState<string | null>(null);
  const [derniereSync, setDerniereSync] = useState<Date | null>(null);

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
      console.log("[Droits UI] Chargement de la matrice de permissions...");
      const data = await obtenirMatricePermissions();
      console.log("[Droits UI] Matrice chargée avec succès:", data.modules.length, "modules");
      setModules(data.modules);
      setDerniereSync(new Date());
    } catch (e) {
      console.error("[Droits UI] Erreur lors du chargement:", e);
      const modulesFallback: ModulePermission[] = [];
      for (const role of ORDRE_ROLES) {
        const defauts = modulesParDefaut(role);
        if (defauts.length > 0) {
          modulesFallback.push(...defauts);
        }
      }
      setModules(modulesFallback);
      setErreur("Utilisation des données de fallback. Vérifiez la connexion au backend.");
    } finally {
      setChargement(false);
    }
  };

  // Rôles uniques filtrés
  const rolesUniques = useMemo(() => {
    const roles = Array.from(new Set(modules.map((m) => m.role_name)));
    return roles
      .filter((r) => !recherche || r.toLowerCase().includes(recherche.toLowerCase()) || (COULEURS_ROLES[r]?.label || "").toLowerCase().includes(recherche.toLowerCase()))
      .sort((a, b) => {
        const ia = ORDRE_ROLES.indexOf(a);
        const ib = ORDRE_ROLES.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });
  }, [modules, recherche]);

  // Permissions du rôle sélectionné
  const permissionsRole = useMemo(() => {
    if (!roleSelectionne) return [];
    return modules
      .filter((m) => m.role_name === roleSelectionne)
      .filter((m) => !recherche || (m.module_label || "").toLowerCase().includes(recherche.toLowerCase()) || m.module_key.toLowerCase().includes(recherche.toLowerCase()))
      .sort((a, b) => (a.module_label || "").localeCompare(b.module_label || ""));
  }, [modules, roleSelectionne, recherche]);

  // Stats du rôle sélectionné
  const statsRole = useMemo(() => {
    if (!roleSelectionne) return null;
    const total = permissionsRole.length;
    const actives = permissionsRole.filter((m) => m.is_enabled).length;
    const lectureSeule = permissionsRole.filter((m) => m.is_read_only).length;
    return { total, actives, lectureSeule, tauxActivation: total > 0 ? Math.round((actives / total) * 100) : 0 };
  }, [permissionsRole, roleSelectionne]);

  // Basculer un module
  const basculerModule = useCallback(
    async (module: ModulePermission, champ: "is_enabled" | "is_read_only" = "is_enabled") => {
      const cleSauvegarde = `${module.role_name}:${module.module_key}:${champ}`;
      setSauvegardeEnCours(cleSauvegarde);
      setErreur(null);
      setSuccesMessage(null);
      
      try {
        console.log(`[Droits UI] Mise à jour de ${module.module_label} pour ${module.role_name}`);
        
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
        
        console.log("[Droits UI] Payload envoyé:", payload);
        await mettreAJourModuleRole(module.role_name, payload);
        console.log("[Droits UI] Mise à jour réussie, rechargement de la matrice...");
        
        // ✅ CORRECTION MAJEURE : Rechargement systématique après sauvegarde
        await chargerMatrice();
        
        const actionText = champ === "is_enabled" 
          ? (payload.is_enabled ? "activé" : "désactivé")
          : (payload.is_read_only ? "passé en lecture seule" : "passé en écriture");
        
        setSuccesMessage(`${module.module_label} ${actionText} pour ${COULEURS_ROLES[module.role_name]?.label || module.role_name}`);
        
        setTimeout(() => setSuccesMessage(null), 4000);
      } catch (e) {
        console.error("[Droits UI] Erreur lors de la sauvegarde:", e);
        setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de synchronisation avec le backend");
      } finally {
        setSauvegardeEnCours(null);
      }
    },
    []
  );

  // Activer/Désactiver tous les modules d'un rôle
  const basculerTous = useCallback(
    async (activer: boolean) => {
      if (!roleSelectionne) return;
      setSauvegardeEnCours("tous");
      setErreur(null);
      
      try {
        console.log(`[Droits UI] ${activer ? "Activation" : "Désactivation"} de tous les modules pour ${roleSelectionne}`);
        
        for (const perm of permissionsRole) {
          await mettreAJourModuleRole(roleSelectionne, {
            module_key: perm.module_key,
            is_enabled: activer,
            is_read_only: false,
          });
        }
        
        console.log("[Droits UI] Tous les modules mis à jour, rechargement...");
        await chargerMatrice();
        
        setSuccesMessage(`Tous les modules ${activer ? "activés" : "désactivés"} pour ${COULEURS_ROLES[roleSelectionne]?.label || roleSelectionne}`);
        setTimeout(() => setSuccesMessage(null), 4000);
      } catch (e) {
        console.error("[Droits UI] Erreur lors de la mise à jour massive:", e);
        setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur");
      } finally {
        setSauvegardeEnCours(null);
      }
    },
    [roleSelectionne, permissionsRole]
  );

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div>
        <p className="text-ocre font-semibold text-xs uppercase tracking-wider">Super administration</p>
        <h1 className="mt-1 text-2xl">Configuration des droits UI</h1>
        <p className="text-ardoise-clair mt-1 text-sm max-w-2xl">
          Cliquez sur un rôle pour configurer ses permissions par module. Les modifications sont synchronisées avec le backend.
        </p>
        {derniereSync && (
          <p className="text-xs text-ardoise-clair mt-2">
            Dernière synchronisation: {derniereSync.toLocaleTimeString("fr-FR")}
          </p>
        )}
      </div>

      {/* Statistiques globales */}
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
          {/* Sidebar - Liste des rôles */}
          <Carte className="md:col-span-1">
            <div className="space-y-3">
              <ChampRecherche
                placeholder="Rechercher un rôle..."
                value={recherche}
                onChange={(e) => {
                  setRecherche(e.target.value);
                  setRoleSelectionne(null);
                }}
              />
            </div>
            <div className="mt-4 space-y-1 max-h-[600px] overflow-y-auto">
              {rolesUniques.map((role) => {
                const isSelected = roleSelectionne === role;
                const couleur = COULEURS_ROLES[role];
                const nbModules = modules.filter((m) => m.role_name === role).length;
                const nbActives = modules.filter((m) => m.role_name === role && m.is_enabled).length;
                return (
                  <button
                    key={role}
                    onClick={() => setRoleSelectionne(role)}
                    className={`w-full text-left p-3 rounded-lg transition-all border-2 ${
                      isSelected
                        ? `${couleur?.bg || "bg-gray-100"} ${couleur?.border || "border-gray-300"} shadow-md`
                        : "bg-sable hover:bg-sable/80 border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{couleur?.icone || "👤"}</span>
                      <div className="flex-1">
                        <p className={`font-semibold text-sm ${isSelected ? couleur?.text || "text-ardoise" : "text-ardoise"}`}>
                          {couleur?.label || role}
                        </p>
                        <p className="text-xs text-ardoise-clair font-mono mt-0.5">{role}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-ardoise">{nbActives}/{nbModules}</p>
                        <p className="text-[10px] text-ardoise-clair">actifs</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Carte>

          {/* Panneau de détails */}
          <Carte className="md:col-span-2">
            {roleSelectionne ? (
              <div>
                {/* Header du rôle */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-ardoise-clair/10">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{COULEURS_ROLES[roleSelectionne]?.icone || ""}</span>
                    <div>
                      <h2 className={`text-xl font-bold ${COULEURS_ROLES[roleSelectionne]?.text || "text-ardoise"}`}>
                        {COULEURS_ROLES[roleSelectionne]?.label || roleSelectionne}
                      </h2>
                      <p className="text-sm text-ardoise-clair font-mono">{roleSelectionne}</p>
                    </div>
                  </div>
                  <Bouton variante="ghost" taille="petit" onClick={() => setRoleSelectionne(null)}>
                    ✕ Fermer
                  </Bouton>
                </div>

                {/* Stats du rôle */}
                {statsRole && (
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <div className="bg-sable rounded-lg p-3 text-center">
                      <p className="text-xl font-bold text-ardoise">{statsRole.total}</p>
                      <p className="text-[10px] uppercase text-ardoise-clair font-semibold">Modules</p>
                    </div>
                    <div className="bg-succes/10 rounded-lg p-3 text-center">
                      <p className="text-xl font-bold text-succes">{statsRole.actives}</p>
                      <p className="text-[10px] uppercase text-ardoise-clair font-semibold">Activés</p>
                    </div>
                    <div className="bg-ocre/10 rounded-lg p-3 text-center">
                      <p className="text-xl font-bold text-ocre">{statsRole.lectureSeule}</p>
                      <p className="text-[10px] uppercase text-ardoise-clair font-semibold">Lecture seule</p>
                    </div>
                    <div className="bg-lagune/10 rounded-lg p-3 text-center">
                      <p className="text-xl font-bold text-lagune">{statsRole.tauxActivation}%</p>
                      <p className="text-[10px] uppercase text-ardoise-clair font-semibold">Taux</p>
                    </div>
                  </div>
                )}

                {/* Actions rapides */}
                <div className="flex gap-2 mb-4">
                  <Bouton
                    variante="primaire"
                    taille="petit"
                    onClick={() => basculerTous(true)}
                    chargement={sauvegardeEnCours === "tous"}
                  >
                    ✓ Tout activer
                  </Bouton>
                  <Bouton
                    variante="danger"
                    taille="petit"
                    onClick={() => basculerTous(false)}
                    chargement={sauvegardeEnCours === "tous"}
                  >
                    ✗ Tout désactiver
                  </Bouton>
                </div>

                {/* Liste des modules */}
                <div className="space-y-2">
                  {permissionsRole.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-4xl mb-3">📋</p>
                      <p className="text-ardoise-clair italic">
                        {recherche ? "Aucun module ne correspond à votre recherche." : "Aucun module configuré pour ce rôle."}
                      </p>
                    </div>
                  ) : (
                    permissionsRole.map((perm) => {
                      const cleSauvegarde = `${perm.role_name}:${perm.module_key}`;
                      const enSauvegarde = sauvegardeEnCours?.startsWith(cleSauvegarde);
                      return (
                        <div
                          key={perm.module_key}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                            perm.is_enabled
                              ? "bg-succes/5 border-succes/20"
                              : "bg-sable border-ardoise-clair/10"
                          }`}
                        >
                          <div className="flex-1">
                            <p className="font-semibold text-sm text-ardoise">
                              {perm.module_label || perm.module_key}
                            </p>
                            <p className="text-xs text-ardoise-clair font-mono">{perm.module_key}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            {/* Toggle Activé/Désactivé */}
                            <label className="flex items-center gap-2 cursor-pointer">
                              <span className={`text-xs font-semibold ${perm.is_enabled ? "text-succes" : "text-terre"}`}>
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
                                <span className={`text-xs font-semibold ${perm.is_read_only ? "text-ocre" : "text-ardoise-clair"}`}>
                                  Lecture seule
                                </span>
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
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-4xl mb-3"></p>
                <p className="text-ardoise-clair italic">
                  {rolesUniques.length === 0
                    ? "Aucun rôle trouvé."
                    : "Sélectionnez un rôle pour voir ses permissions"}
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