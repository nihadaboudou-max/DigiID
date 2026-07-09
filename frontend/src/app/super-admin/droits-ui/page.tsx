"use client";
/**
 * Page Super Admin — Matrice des droits UI (version améliorée).
 * Permet au Super Admin de configurer finement les modules UI
 * accessibles par chaque rôle.
 *
 * Améliorations :
 *   - Vue tableau croisé (rôles × modules)
 *   - Statistiques en temps réel
 *   - Actions rapides (dupliquer, reset, exporter)
 *   - Recherche globale
 *   - Indicateurs visuels améliorés
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
  const [vue, setVue] = useState<"tableau" | "liste" | "overrides">("tableau");
  const [recherche, setRecherche] = useState("");
  const [filtreRole, setFiltreRole] = useState<string>("tous");
  const [sauvegardeEnCours, setSauvegardeEnCours] = useState<string | null>(null);
  const [succesMessage, setSuccesMessage] = useState<string | null>(null);
  const [modaleDupliquer, setModaleDupliquer] = useState<{ roleSource: string; roleCible: string } | null>(null);

  // Overrides
  const [overrideUtilisateurId, setOverrideUtilisateurId] = useState("");
  const [overrideModules, setOverrideModules] = useState<Record<string, { is_enabled?: boolean; is_read_only?: boolean }>>({});
  const [overrideEnCours, setOverrideEnCours] = useState(false);
  const [overrideResultat, setOverrideResultat] = useState<string | null>(null);

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
      if (e instanceof ErreurAPI) {
        console.warn("⚠️ Droits UI : API indisponible, utilisation du fallback local");
      }
    } finally {
      setChargement(false);
    }
  };

  // Statistiques
  const stats = useMemo(() => {
    const rolesUniques = new Set(modules.map((m) => m.role_name));
    const modulesUniques = new Set(modules.map((m) => m.module_key));
    const actives = modules.filter((m) => m.is_enabled).length;
    const lectureSeule = modules.filter((m) => m.is_read_only).length;
    return {
      roles: rolesUniques.size,
      modules: modulesUniques.size,
      total: modules.length,
      actives,
      lectureSeule,
      tauxActivation: modules.length > 0 ? Math.round((actives / modules.length) * 100) : 0,
    };
  }, [modules]);

  // Modules uniques (lignes du tableau)
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

  // Rôles uniques (colonnes du tableau)
  const rolesUniques = useMemo(() => {
    const roles = Array.from(new Set(modules.map((m) => m.role_name)));
    return roles
      .filter((r) => filtreRole === "tous" || r === filtreRole)
      .sort((a, b) => {
        const ia = ORDRE_ROLES.indexOf(a);
        const ib = ORDRE_ROLES.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });
  }, [modules, filtreRole]);

  // Helper : trouver un module par rôle + clé
  const trouverModule = useCallback(
    (roleName: string, moduleKey: string) =>
      modules.find((m) => m.role_name === roleName && m.module_key === moduleKey),
    [modules]
  );

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
        const resultat = await mettreAJourModuleRole(module.role_name, payload);
        setModules((prev) =>
          prev.map((m) =>
            m.role_name === module.role_name && m.module_key === module.module_key
              ? { ...m, is_enabled: resultat.is_enabled, is_read_only: resultat.is_read_only }
              : m
          )
        );
        setSuccesMessage(
          `${module.module_label || module.module_key} → ${COULEURS_ROLES[module.role_name]?.label || module.role_name} mis à jour`
        );
        setTimeout(() => setSuccesMessage(null), 3000);
      } catch (e) {
        setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la mise à jour");
      } finally {
        setSauvegardeEnCours(null);
      }
    },
    []
  );

  // Dupliquer les permissions d'un rôle vers un autre
  const dupliquerPermissions = async () => {
    if (!modaleDupliquer) return;
    const { roleSource, roleCible } = modaleDupliquer;
    setSauvegardeEnCours("duplication");
    try {
      const modulesSource = modules.filter((m) => m.role_name === roleSource);
      for (const mod of modulesSource) {
        await mettreAJourModuleRole(roleCible, {
          module_key: mod.module_key,
          is_enabled: mod.is_enabled,
          is_read_only: mod.is_read_only,
        });
      }
      await chargerMatrice();
      setSuccesMessage(`Permissions de "${COULEURS_ROLES[roleSource]?.label || roleSource}" dupliquées vers "${COULEURS_ROLES[roleCible]?.label || roleCible}"`);
      setTimeout(() => setSuccesMessage(null), 4000);
      setModaleDupliquer(null);
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la duplication");
    } finally {
      setSauvegardeEnCours(null);
    }
  };

  // Overrides
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
      setOverrideResultat(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la sauvegarde");
    } finally {
      setOverrideEnCours(false);
    }
  };

  // Export CSV
  const exporterCSV = () => {
    const lignes = [["Rôle", "Module", "Clé", "Activé", "Lecture seule"]];
    for (const m of modules) {
      lignes.push([
        m.role_name,
        m.module_label || m.module_key,
        m.module_key,
        m.is_enabled ? "Oui" : "Non",
        m.is_read_only ? "Oui" : "Non",
      ]);
    }
    const csv = lignes.map((l) => l.join(",")).join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `droits-ui-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-ocre font-semibold text-xs uppercase tracking-wider">Super administration</p>
          <h1 className="mt-1 text-2xl">🔐 Configuration des droits UI</h1>
          <p className="text-ardoise-clair mt-1 text-sm max-w-2xl">
            Configure les modules UI accessibles par chaque rôle. Un module peut être{" "}
            <strong>activé/désactivé</strong> ou en <strong>lecture seule</strong>.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Bouton variante={vue === "tableau" ? "primaire" : "ghost"} taille="petit" onClick={() => setVue("tableau")}>
            📊 Tableau
          </Bouton>
          <Bouton variante={vue === "liste" ? "primaire" : "ghost"} taille="petit" onClick={() => setVue("liste")}>
            📋 Liste
          </Bouton>
          <Bouton variante={vue === "overrides" ? "primaire" : "ghost"} taille="petit" onClick={() => setVue("overrides")}>
            👤 Overrides
          </Bouton>
        </div>
      </div>

      {/* Statistiques */}
      {!chargement && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
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
            <p className="text-2xl font-bold text-ocre">{stats.lectureSeule}</p>
            <p className="text-[10px] uppercase text-ardoise-clair font-semibold">Lecture seule</p>
          </Carte>
          <Carte className="text-center p-3">
            <p className="text-2xl font-bold text-lagune">{stats.tauxActivation}%</p>
            <p className="text-[10px] uppercase text-ardoise-clair font-semibold">Taux activation</p>
          </Carte>
        </div>
      )}

      {/* Messages */}
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

      {chargement ? (
        <p className="text-ardoise-clair italic text-center py-6">Chargement de la matrice des droits UI...</p>
      ) : (
        <>
          {/* Filtres et actions */}
          <Carte>
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex-1 min-w-[200px]">
                <ChampRecherche
                  placeholder="Rechercher un module..."
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                />
              </div>
              <select
                value={filtreRole}
                onChange={(e) => setFiltreRole(e.target.value)}
                className="px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm"
              >
                <option value="tous">Tous les rôles</option>
                {ORDRE_ROLES.filter((r) => rolesUniques.includes(r)).map((r) => (
                  <option key={r} value={r}>
                    {COULEURS_ROLES[r]?.label || r}
                  </option>
                ))}
              </select>
              <Bouton variante="ghost" taille="petit" onClick={exporterCSV}>
                📥 Exporter CSV
              </Bouton>
              <Bouton
                variante="ghost"
                taille="petit"
                onClick={() => setModaleDupliquer({ roleSource: "", roleCible: "" })}
              >
                📋 Dupliquer
              </Bouton>
            </div>
          </Carte>

          {/* Vue Tableau croisé */}
          {vue === "tableau" && (
            <Carte>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ardoise-clair/20">
                      <th className="text-left p-2 font-semibold text-ardoise sticky left-0 bg-white z-10 min-w-[200px]">
                        Module
                      </th>
                      {rolesUniques.map((role) => {
                        const couleur = COULEURS_ROLES[role];
                        return (
                          <th
                            key={role}
                            className={`p-2 text-center font-semibold text-xs uppercase ${couleur?.bg || "bg-gray-100"} ${couleur?.text || "text-gray-700"} min-w-[100px]`}
                          >
                            {couleur?.label || role}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {modulesUniques.map((mod) => (
                      <tr key={mod.key} className="border-b border-ardoise-clair/10 hover:bg-sable/50">
                        <td className="p-2 sticky left-0 bg-white z-10">
                          <p className="font-semibold text-ardoise text-sm">{mod.label}</p>
                          <p className="text-xs text-ardoise-clair font-mono">{mod.key}</p>
                        </td>
                        {rolesUniques.map((role) => {
                          const m = trouverModule(role, mod.key);
                          if (!m) {
                            return (
                              <td key={role} className="p-2 text-center">
                                <span className="text-ardoise-clair/30">—</span>
                              </td>
                            );
                          }
                          const cleSauvegarde = `${m.role_name}:${m.module_key}`;
                          const enSauvegarde = sauvegardeEnCours?.startsWith(cleSauvegarde);
                          return (
                            <td key={role} className="p-2 text-center">
                              <CellulePermission
                                module={m}
                                enSauvegarde={!!enSauvegarde}
                                onToggle={(champ) => basculerModule(m, champ)}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Carte>
          )}

          {/* Vue Liste */}
          {vue === "liste" && (
            <div className="space-y-4">
              {rolesUniques.map((role) => {
                const roleModules = modulesFiltresParRole(role, modules, recherche);
                if (roleModules.length === 0) return null;
                const couleur = COULEURS_ROLES[role];
                return (
                  <section key={role}>
                    <div
                      className={`inline-block px-3 py-1 rounded-lg border text-xs font-bold uppercase mb-2 ${couleur?.bg || "bg-gray-100"} ${couleur?.text || "text-gray-700"} ${couleur?.border || "border-gray-300"}`}
                    >
                      {couleur?.label || role}
                    </div>
                    <div className="space-y-1.5">
                      {roleModules.map((mod) => {
                        const cle = `${mod.role_name}:${mod.module_key}`;
                        const enSauvegarde = sauvegardeEnCours?.startsWith(cle);
                        return (
                          <ModuleLigne
                            key={cle}
                            module={mod}
                            enSauvegarde={!!enSauvegarde}
                            onToggle={(champ) => basculerModule(mod, champ)}
                          />
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          {/* Vue Overrides */}
          {vue === "overrides" && (
            <Carte titre="👤 Overrides individuels">
              <p className="text-sm text-ardoise-clair mb-3">
                Permet de définir des permissions UI spécifiques pour un utilisateur donné, outrepassant les permissions de son rôle.
              </p>
              <div className="space-y-3 max-w-lg">
                <div>
                  <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                    ID de l'utilisateur
                  </label>
                  <input
                    type="text"
                    value={overrideUtilisateurId}
                    onChange={(e) => setOverrideUtilisateurId(e.target.value)}
                    placeholder="UUID de l'utilisateur..."
                    className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                    Modules (JSON)
                  </label>
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
                  <div
                    className={`p-2.5 rounded-lg text-sm ${
                      overrideResultat.includes("succès")
                        ? "bg-green-50 text-green-700 border border-green-300"
                        : "bg-red-50 text-red-700 border border-red-300"
                    }`}
                  >
                    {overrideResultat}
                  </div>
                )}
                <Bouton
                  variante="primaire"
                  chargement={overrideEnCours}
                  disabled={!overrideUtilisateurId}
                  onClick={sauvegarderOverrides}
                >
                  💾 Sauvegarder les overrides
                </Bouton>
              </div>
            </Carte>
          )}
        </>
      )}

      {/* Modale Duplication */}
      {modaleDupliquer && (
        <Modal
          ouvert={true}
          surFermeture={() => setModaleDupliquer(null)}
          titre="📋 Dupliquer les permissions"
          taille="moyen"
        >
          <div className="space-y-4">
            <p className="text-sm text-ardoise-clair">
              Copie toutes les permissions d'un rôle vers un autre. Les permissions existantes du rôle cible seront écrasées.
            </p>
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                Rôle source
              </label>
              <select
                value={modaleDupliquer.roleSource}
                onChange={(e) => setModaleDupliquer({ ...modaleDupliquer, roleSource: e.target.value })}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm"
              >
                <option value="">-- Sélectionner --</option>
                {rolesUniques.map((r) => (
                  <option key={r} value={r}>
                    {COULEURS_ROLES[r]?.label || r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                Rôle cible
              </label>
              <select
                value={modaleDupliquer.roleCible}
                onChange={(e) => setModaleDupliquer({ ...modaleDupliquer, roleCible: e.target.value })}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm"
              >
                <option value="">-- Sélectionner --</option>
                {rolesUniques.map((r) => (
                  <option key={r} value={r}>
                    {COULEURS_ROLES[r]?.label || r}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Bouton variante="ghost" onClick={() => setModaleDupliquer(null)}>
                Annuler
              </Bouton>
              <Bouton
                variante="primaire"
                chargement={sauvegardeEnCours === "duplication"}
                disabled={!modaleDupliquer.roleSource || !modaleDupliquer.roleCible || modaleDupliquer.roleSource === modaleDupliquer.roleCible}
                onClick={dupliquerPermissions}
              >
                📋 Dupliquer
              </Bouton>
            </div>
          </div>
        </Modal>
      )}

      {/* Pied de page */}
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

// ---------- Helper : filtrer modules par rôle ----------
function modulesFiltresParRole(role: string, modules: ModulePermission[], recherche: string) {
  return modules.filter((m) => {
    if (m.role_name !== role) return false;
    if (!recherche) return true;
    const terme = recherche.toLowerCase();
    return (
      (m.module_label || "").toLowerCase().includes(terme) ||
      m.module_key.toLowerCase().includes(terme)
    );
  });
}

// ---------- Cellule de permission (tableau) ----------
function CellulePermission({
  module: mod,
  enSauvegarde,
  onToggle,
}: {
  module: ModulePermission;
  enSauvegarde: boolean;
  onToggle: (champ: "is_enabled" | "is_read_only") => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={() => onToggle("is_enabled")}
        disabled={enSauvegarde}
        title={mod.is_enabled ? "Désactiver" : "Activer"}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
          enSauvegarde
            ? "opacity-50 cursor-wait"
            : mod.is_enabled
            ? "bg-succes/20 hover:bg-succes/30 text-succes"
            : "bg-gray-100 hover:bg-gray-200 text-gray-400"
        }`}
      >
        {mod.is_enabled ? "✓" : "✗"}
      </button>
      {mod.is_enabled && (
        <button
          onClick={() => onToggle("is_read_only")}
          disabled={enSauvegarde}
          title={mod.is_read_only ? "Lecture seule (cliquer pour édition)" : "Édition autorisée (cliquer pour lecture seule)"}
          className={`text-[10px] px-1.5 py-0.5 rounded transition-all ${
            enSauvegarde
              ? "opacity-50"
              : mod.is_read_only
              ? "bg-ocre/20 text-ocre font-semibold"
              : "bg-gray-100 text-gray-400 hover:bg-gray-200"
          }`}
        >
          {mod.is_read_only ? "RO" : "RW"}
        </button>
      )}
    </div>
  );
}

// ---------- Ligne de module (vue liste) ----------
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
        <p className="text-xs text-ardoise-clair font-mono">{mod.module_key}</p>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <span className={`text-xs ${mod.is_enabled ? "text-succes" : "text-terre"} font-semibold`}>
            {mod.is_enabled ? "Activé" : "Désactivé"}
          </span>
          <button
            onClick={() => onToggle("is_enabled")}
            disabled={enSauvegarde}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              enSauvegarde ? "opacity-50" : mod.is_enabled ? "bg-succes" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                mod.is_enabled ? "translate-x-5" : ""
              }`}
            />
          </button>
        </label>
        {mod.is_enabled && (
          <label className="flex items-center gap-2 cursor-pointer">
            <span className={`text-xs ${mod.is_read_only ? "text-ocre" : "text-ardoise-clair"} font-semibold`}>
              R/O
            </span>
            <button
              onClick={() => onToggle("is_read_only")}
              disabled={enSauvegarde}
              className={`relative w-8 h-4 rounded-full transition-colors ${
                enSauvegarde ? "opacity-50" : mod.is_read_only ? "bg-ocre" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${
                  mod.is_read_only ? "translate-x-4" : ""
                }`}
              />
            </button>
          </label>
        )}
      </div>
    </div>
  );
}