"use client";

/**
 * Page admin — Droits & permissions (vue consultative).
 * Affiche la matrice RBAC pour les profils utilisateur standards
 * (citoyen, agent, médecin, police, ONG).
 * La gestion complète (super admin, rôles critiques) est réservée au super admin.
 * Palette : Lagune (principal), Ocre (accent), Sable (fond), Ardoise (texte), Terre (alerte).
 */
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { clientAPI } from "@/services/client_api";

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
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-lagune/10 text-lagune ${className}`}>
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
}

// ---------- Données statiques de secours ----------

const ROLES_STATIQUES: RolePermission[] = [
  {
    role: "citoyen", libelle: "Citoyen", description: "Utilisateur standard DigiID", niveau: 1,
    permissions: ["Consulter mon profil", "Gérer mes consentements", "Voir mon score", "Scanner ma CNI", "Vérification faciale"],
  },
  {
    role: "agent", libelle: "Agent administratif", description: "Agent d'une administration publique", niveau: 2,
    permissions: ["Vérifier l'identité d'un citoyen", "Consulter les données publiques", "Lancer une vérification"],
  },
  {
    role: "medecin", libelle: "Médecin", description: "Professionnel de santé habilité", niveau: 3,
    permissions: ["Accès au dossier médical", "Vérifier l'identité d'un patient", "Associer des documents médicaux"],
  },
  {
    role: "police", libelle: "Forces de l'ordre", description: "Agent des forces de sécurité intérieure", niveau: 3,
    permissions: ["Vérifier l'identité d'une personne", "Consulter l'historique des vérifications", "Lancer une alerte"],
  },
  {
    role: "ong", libelle: "ONG", description: "Organisation non gouvernementale partenaire", niveau: 2,
    permissions: ["Vérifier l'identité des bénéficiaires", "Consulter les données autorisées", "Générer des rapports"],
  },
];

const TECHNOLOGIES_STATIQUES: Technologie[] = [
  { id: "profil", nom: "Mon profil", description: "Gestion du profil utilisateur", icone: "profil", roles_autorises: ["citoyen", "agent", "medecin", "police", "ong"], niveau_acces: "standard" },
  { id: "cnin", nom: "Vérification CNI", description: "Scan et OCR de la Carte Nationale d'Identité", icone: "cnin", roles_autorises: ["citoyen", "agent", "medecin", "police", "ong"], niveau_acces: "standard" },
  { id: "faciale", nom: "Reconnaissance faciale", description: "Vérification visuelle, détection de vivacité", icone: "faciale", roles_autorises: ["citoyen", "agent", "medecin", "police", "ong"], niveau_acces: "sensible" },
  { id: "score", nom: "Score de confiance", description: "Calcul et historique du score d'identité", icone: "score", roles_autorises: ["citoyen", "agent", "medecin", "police", "ong"], niveau_acces: "standard" },
  { id: "consentements", nom: "Consentements", description: "Gestion des consentements RGPD/CDP", icone: "consentements", roles_autorises: ["citoyen", "medecin", "ong"], niveau_acces: "sensible" },
  { id: "chatbot", nom: "Assistant DigiID", description: "Chatbot intelligent avec RAG", icone: "chatbot", roles_autorises: ["citoyen", "agent", "medecin", "police", "ong"], niveau_acces: "standard" },
];

// ---------- Page ----------

export default function PageGestionDroits() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [technologies, setTechnologies] = useState<Technologie[]>(TECHNOLOGIES_STATIQUES);
  const [roles, setRoles] = useState<RolePermission[]>(ROLES_STATIQUES);
  const [chargement, setChargement] = useState(true);
  const [modeHorsLigne, setModeHorsLigne] = useState(false);
  const [vueMatrice, setVueMatrice] = useState(true);

  useEffect(() => {
    const charger = async () => {
      try {
        const [techs, rôles] = await Promise.all([
          clientAPI.get<Technologie[]>("/api/v1/admin/droits/technologies", { authentifie: true }),
          clientAPI.get<RolePermission[]>("/api/v1/admin/droits/roles", { authentifie: true }),
        ]);
        setTechnologies(techs);
        // Filtrer les rôles admin : seuls les profils standards sont affichés ici
        setRoles(rôles.filter((r) => !["administrateur", "super_administrateur"].includes(r.role)));
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
        <Link href="/admin/tableau-de-bord" className="hover:text-lagune transition-colors">
          Tableau de bord
        </Link>
        <span className="text-ardoise-clair/30">/</span>
        <span className="text-ardoise font-semibold">Droits &amp; permissions</span>
      </nav>

      {/* En-tête */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-terre font-semibold text-sm uppercase tracking-wider">Administration</p>
          <h1 className="mt-1">Droits &amp; permissions</h1>
          <p className="text-ardoise-clair mt-2 max-w-2xl">
            Matrice des accès par rôle. Vue <strong>consultative</strong> des droits attribués
            aux profils utilisateur standards.
          </p>
        </div>
        <Link href="/admin/tableau-de-bord">
          <Bouton variante="ghost" taille="petit">← Retour</Bouton>
        </Link>
      </div>

      {/* Message de périmètre */}
      <div className="bg-sable rounded-xl border border-ardoise-clair/10 p-4">
        <div className="flex items-start gap-3">
          <Icône className="flex-shrink-0 mt-0.5 text-lagune"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></Icône>
          <div className="text-sm text-ardoise">
            <p className="font-semibold text-lagune mb-0.5">Périmètre de cette vue</p>
            <p className="text-ardoise-clair">
              Cette page présente les droits des <strong>profils utilisateur standards</strong> (citoyen, agent, médecin, police, ONG).
              La gestion complète — rôles administrateurs, droits critiques, assignation de permissions — est réservée au{' '}
              <Link href="/super-admin/droits" className="text-lagune font-semibold hover:underline">super administrateur →</Link>
            </p>
          </div>
        </div>
      </div>

      {modeHorsLigne && (
        <Alerte variante="info" titre="Données locales affichées">
          Les données de l'API ne sont pas disponibles. La matrice utilise les valeurs par défaut.
        </Alerte>
      )}

      {chargement ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-lagune border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-ardoise-clair italic">Chargement des droits...</p>
        </div>
      ) : (
        <>
          {/* Onglets */}
          <div className="flex gap-2 border-b border-ardoise-clair/10 pb-2">
            <button onClick={() => setVueMatrice(true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                vueMatrice
                  ? "bg-lagune text-white shadow-sm"
                  : "text-ardoise-clair hover:text-ardoise hover:bg-sable"
              }`}>
              <Icône><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></Icône> Matrice des accès
            </button>
            <button onClick={() => setVueMatrice(false)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                !vueMatrice
                  ? "bg-lagune text-white shadow-sm"
                  : "text-ardoise-clair hover:text-ardoise hover:bg-sable"
              }`}>
              <Icône><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Icône> Détail par rôle
            </button>
          </div>

          {/* === VUE MATRICE === */}
          {vueMatrice && (
            <section className="space-y-3">
              <div className="overflow-x-auto rounded-xl border border-ardoise-clair/10">
                <table className="w-full border-collapse bg-white">
                  <thead>
                    <tr className="bg-sable border-b border-ardoise-clair/10">
                      <th className="text-left px-4 py-3 text-xs uppercase text-ardoise-clair font-bold w-48">Technologie</th>
                      {roles.map((r) => (
                        <th key={r.role} className="text-center px-2 py-3 min-w-[100px]">
                          <div className="flex flex-col items-center gap-1">
                            <Badge variante={
                              r.role === "citoyen" ? "lagune" :
                              r.role === "agent" ? "lagune" :
                              r.role === "medecin" ? "succes" :
                              r.role === "police" ? "succes" :
                              "succes"
                            } taille="petit">Niv.{r.niveau}</Badge>
                            <span className="text-xs font-semibold text-ardoise">{r.libelle}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {technologies.map((tech) => {
                      const fondNiveau = tech.niveau_acces === "critique" ? "bg-terre/[0.02]" :
                        tech.niveau_acces === "sensible" ? "" : "";
                      return (
                        <tr key={tech.id} className={`border-b border-ardoise-clair/10 hover:bg-sable/50 transition-colors ${fondNiveau}`}>
                          <td className="px-4 py-3 border-r border-ardoise-clair/10">
                            <div className="flex items-center gap-3">
                              <IcôneTechno id={tech.id} />
                              <div>
                                <p className="text-sm font-semibold text-ardoise">{tech.nom}</p>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                  tech.niveau_acces === "critique" ? "bg-terre/10 text-terre" :
                                  tech.niveau_acces === "sensible" ? "bg-ocre/10 text-ocre-fonce" :
                                  "bg-green-100 text-green-700"
                                }`}>
                                  {tech.niveau_acces}
                                </span>
                              </div>
                            </div>
                          </td>
                          {roles.map((r) => {
                            const autorise = tech.roles_autorises.includes(r.role);
                            return (
                              <td key={r.role} className="text-center px-2 py-3">
                                {autorise ? (
                                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-600">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  </span>
                                ) : (
                                  <span className="text-ardoise-clair/30 text-sm">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-ardoise-clair italic">
                ✓ = accès autorisé &nbsp;·&nbsp; — = accès refusé
              </p>
            </section>
          )}

          {/* === VUE PAR RÔLE === */}
          {!vueMatrice && (
            <section className="space-y-3">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {roles.map((role) => (
                  <CarteRole key={role.role} role={role} technologies={technologies} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Navigation */}
      <div className="flex gap-3 flex-wrap pt-4 border-t border-ardoise-clair/10">
        <Link href="/admin/utilisateurs">
        <Bouton variante="primaire" taille="petit"><Icône className="w-4 h-4"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Icône> Gérer les utilisateurs</Bouton>
        </Link>
        <Link href="/admin/alertes">
        <Bouton variante="secondaire" taille="petit"><Icône className="w-4 h-4"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></Icône> Voir les alertes</Bouton>
        </Link>
        <Link href="/admin/statistiques">
        <Bouton variante="ghost" taille="petit"><Icône className="w-4 h-4"><path d="M18 20V10M12 20V4M6 20v-6"/></Icône> Statistiques</Bouton>
        </Link>
      </div>
    </div>
  );
}

// ─── Sous-composants ────────────────────────────────────────

function CarteRole({ role, technologies }: { role: RolePermission; technologies: Technologie[] }) {
  /** Palette DigiID : bande colorée en haut + fond blanc */
  const configCouleur: Record<string, { bande: string; badge: "lagune" | "succes" | "ocre" | "terre"; etiquette: string }> = {
    citoyen: { bande: "bg-lagune", badge: "lagune", etiquette: "Standard" },
    agent:   { bande: "bg-lagune", badge: "lagune", etiquette: "Service public" },
    medecin: { bande: "bg-[#16a34a]", badge: "succes", etiquette: "Santé" },
    police:  { bande: "bg-[#4f46e5]", badge: "succes", etiquette: "Sécurité" },
    ong:     { bande: "bg-[#0d9488]", badge: "succes", etiquette: "Humanitaire" },
  };

  const cfg = configCouleur[role.role] || configCouleur.citoyen;
  const techsAutorisees = technologies.filter((t) => t.roles_autorises.includes(role.role));

  return (
    <div className="bg-white rounded-xl border border-ardoise-clair/10 hover:shadow-chaud transition-all duration-200 overflow-hidden">
      {/* Bande colorée */}
      <div className={`h-1.5 ${cfg.bande}`} />

      <div className="p-5">
        {/* En-tête */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-ardoise">{role.libelle}</h3>
          <Badge variante={cfg.badge} taille="petit">{cfg.etiquette}</Badge>
        </div>

        <p className="text-sm text-ardoise-clair mb-3 line-clamp-2">{role.description}</p>

        {/* Résumé : nombre de permissions + technologies */}
        <div className="flex gap-3 text-xs text-ardoise-clair">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {role.permissions.length} permissions
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-lagune" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {techsAutorisees.length} technologies
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-ocre" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Niv. {role.niveau}
          </span>
        </div>
      </div>
    </div>
  );
}
