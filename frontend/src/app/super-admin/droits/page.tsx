"use client";

/**
 * Page super admin — Gestion complète des droits, rôles et permissions.
 * Matrice RBAC complète avec rôles, permissions par technologie.
 * Utilise des données statiques de secours si l'API est indisponible.
 */
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { clientAPI, ErreurAPI } from "@/services/client_api";

// ---------- Icônes SVG unifiées (palette Lagune) ----------

const COULEUR_ICONE = "currentColor";
const TAILLE_ICONE = 20;

function Icône({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <svg className={`flex-shrink-0 ${className}`} width={TAILLE_ICONE} height={TAILLE_ICONE} viewBox="0 0 24 24" fill="none" stroke={COULEUR_ICONE} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const ICÔNES_TECHNO: Record<string, ReactNode> = {
  profil:       <Icône><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Icône>,
  cnin:         <Icône><rect width="18" height="14" x="3" y="4" rx="2"/><path d="M8 10h8M8 14h4"/></Icône>,
  faciale:      <Icône><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></Icône>,
  score:        <Icône><path d="M18 20V10M12 20V4M6 20v-6"/></Icône>,
  consentements: <Icône><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/></Icône>,
  chatbot:      <Icône><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></Icône>,
  admin_users:  <Icône><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Icône>,
  admin_droits: <Icône><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></Icône>,
  admin_admins: <Icône><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><circle cx="12" cy="11" r="2"/><path d="M12 13v3"/></Icône>,
  audit:        <Icône><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></Icône>,
  configuration:<Icône><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></Icône>,
  alertes:      <Icône><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></Icône>,
};

function IcôneTechno({ id, className = "" }: { id: string; className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-ocre/10 text-ocre ${className}`}>
      {ICÔNES_TECHNO[id] || (
        <Icône><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></Icône>
      )}
    </span>
  );
}

// ---------- Types ----------

interface Technologie {
  id: string;
  nom: string;
  description: string;
  icone: string;
  roles_autorises: string[];
  niveau_acces: "critique" | "sensible" | "standard";
}

interface RolePermission {
  role: string;
  libelle: string;
  description: string;
  niveau: number;
  permissions: string[];
  technologies: string[];
}

interface AttributionRole {
  utilisateur_id: string;
  email: string;
  role: string;
  date_attribution: string;
  attribue_par: string;
}

// ---------- Données statiques de secours ----------

const ROLES_STATIQUES: RolePermission[] = [
  {
    role: "citoyen", libelle: "Citoyen", description: "Utilisateur standard DigiID", niveau: 1,
    permissions: ["Consulter mon profil", "Gérer mes consentements", "Voir mon score", "Scanner ma CNI", "Vérification faciale"],
    technologies: ["profil", "cnin", "faciale", "score", "consentements", "chatbot"],
  },
  {
    role: "agent", libelle: "Agent administratif", description: "Agent d'une administration publique", niveau: 2,
    permissions: ["Vérifier l'identité d'un citoyen", "Consulter les données publiques", "Lancer une vérification"],
    technologies: ["profil", "cnin", "faciale", "score", "chatbot"],
  },
  {
    role: "medecin", libelle: "Médecin", description: "Professionnel de santé habilité", niveau: 3,
    permissions: ["Accès au dossier médical", "Vérifier l'identité d'un patient", "Associer des documents médicaux"],
    technologies: ["profil", "cnin", "faciale", "score", "consentements", "chatbot"],
  },
  {
    role: "police", libelle: "Forces de l'ordre", description: "Agent des forces de sécurité intérieure", niveau: 3,
    permissions: ["Vérifier l'identité d'une personne", "Consulter l'historique des vérifications", "Lancer une alerte"],
    technologies: ["profil", "cnin", "faciale", "score", "chatbot"],
  },
  {
    role: "ong", libelle: "ONG", description: "Organisation non gouvernementale partenaire", niveau: 2,
    permissions: ["Vérifier l'identité des bénéficiaires", "Consulter les données autorisées", "Générer des rapports"],
    technologies: ["profil", "cnin", "faciale", "score", "chatbot"],
  },
  {
    role: "administrateur", libelle: "Administrateur", description: "Gestion du système et des utilisateurs", niveau: 4,
    permissions: ["Gérer les utilisateurs", "Consulter les statistiques", "Gérer les alertes", "Voir les logs", "Gérer les droits RBAC"],
    technologies: ["profil", "cnin", "faciale", "score", "chatbot", "admin_users", "admin_droits", "audit", "alertes"],
  },
  {
    role: "super_administrateur", libelle: "Super administrateur", description: "Accès complet et illimité au système", niveau: 5,
    permissions: ["Accès total au système", "Gérer les administrateurs", "Configurer le système", "Consulter l'audit", "Gérer les droits", "Accès à toutes les technologies"],
    technologies: ["profil", "cnin", "faciale", "score", "consentements", "chatbot", "admin_users", "admin_droits", "admin_admins", "audit", "configuration", "alertes"],
  },
];

const TECHNOLOGIES_STATIQUES: Technologie[] = [
  { id: "profil", nom: "Mon profil", description: "Gestion du profil utilisateur", icone: "profil", roles_autorises: ["citoyen", "agent", "medecin", "police", "ong", "administrateur", "super_administrateur"], niveau_acces: "standard" },
  { id: "cnin", nom: "Vérification CNI", description: "Scan et OCR de la Carte Nationale d'Identité", icone: "cnin", roles_autorises: ["citoyen", "agent", "medecin", "police", "ong", "administrateur", "super_administrateur"], niveau_acces: "standard" },
  { id: "faciale", nom: "Reconnaissance faciale", description: "Vérification visuelle, liveness, matching", icone: "faciale", roles_autorises: ["citoyen", "agent", "medecin", "police", "ong", "administrateur", "super_administrateur"], niveau_acces: "sensible" },
  { id: "score", nom: "Score de confiance", description: "Calcul et historique du score d'identité", icone: "score", roles_autorises: ["citoyen", "agent", "medecin", "police", "ong", "administrateur", "super_administrateur"], niveau_acces: "standard" },
  { id: "consentements", nom: "Consentements", description: "Gestion des consentements RGPD/CDP", icone: "consentements", roles_autorises: ["citoyen", "medecin", "ong", "super_administrateur"], niveau_acces: "sensible" },
  { id: "chatbot", nom: "Assistant DigiID", description: "Chatbot intelligent avec RAG", icone: "chatbot", roles_autorises: ["citoyen", "agent", "medecin", "police", "ong", "administrateur", "super_administrateur"], niveau_acces: "standard" },
  { id: "admin_users", nom: "Gestion des utilisateurs", description: "Liste, recherche, suspension", icone: "admin_users", roles_autorises: ["administrateur", "super_administrateur"], niveau_acces: "sensible" },
  { id: "admin_droits", nom: "Gestion des droits RBAC", description: "Matrice des permissions", icone: "admin_droits", roles_autorises: ["administrateur", "super_administrateur"], niveau_acces: "critique" },
  { id: "admin_admins", nom: "Gestion des administrateurs", description: "Création, suspension, réactivation", icone: "admin_admins", roles_autorises: ["super_administrateur"], niveau_acces: "critique" },
  { id: "audit", nom: "Journal d'audit", description: "Traçabilité immuable", icone: "audit", roles_autorises: ["administrateur", "super_administrateur"], niveau_acces: "sensible" },
  { id: "configuration", nom: "Configuration système", description: "Feature flags et paramètres", icone: "configuration", roles_autorises: ["super_administrateur"], niveau_acces: "critique" },
  { id: "alertes", nom: "Alertes sécurité", description: "Détection de fraudes", icone: "alertes", roles_autorises: ["administrateur", "super_administrateur"], niveau_acces: "sensible" },
];

// ---------- Page ----------

export default function PageSuperAdminDroits() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [technologies, setTechnologies] = useState<Technologie[]>(TECHNOLOGIES_STATIQUES);
  const [roles, setRoles] = useState<RolePermission[]>(ROLES_STATIQUES);
  const [dernieresAttributions] = useState<AttributionRole[]>([
    { utilisateur_id: "usr_001", email: "admin@digiid.sn", role: "administrateur", date_attribution: "2024-03-15", attribue_par: "Super Admin" },
    { utilisateur_id: "usr_002", email: "agent@mairie-dakar.sn", role: "agent", date_attribution: "2024-03-14", attribue_par: "admin@digiid.sn" },
    { utilisateur_id: "usr_003", email: "medecin@hopital.sn", role: "medecin", date_attribution: "2024-03-13", attribue_par: "admin@digiid.sn" },
  ]);
  const [chargement, setChargement] = useState(true);
  const [modeHorsLigne, setModeHorsLigne] = useState(false);
  const [vue, setVue] = useState<"matrice" | "roles" | "audit" | "assigner">("matrice");

  // État pour le formulaire d'assignation
  const [assignEmail, setAssignEmail] = useState("");
  const [assignRole, setAssignRole] = useState("citoyen");
  const [assignTechnologies, setAssignTechnologies] = useState<string[]>([]);
  const [assignChargement, setAssignChargement] = useState(false);
  const [assignResultat, setAssignResultat] = useState<{ succes: boolean; message: string } | null>(null);

  useEffect(() => {
    const charger = async () => {
      try {
        const [techs, rôles] = await Promise.all([
          clientAPI.get<Technologie[]>("/api/v1/admin/droits/technologies", { authentifie: true }),
          clientAPI.get<RolePermission[]>("/api/v1/admin/droits/roles", { authentifie: true }),
        ]);
        setTechnologies(techs);
        setRoles(rôles);
      } catch {
        setModeHorsLigne(true);
      } finally {
        setChargement(false);
      }
    };

    charger();
  }, []);

  return (
    <div className="space-y-8 apparition">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/super-admin/tableau-de-bord" className="hover:text-ocre transition-colors">
          Tableau de bord
        </Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Gestion des droits</span>
      </nav>

      {/* En-tête avec boutons */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Super administration</p>
          <h1 className="mt-1">Gestion des droits &amp; permissions</h1>
          <p className="text-ardoise-clair mt-2 max-w-2xl">
            Matrice RBAC complète. Gère qui peut accéder à chaque technologie
            et visualise l&apos;historique des attributions de rôles.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Link href="/super-admin/tableau-de-bord">
            <Bouton variante="ghost" taille="petit">← Retour</Bouton>
          </Link>
          <Link href="/super-admin/administrateurs">
            <Bouton variante="primaire" taille="petit">Gérer les admins</Bouton>
          </Link>
        </div>
      </div>

      {/* Bannière mode hors-ligne */}
      {modeHorsLigne && (
        <Alerte variante="info" titre="Données locales affichées">
          Les données de l'API distante ne sont pas disponibles. La matrice utilise les
          valeurs par défaut de la configuration DigiID. Reconnecte-toi au backend pour
          charger les données réelles.
        </Alerte>
      )}

      {chargement ? (
        <p className="text-ardoise-clair italic text-center py-12">Chargement de la matrice des droits...</p>
      ) : (
        <>
          {/* Onglets */}
          <div className="flex gap-2 border-b border-ardoise-clair/10 pb-2 flex-wrap">
            <button onClick={() => setVue("matrice")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${vue === "matrice" ? "bg-ocre text-white" : "text-ardoise-clair hover:text-ardoise"}`}>
              <Icône className="inline-block w-4 h-4 mr-1"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></Icône> Matrice complète
            </button>
            <button onClick={() => setVue("roles")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${vue === "roles" ? "bg-ocre text-white" : "text-ardoise-clair hover:text-ardoise"}`}>
              <Icône className="inline-block w-4 h-4 mr-1"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Icône> Rôles &amp; permissions
            </button>
            <button onClick={() => setVue("assigner")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${vue === "assigner" ? "bg-ocre text-white" : "text-ardoise-clair hover:text-ardoise"}`}>
              <Icône className="inline-block w-4 h-4 mr-1"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></Icône> Assigner un droit
            </button>
            <button onClick={() => setVue("audit")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${vue === "audit" ? "bg-ocre text-white" : "text-ardoise-clair hover:text-ardoise"}`}>
              <Icône className="inline-block w-4 h-4 mr-1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></Icône> Attributions récentes
            </button>
          </div>

          {/* Vue Matrice */}
          {vue === "matrice" && (
            <section className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-sable">
                      <th className="text-left px-4 py-3 text-xs uppercase text-ardoise-clair font-bold">Technologie</th>
                      {roles.map((r) => (
                        <th key={r.role} className="text-center px-3 py-3 text-xs uppercase text-ardoise-clair font-bold">{r.libelle}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {technologies.map((tech) => (
                      <tr key={tech.id} className="border-b border-ardoise-clair/10 hover:bg-sable/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-ocre/10 text-ocre text-sm font-bold">{ICÔNES_TECHNO[tech.id]}</span>
                            <div>
                              <p className="text-sm font-semibold text-ardoise">{tech.nom}</p>
                              <p className="text-xs text-ardoise-clair">{tech.description.slice(0, 50)}...</p>
                            </div>
                          </div>
                        </td>
                        {roles.map((r) => {
                          const autorise = tech.roles_autorises.includes(r.role);
                          return (
                            <td key={r.role} className="text-center px-3 py-3">
                              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${autorise ? "bg-green-500" : "bg-gray-200"}`}>
                                {autorise && (
                                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-ardoise-clair italic mt-2">
                ✓ = Accès autorisé &nbsp;·&nbsp; Vide = Accès refusé
              </p>
            </section>
          )}

          {/* Vue Rôles */}
          {vue === "roles" && (
            <section className="space-y-4">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {roles.map((role) => (
                  <CarteRoleComplete key={role.role} role={role} technologies={technologies} />
                ))}
              </div>
        </section>
          )}

          {/* Vue Audit */}
          {vue === "audit" && (
            <section className="space-y-4">
              <Carte titre="Dernières attributions de rôles">
                {dernieresAttributions.length === 0 ? (
                  <p className="text-ardoise-clair italic text-center py-8">Aucune attribution récente.</p>
                ) : (
                  <div className="space-y-2">
                    {dernieresAttributions.map((attr, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-sable rounded-lg">
                        <div>
                          <p className="text-sm font-semibold text-ardoise">{attr.email}</p>
                          <p className="text-xs text-ardoise-clair">
                            Rôle : <Badge variante="lagune">{attr.role}</Badge>
                          </p>
                        </div>
                        <div className="text-right text-xs text-ardoise-clair">
                          <p>Par : {attr.attribue_par}</p>
                          <p>{new Date(attr.date_attribution).toLocaleDateString("fr-FR")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Carte>
              <Link href="/super-admin/audit">
                <Bouton variante="ghost" taille="petit">📜 Voir tout le journal d'audit →</Bouton>
              </Link>
            </section>
          )}

          {/* Vue Assigner un droit */}
          {vue === "assigner" && (
            <section className="space-y-6">
              <Carte titre="📧 Assigner un droit à un email">
                <p className="text-sm text-ardoise-clair mb-6">
                  Attribue un rôle et des accès spécifiques à un utilisateur via son email.
                  L&apos;utilisateur recevra une notification de mise à jour de ses droits.
                </p>

                <div className="space-y-4 max-w-lg">
                  <div>
                    <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Email de l&apos;utilisateur</label>
                    <input type="email" value={assignEmail} onChange={(e) => setAssignEmail(e.target.value)}
                      placeholder="ex: utilisateur@digiid.sn"
                      className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Nouveau rôle</label>
                    <select value={assignRole} onChange={(e) => setAssignRole(e.target.value)}
                      className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm bg-white">
                      {roles.map((r) => (<option key={r.role} value={r.role}>{r.libelle}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-2">Technologies autorisées</label>
                    <div className="grid grid-cols-2 gap-2">
                      {technologies.map((tech) => (
                        <label key={tech.id} className="flex items-center gap-2 p-2 rounded-lg border border-ardoise-clair/10 hover:bg-sable cursor-pointer">
                          <input type="checkbox" checked={assignTechnologies.includes(tech.id)}
                            onChange={(e) => {
                              if (e.target.checked) setAssignTechnologies([...assignTechnologies, tech.id]);
                              else setAssignTechnologies(assignTechnologies.filter((t) => t !== tech.id));
                            }}
                            className="rounded border-ardoise-clair/30" />
                          <span className="text-sm"><span className="inline-flex items-center justify-center w-5 h-5 rounded bg-ocre/10 text-ocre mr-1">{ICÔNES_TECHNO[tech.id]}</span> {tech.nom}</span>
                        </label>
                      ))}
                    </div>
                    {assignTechnologies.length > 0 && (
                      <p className="text-xs text-ardoise-clair mt-2">{assignTechnologies.length} technologie(s) sélectionnée(s)</p>
                    )}
                  </div>
                  {assignResultat && (
                    <div className={`p-3 rounded-lg text-sm ${assignResultat.succes ? "bg-green-50 text-green-700 border border-green-300" : "bg-red-50 text-red-700 border border-red-300"}`}>
                      {assignResultat.succes ? "✓ " : "✗ "}{assignResultat.message}
                    </div>
                  )}
                  <div className="flex gap-3 pt-2">
                    <Bouton variante="primaire" taille="petit" chargement={assignChargement}
                      disabled={!assignEmail || assignTechnologies.length === 0}
                      onClick={async () => {
                        setAssignChargement(true);
                        setAssignResultat(null);
                        try {
                          const resultat = await clientAPI.post<{ succes: boolean; message: string }>(
                            "/api/v1/super-admin/droits/assigner",
                            { email: assignEmail, role: assignRole, technologies: assignTechnologies },
                            { authentifie: true }
                          );
                          setAssignResultat({ succes: true, message: resultat.message || "Droits assignés avec succès" });
                          setAssignEmail("");
                          setAssignTechnologies([]);
                        } catch (e) {
                          setAssignResultat({
                            succes: false,
                            message: e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de l'assignation",
                          });
                        } finally {
                          setAssignChargement(false);
                        }
                      }}>
                      📧 Assigner les droits
                    </Bouton>
                    <Bouton variante="ghost" taille="petit" onClick={() => { setAssignEmail(""); setAssignRole("citoyen"); setAssignTechnologies([]); setAssignResultat(null); }}>
                      Réinitialiser
                    </Bouton>
                  </div>
                </div>
              </Carte>

              <Carte titre="👥 Gestion des utilisateurs">
                <p className="text-sm text-ardoise-clair mb-4">
                  Tu peux aussi gérer les rôles et les permissions depuis la page de gestion
                  des utilisateurs avec une vue complète de chaque compte.
                </p>
                <Link href="/super-admin/utilisateurs">
                  <Bouton variante="secondaire" taille="petit">👥 Voir tous les utilisateurs →</Bouton>
                </Link>
              </Carte>
            </section>
          )}
        </>
      )}

      {/* Navigation */}
      <div className="flex gap-3 flex-wrap pt-4 border-t border-ardoise-clair/10">
        <Link href="/super-admin/administrateurs">
        <Bouton variante="primaire" taille="petit"><Icône className="w-4 h-4"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><circle cx="12" cy="11" r="2"/><path d="M12 13v3"/></Icône> Gérer les administrateurs</Bouton>
        </Link>
        <Link href="/super-admin/configuration">
        <Bouton variante="secondaire" taille="petit"><Icône className="w-4 h-4"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></Icône> Configuration</Bouton>
        </Link>
        <Link href="/super-admin/audit">
        <Bouton variante="ghost" taille="petit"><Icône className="w-4 h-4"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></Icône> Journal d'audit</Bouton>
        </Link>
      </div>
    </div>
  );
}

// ---------- Sous-composants ----------

function CarteRoleComplete({ role, technologies }: { role: RolePermission; technologies: Technologie[] }) {
  const couleurs: Record<string, string> = {
    citoyen: "border-gray-300 bg-white", agent: "border-blue-300 bg-blue-50", medecin: "border-green-300 bg-green-50",
    police: "border-indigo-300 bg-indigo-50", ong: "border-teal-300 bg-teal-50",
    administrateur: "border-purple-300 bg-purple-50", super_administrateur: "border-rose-300 bg-rose-50",
  };
  const badgeVar: Record<string, "lagune" | "succes" | "ocre" | "terre"> = {
    citoyen: "lagune", agent: "lagune", medecin: "succes", police: "succes", ong: "succes",
    administrateur: "ocre", super_administrateur: "terre",
  };
  const techsAutorisees = technologies.filter((t) => t.roles_autorises.includes(role.role));

  return (
    <div className={`rounded-xl border-2 p-5 ${couleurs[role.role] || "border-gray-200 bg-white"}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-800 capitalize">{role.libelle}</h3>
        <Badge variante={badgeVar[role.role] || "lagune"}>Niv. {role.niveau}</Badge>
      </div>
      <p className="text-sm text-gray-600 mb-3">{role.description}</p>
      <div className="mb-4">
        <p className="text-xs uppercase text-ardoise-clair font-semibold mb-2">Permissions</p>
        <div className="space-y-1">
          {role.permissions.map((perm, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-gray-700">
              <span className="text-green-500">✓</span>
              <span>{perm}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs uppercase text-ardoise-clair font-semibold mb-2">Technologies accessibles</p>
        <div className="flex flex-wrap gap-1.5">
          {techsAutorisees.map((t) => (
            <span key={t.id} className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-ocre/10 text-ocre mr-1">{ICÔNES_TECHNO[t.id]}</span> {t.nom}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
