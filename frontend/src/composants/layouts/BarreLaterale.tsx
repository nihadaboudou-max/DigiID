"use client";

/**
 * Barre latérale de navigation — design épuré aux couleurs DigiID.
 * Utilise la palette Lagune (principal), Ocre (accent), Sable (fond actif), Ardoise (texte).
 * Groupe de navigation compact, avec délimitations visuelles douces.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";

import { useAuthentification } from "@/contextes/authentification";
import {
  IconeAccueil, IconeUtilisateur, IconeScore, IconeChat,
  IconePartage, IconeParametres, IconeBouclier, IconeStatistique,
  IconeAlerte, IconeJournal, IconeCle, IconeVisage,
  IconeIdentite, IconeEmail, IconeCadenas, IconeScan, IconeFlecheBas,
  IconeCheck, IconeEnvoyer,
} from "@/composants/commun/Icones";
import type { RoleUtilisateur } from "@/types/api";
import { ROLES_CHEF, ROLES_AGENT, ROLES_ADMIN } from "@/types/api";
import { icon } from "leaflet";

interface Lien {
  href: string;
  libelle: string;
  Icone: typeof IconeAccueil;
}

interface SousMenu {
  titre: string;
  icone: typeof IconeAccueil;
  liens: Lien[];
}

// ---- Définition des menus ----

const LIENS_UTILISATEUR: Lien[] = [
  { href: "/tableau-de-bord",       libelle: "Tableau de bord",      Icone: IconeAccueil },
  { href: "/profil",                libelle: "Mon profil",           Icone: IconeUtilisateur },
  { href: "/documents-identite",    libelle: "Documents d'identité", Icone: IconeIdentite },
  { href: "/documents",             libelle: "Mes documents",         Icone: IconeJournal },
  { href: "/historique",            libelle: "Historique d'accès",    Icone: IconeAlerte },
  { href: "/notifications",         libelle: "Notifications",          Icone: IconeAlerte },
  { href: "/chatbot",               libelle: "Assistant",             Icone: IconeChat },
  { href: "/parametres",            libelle: "Paramètres",            Icone: IconeParametres },
];

// ---- Menu Score — Suivi et amélioration ----
const SOUS_MENUS_SCORE: SousMenu[] = [
  {
    titre: "Score",
    icone: IconeScore,
    liens: [
      { href: "/score", libelle: "Mon score actuel", Icone: IconeScore },
      { href: "/score/facteurs", libelle: "Facteurs d'impact", Icone: IconeStatistique },
      { href: "/score/amelioration", libelle: "Conseils d'amélioration", Icone: IconeAlerte },
      { href: "/parrainage", libelle: "Parrainage (bonus)", Icone: IconePartage },
      { href: "/badges", libelle: "Badges", Icone: IconeCheck },
    ],
  },
];

// ---- Menu Identité (avec sous-menus) ----
const SOUS_MENUS_IDENTITE: SousMenu[] = [
  {
    titre: "Vérifications",
    icone: IconeIdentite,
    liens: [
      { href: "/identite",                   libelle: "Tableau de bord",   Icone: IconeAccueil },
      { href: "/identite/verification-visuelle", libelle: "Reconnaissance faciale", Icone: IconeVisage },
      { href: "/identite/verification-cni",      libelle: "Scan CNI",             Icone: IconeScan },
    ],
  },
  {
    titre: "Sécurité",
    icone: IconeCadenas,
    liens: [
      { href: "/identite/email",    libelle: "Vérification email",  Icone: IconeEmail },
      { href: "/identite/2fa",      libelle: "Double authentification", Icone: IconeCadenas },
      { href: "/identite/mot-de-passe", libelle: "Mot de passe",        Icone: IconeCle },
      { href: "/identite/role",     libelle: "Rôle & permissions",    Icone: IconeBouclier },
    ],
  },
  {
    titre: "Partage & accès",
    icone: IconePartage,
    liens: [
      { href: "/citoyen/qr-code", libelle: "Mon QR Code", Icone: IconeScan },
      { href: "/partage",      libelle: "Partager mon DigiID",  Icone: IconePartage },
      { href: "/autorisations", libelle: "Autorisations",        Icone: IconeBouclier },
      { href: "/consentements", libelle: "Consentements",        Icone: IconeCheck },
    ],
  },
];

const LIENS_ADMIN_ACTIVITES: Lien[] = [
  { href: "/admin/activites/enrolements", libelle: "Agent terrain", Icone: IconeUtilisateur },
  { href: "/admin/activites/medical",     libelle: "Médical",      Icone: IconeStatistique },
  { href: "/admin/activites/police",      libelle: "Police",       Icone: IconeBouclier },
  { href: "/admin/activites/ong",         libelle: "ONG",          Icone: IconePartage },
];

const LIENS_ADMIN: Lien[] = [
  { href: "/admin/tableau-de-bord", libelle: "Tableau de bord", Icone: IconeAccueil },
  { href: "/admin/monitoring",      libelle: "Monitoring",       Icone: IconeStatistique },
  { href: "/admin/chefs", libelle: "Gestion des Chefs", Icone: IconeUtilisateur },
  { href: "/admin/utilisateurs",    libelle: "Utilisateurs",     Icone: IconeUtilisateur },
  { href: "/admin/departements", libelle: "Départements", Icone: IconeStatistique },
  { href: "/admin/invitations", libelle: "Invitations", Icone: IconeEnvoyer },
  { href: "/admin/attestations",    libelle: "Attestations",     Icone: IconeCheck },
  { href: "/admin/droits",          libelle: "Droits",           Icone: IconeBouclier },
  { href: "/admin/audit",           libelle: "Journal d'audit",  Icone: IconeJournal },
  { href: "/admin/alertes",         libelle: "Alertes",          Icone: IconeAlerte },
  { href: "/admin/statistiques",    libelle: "Statistiques",     Icone: IconeStatistique },
];

const LIENS_SUPER_ADMIN_ACTIVITES: Lien[] = [
  { href: "/super-admin/activites/enrolements", libelle: "Agent terrain", Icone: IconeUtilisateur },
  { href: "/super-admin/activites/medical",     libelle: "Médical",      Icone: IconeStatistique },
  { href: "/super-admin/activites/police",      libelle: "Police",       Icone: IconeBouclier },
  { href: "/super-admin/activites/ong",         libelle: "ONG",          Icone: IconePartage },
];

const LIENS_SUPER_ADMIN: Lien[] = [
  { href: "/super-admin/tableau-de-bord", libelle: "Tableau de bord", Icone: IconeAccueil },
  { href: "/super-admin/monitoring", libelle: "Monitoring", Icone: IconeStatistique },
  { href: "/super-admin/statistiques", libelle: "Statistiques", Icone: IconeStatistique },
  { href: "/super-admin/utilisateurs", libelle: "Utilisateurs", Icone: IconeUtilisateur },
  // ← NOUVEAUX LIENS AJOUTÉS
  { href: "/super-admin/domaines", libelle: "Domaines", Icone: IconeAccueil },
  { href: "/super-admin/departements", libelle: "Départements", Icone: IconeStatistique },
  { href: "/super-admin/invitations", libelle: "Invitations", Icone: IconeEnvoyer },
  // ← FIN NOUVEAUX LIENS
  { href: "/super-admin/administrateurs", libelle: "Administrateurs", Icone: IconeBouclier },
  { href: "/super-admin/attestations", libelle: "Attestations", Icone: IconeCheck },
  { href: "/super-admin/droits-ui", libelle: "Droits UI", Icone: IconeBouclier },
  { href: "/super-admin/droits", libelle: "Droits", Icone: IconeCle },
  { href: "/super-admin/audit", libelle: "Journal d'audit", Icone: IconeJournal },
  { href: "/super-admin/configuration", libelle: "Configuration", Icone: IconeParametres },
  { href: "/super-admin/mon-profil", libelle: "Mon profil", Icone: IconeUtilisateur },
];

// ---- Composant LienNav ----

function LienNav({ href, libelle, Icone, actif }: Lien & { actif: boolean }) {
  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group",
        actif
          ? "bg-sable text-lagune font-semibold shadow-sm"
          : "text-ardoise-clair hover:bg-sable/60 hover:text-ardoise",
      )}
    >
      <div
        className={clsx(
          "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 flex-shrink-0",
          actif
            ? "bg-lagune text-white shadow-sm"
            : "bg-sable-clair text-ardoise-clair group-hover:bg-lagune/10 group-hover:text-lagune",
        )}
      >
        <Icone className="w-4 h-4" />
      </div>
      <span className="truncate">{libelle}</span>
      {actif && (
        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-ocre animate-pulse" />
      )}
    </Link>
  );
}

// ---- Composant Groupe generique pliable ----

function GroupePlie({
  estActif,
  icone: Icone,
  titre,
  children,
  initialOuvert,
}: {
  estActif: boolean;
  icone: typeof IconeAccueil;
  titre: string;
  children: React.ReactNode;
  initialOuvert: boolean;
}) {
  const [ouvert, setOuvert] = useState(initialOuvert);

  return (
    <div className="space-y-1">
      {/* En-tête du groupe — cliquable */}
      <button
        type="button"
        onClick={() => setOuvert(!ouvert)}
        className={clsx(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 text-left",
          estActif
            ? "bg-sable/80 text-lagune font-semibold"
            : "text-ardoise-clair hover:bg-sable/40",
        )}
      >
        <div
          className={clsx(
            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
            estActif
              ? "bg-lagune text-white shadow-sm"
              : "bg-sable-clair text-ardoise-clair",
          )}
        >
          <Icone className="w-4 h-4" />
        </div>
        <span className="truncate text-xs uppercase tracking-wider font-bold flex-1">
          {titre}
        </span>
        {/* Chevron pivotant */}
        <IconeFlecheBas
          className={clsx(
            "w-4 h-4 flex-shrink-0 transition-transform duration-300",
            ouvert ? "rotate-0" : "-rotate-90",
            estActif ? "text-lagune" : "text-ardoise-clair/50",
          )}
        />
        {estActif && ouvert && (
          <span className="w-1.5 h-1.5 rounded-full bg-ocre animate-pulse flex-shrink-0" />
        )}
      </button>

      {/* Sous-menus avec animation */}
      <div
        className={clsx(
          "ml-3 pl-3 border-l-2 border-ardoise-clair/10 space-y-2 overflow-hidden transition-all duration-300",
          ouvert ? "max-h-96 opacity-100" : "max-h-0 opacity-0",
        )}
      >
        {children}
      </div>
    </div>
  );
}

// ---- Composant GroupeScore ----

function GroupeScore({
  pathname,
}: {
  pathname: string;
}) {
  const estDansScore = pathname.startsWith("/score") || pathname === "/parrainage";

  return (
    <GroupePlie
      estActif={estDansScore}
      icone={IconeScore}
      titre="Suivi &amp; Score"
      initialOuvert={estDansScore}
    >
      {SOUS_MENUS_SCORE.map((sousMenu) => (
        <div key={sousMenu.titre} className="space-y-0.5">
          <p className="text-[10px] uppercase tracking-wider text-ardoise-clair/40 font-semibold px-3 py-1">
            {sousMenu.titre}
          </p>
          {sousMenu.liens.map((lien) => {
            const actif = pathname === lien.href ||
              (lien.href === "/score" && pathname === "/score") ||
              (lien.href === "/score/facteurs" && pathname === "/score/facteurs") ||
              (lien.href === "/score/amelioration" && pathname === "/score/amelioration") ||
              (pathname === "/parrainage" && lien.href === "/parrainage");
            return (
              <Link
                key={lien.href}
                href={lien.href}
                className={clsx(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-200 group",
                  actif
                    ? "bg-sable/60 text-lagune font-medium"
                    : "text-ardoise-clair/70 hover:bg-sable/40 hover:text-ardoise",
                )}
              >
                <lien.Icone className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{lien.libelle}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </GroupePlie>
  );
}

// ---- Composant GroupeAttestations (sous-menus dépliables) ----
// Étape 4 : Module Attestations communautaires

function GroupeAttestations({
  pathname,
}: {
  pathname: string;
}) {
  const estDansAttestations = pathname.startsWith("/attestations-communautaires");

  return (
    <GroupePlie
      estActif={estDansAttestations}
      icone={IconeCheck}
      titre="Attestations"
      initialOuvert={estDansAttestations}
    >
      {/* Tableau de bord */}
      <div className="space-y-0.5">
        <p className="text-[10px] uppercase tracking-wider text-ardoise-clair/40 font-semibold px-3 py-1">
          Communauté
        </p>
        {[
          { href: "/attestations-communautaires", libelle: "Tableau de bord", Icone: IconeAccueil },
          { href: "/attestations-communautaires/nouvelle", libelle: "Nouvelle attestation", Icone: IconeEnvoyer },
        ].map((lien) => {
          const actif = pathname === lien.href;
          return (
            <Link
              key={lien.href}
              href={lien.href}
              className={clsx(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-200 group",
                actif
                  ? "bg-sable/60 text-lagune font-medium"
                  : "text-ardoise-clair/70 hover:bg-sable/40 hover:text-ardoise",
              )}
            >
              <lien.Icone className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{lien.libelle}</span>
            </Link>
          );
        })}
      </div>

      {/* Mes attestations */}
      <div className="space-y-0.5">
        <p className="text-[10px] uppercase tracking-wider text-ardoise-clair/40 font-semibold px-3 py-1">
          Mes attestations
        </p>
        {[
          { href: "/attestations-communautaires/recues", libelle: "Reçues", Icone: IconeFlecheBas },
          { href: "/attestations-communautaires/envoyees", libelle: "Envoyées", Icone: IconeEnvoyer },
          { href: "/attestations-communautaires/en-attente", libelle: "En attente", Icone: IconeAlerte },
        ].map((lien) => {
          const actif = pathname === lien.href;
          return (
            <Link
              key={lien.href}
              href={lien.href}
              className={clsx(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-200 group",
                actif
                  ? "bg-sable/60 text-lagune font-medium"
                  : "text-ardoise-clair/70 hover:bg-sable/40 hover:text-ardoise",
              )}
            >
              <lien.Icone className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{lien.libelle}</span>
            </Link>
          );
        })}
      </div>
    </GroupePlie>
  );
}

// ---- Composant GroupeIdentite (sous-menus dépliables) ----

function GroupeIdentite({
  pathname,
}: {
  pathname: string;
}) {
  const estDansIdentite = pathname.startsWith("/identite") ||
    pathname === "/verification-visuelle" ||
    pathname === "/verification-cni" ||
    pathname === "/parametres/2fa" ||
    pathname === "/parametres/role";

  return (
    <GroupePlie
      estActif={estDansIdentite}
      icone={IconeIdentite}
      titre="Identité"
      initialOuvert={estDansIdentite}
    >
      {SOUS_MENUS_IDENTITE.map((sousMenu) => (
        <div key={sousMenu.titre} className="space-y-0.5">
          <p className="text-[10px] uppercase tracking-wider text-ardoise-clair/40 font-semibold px-3 py-1">
            {sousMenu.titre}
          </p>
          {sousMenu.liens.map((lien) => {
            const actif = pathname === lien.href ||
              (lien.href === "/identite" && (
                pathname === "/identite" ||
                (pathname.startsWith("/identite") && !SOUS_MENUS_IDENTITE.some(sm =>
                  sm.liens.some(l => l.href !== "/identite" && pathname.startsWith(l.href))
                ))
              ));
            return (
              <Link
                key={lien.href}
                href={lien.href}
                className={clsx(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-200 group",
                  actif
                    ? "bg-sable/60 text-lagune font-medium"
                    : "text-ardoise-clair/70 hover:bg-sable/40 hover:text-ardoise",
                )}
              >
                <lien.Icone className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{lien.libelle}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </GroupePlie>
  );
}

// ---- Composant principal ----

export function BarreLaterale() {
  const pathname = usePathname();
  const { utilisateur } = useAuthentification();

  if (!utilisateur) return null;

  const estSuperAdmin = utilisateur.role === "super_administrateur" || utilisateur.role === "super_admin";
  const estAdmin = utilisateur.role === "administrateur" || utilisateur.role === "admin_domaine";
  const estDansActivitesAdmin = pathname.startsWith("/admin/activites");
  const estDansActivitesSuperAdmin = pathname.startsWith("/super-admin/activites");
  
  // ✅ CORRECTION : Ajout de la déclaration manquante `const estCitoyen =`
  const estCitoyen =
    pathname === "/tableau-de-bord" ||
    pathname === "/profil" ||
    pathname === "/documents" ||
    pathname === "/documents-identite" ||
    pathname === "/historique" ||
    pathname === "/notifications" ||
    pathname === "/chatbot" ||
    pathname === "/parametres" ||
    pathname.startsWith("/score") ||
    pathname === "/badges" ||
    pathname === "/parrainage" ||
    pathname.startsWith("/attestations-communautaires") ||
    pathname.startsWith("/identite") ||
    pathname.startsWith("/partage") ||
    pathname.startsWith("/autorisations") ||
    pathname.startsWith("/consentements") ||
    pathname === "/verification-visuelle";

  let liens: Lien[];
  let titreSection: string;
  let couleurLabel: string;
  let accentColor: string;

  if (estSuperAdmin) {
    liens = LIENS_SUPER_ADMIN;
    titreSection = "Super administration";
    couleurLabel = "text-ocre";
    accentColor = "bg-ocre";
  } else if (estAdmin) {
    liens = LIENS_ADMIN;
    titreSection = "Administration";
    couleurLabel = "text-terre";
    accentColor = "bg-terre";
  }

  // ─── NOUVEAUX RÔLES : Admin Domaine ──────────────────────────────
  else if (utilisateur.role === "admin_domaine") {
    liens = [
      { href: "/admin-domaine", libelle: "Tableau de bord", Icone: IconeAccueil },
      { href: "/admin-domaine/departements", libelle: "Départements", Icone: IconeIdentite },
      { href: "/admin-domaine/chefs", libelle: "Chefs de département", Icone: IconeBouclier },
      { href: "/admin-domaine/statistiques", libelle: "Statistiques", Icone: IconeStatistique },
      { href: "/admin-domaine/activites", libelle: "Activités", Icone: IconeJournal },
      { href: "/admin-domaine/invitations", libelle: "Invitations", Icone: IconeEnvoyer },
    ];
    titreSection = "Admin de Domaine";
    couleurLabel = "text-ocre";
    accentColor = "bg-ocre";
  }

  // ─── NOUVEAUX RÔLES : Chefs de Département ───────────────────────
  else if (utilisateur.role === "chef_police") {
    liens = [
      { href: "/chef-police", libelle: "Tableau de bord", Icone: IconeAccueil },
      { href: "/chef-police/equipe", libelle: "Mon équipe", Icone: IconeUtilisateur },
      { href: "/chef-police/invitations", libelle: "Invitations", Icone: IconeEnvoyer },
      { href: "/chef-police/recherche", libelle: "Recherche", Icone: IconeScan },
      { href: "/chef-police/statistiques", libelle: "Statistiques", Icone: IconeStatistique },
      { href: "/chef-police/activites", libelle: "Activités", Icone: IconeJournal },
      { href: "/chef-police/rapports", libelle: "Rapports", Icone: IconePartage },
    ];
    titreSection = "Chef Police";
    couleurLabel = "text-terre";
    accentColor = "bg-terre";
  } else if (utilisateur.role === "chef_medical") {
    liens = [
      { href: "/chef-medical", libelle: "Tableau de bord", Icone: IconeAccueil },
      { href: "/chef-medical/medecins", libelle: "Médecins", Icone: IconeUtilisateur },
      { href: "/chef-medical/invitations", libelle: "Invitations", Icone: IconeEnvoyer },
      { href: "/chef-medical/recherche", libelle: "Recherche", Icone: IconeScan },
      { href: "/chef-medical/statistiques", libelle: "Statistiques", Icone: IconeStatistique },
      { href: "/chef-medical/activites", libelle: "Activités", Icone: IconeJournal },
      { href: "/chef-medical/rapports", libelle: "Rapports", Icone: IconePartage },
    ];
    titreSection = "Chef Médical";
    couleurLabel = "text-lagune";
    accentColor = "bg-lagune";
  } else if (utilisateur.role === "chef_ong") {
    liens = [
      { href: "/chef-ong", libelle: "Tableau de bord", Icone: IconeAccueil },
      { href: "/chef-ong/agents", libelle: "Agents ONG", Icone: IconeUtilisateur },
      { href: "/chef-ong/invitations", libelle: "Invitations", Icone: IconeEnvoyer },
      { href: "/chef-ong/recherche", libelle: "Recherche", Icone: IconeScan },
      { href: "/chef-ong/missions", libelle: "Missions", Icone: IconeEnvoyer },
      { href: "/chef-ong/statistiques", libelle: "Statistiques", Icone: IconeStatistique },
      { href: "/chef-ong/rapports", libelle: "Rapports", Icone: IconePartage },
    ];
    titreSection = "Chef ONG";
    couleurLabel = "text-ocre";
    accentColor = "bg-ocre";
  } else if (utilisateur.role === "chef_agent") {
    liens = [
      { href: "/chef-enrolement", libelle: "Tableau de bord", Icone: IconeAccueil },
      { href: "/chef-enrolement/agents", libelle: "Agents terrain", Icone: IconeUtilisateur },
      { href: "/chef-enrolement/invitations", libelle: "Invitations", Icone: IconeEnvoyer },
      { href: "/chef-enrolement/recherche", libelle: "Recherche", Icone: IconeScan },
      { href: "/chef-enrolement/statistiques", libelle: "Statistiques", Icone: IconeStatistique },
      { href: "/chef-enrolement/activites", libelle: "Activités", Icone: IconeJournal },
      { href: "/chef-enrolement/rapports", libelle: "Rapports", Icone: IconePartage },
    ];
    titreSection = "Chef Enrôlement";
    couleurLabel = "text-lagune";
    accentColor = "bg-lagune";
  }

  // ─── RÔLES AGENTS  ──────────────────────────
  else if (utilisateur.role === "agent_medical") {
    liens = [
      { href: "/medecin/dashboard", libelle: "Tableau de bord", Icone: IconeAccueil },
      { href: "/medecin/nouveau-dossier", libelle: "Nouveau dossier", Icone: IconeUtilisateur },
      { href: "/medecin/dossiers", libelle: "Dossiers patients", Icone: IconeStatistique },
      { href: "/medecin/ordonnances", libelle: "Ordonnances", Icone: IconeJournal },
      { href: "/medecin/attestations", libelle: "Attestations", Icone: IconeCheck },
      { href: "/medecin/calendrier", libelle: "Calendrier", Icone: IconeParametres },
      { href: "/medecin/historique", libelle: "Historique", Icone: IconeAlerte },
    ];
    titreSection = "agent_medical";
    couleurLabel = "text-lagune";
    accentColor = "bg-lagune";
  } else if (utilisateur.role === "agent_terrain") {
    liens = [
      { href: "/agent/dashboard", libelle: "Tableau de bord", Icone: IconeAccueil },
      { href: "/agent/enrolement", libelle: "Enrôlement", Icone: IconeUtilisateur },
      { href: "/agent/scan", libelle: "Scan CNI", Icone: IconeScan },
      { href: "/agent/capture", libelle: "Capture biométrique", Icone: IconeIdentite },
    ];
    titreSection = "Agent terrain";
    couleurLabel = "text-lagune";
    accentColor = "bg-lagune";
  } else if (utilisateur.role === "agent_police") {
    liens = [
      { href: "/police/dashboard", libelle: "Tableau de bord", Icone: IconeAccueil },
      { href: "/police/verification", libelle: "Vérification", Icone: IconeBouclier },
      { href: "/police/recherche", libelle: "Recherche", Icone: IconeScan },
      { href: "/police/scan-qr", libelle: "Scan QR Code", Icone: IconeScan },
      { href: "/police/comparaison-photos", libelle: "Comparaison photos", Icone: IconeVisage },
      { href: "/police/carte", libelle: "Carte géographique", Icone: IconeStatistique },
      { href: "/police/alertes", libelle: "Alertes temps réel", Icone: IconeAlerte },
      { href: "/police/notes", libelle: "Notes internes", Icone: IconeJournal },
      { href: "/police/historique", libelle: "Historique", Icone: IconeJournal },
      { href: "/police/audit", libelle: "Journal d'audit", Icone: IconeBouclier },
      { href: "/police/export", libelle: "Export rapports", Icone: IconePartage },
      { href: "/police/signalement", libelle: "Signalements", Icone: IconeAlerte },
    ];
    titreSection = "Agent Police";
    couleurLabel = "text-terre";
    accentColor = "bg-terre";
  } else if (utilisateur.role === "agent_ong") {
    liens = [
      { href: "/ong/dashboard", libelle: "Tableau de bord", Icone: IconeAccueil },
      { href: "/ong/beneficiaires", libelle: "Bénéficiaires", Icone: IconeUtilisateur },
      { href: "/ong/programme", libelle: "Programmes", Icone: IconeStatistique },
      { href: "/ong/missions", libelle: "Missions terrain", Icone: IconeEnvoyer },
      { href: "/ong/attestations", libelle: "Attestations", Icone: IconeCheck },
    ];
    titreSection = "Agent ONG";
    couleurLabel = "text-ocre";
    accentColor = "bg-ocre";
  }

  // ─── CITOYEN (défaut) ────────────────────────────────────────────
  else {
    liens = [];  // Citoyen : les liens sont dans les groupes thématiques
    titreSection = "Navigation";
    couleurLabel = "text-lagune";
    accentColor = "bg-lagune";
  }

  /** Détermine si un lien est actif */
  const estActif = (lien: Lien): boolean => {
    if (pathname === lien.href) return true;
    const sansSlashFinal = lien.href.replace(/\/$/, "");
    if (sansSlashFinal !== lien.href && pathname === sansSlashFinal) return true;
    return false;
  };

  const initiales = utilisateur.prenom
    ? (utilisateur.prenom.charAt(0) + (utilisateur.nom?.charAt(0) || "")).toUpperCase()
    : utilisateur.email?.charAt(0).toUpperCase() || "?";

  return (
    <aside className="flex flex-col w-60 h-screen sticky top-0 bg-white border-r border-ardoise-clair/10 shadow-sm">
      {/* En-tête section — profil utilisateur */}
      <div className="px-4 pt-5 pb-4 border-b border-ardoise-clair/10">
        <div className="flex items-center gap-3">
          <div className={clsx(
            "w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm flex-shrink-0",
            accentColor
          )}>
            {initiales}
          </div>
          <div className="min-w-0">
            <p className={clsx("text-xs uppercase tracking-wider font-bold", couleurLabel)}>
              {titreSection}
            </p>
            <p className="text-sm text-ardoise truncate mt-0.5">
              {utilisateur.prenom
                ? `${utilisateur.prenom} ${utilisateur.nom || ""}`
                : utilisateur.email}
            </p>
          </div>
        </div>
      </div>

      {/* Barre de navigation — scrollable */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
        {/* Liens principaux du rôle (caché pour citoyen : groupes thématiques) */}
        {liens.length > 0 && (
          <div className="space-y-0.5">
            {liens.map((lien) => (
              <LienNav
                key={lien.href}
                href={lien.href}
                libelle={lien.libelle}
                Icone={lien.Icone}
                actif={estActif(lien)}
              />
            ))}
          </div>
        )}

        {/* Sous-menu Activités pour Admin */}
        {estAdmin && (
          <div className="pt-0.5">
            <GroupePlie
              estActif={estDansActivitesAdmin}
              icone={IconeStatistique}
              titre="Activités"
              initialOuvert={estDansActivitesAdmin}
            >
              <div className="space-y-0.5">
                {LIENS_ADMIN_ACTIVITES.map((lien) => {
                  const actif = pathname === lien.href;
                  return (
                    <Link
                      key={lien.href}
                      href={lien.href}
                      className={clsx(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-200 group",
                        actif
                          ? "bg-sable/60 text-lagune font-medium"
                          : "text-ardoise-clair/70 hover:bg-sable/40 hover:text-ardoise",
                      )}
                    >
                      <lien.Icone className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{lien.libelle}</span>
                    </Link>
                  );
                })}
              </div>
            </GroupePlie>
          </div>
        )}

        {/* Sous-menu Activités pour Super Admin */}
        {estSuperAdmin && (
          <div className="pt-0.5">
            <GroupePlie
              estActif={estDansActivitesSuperAdmin}
              icone={IconeStatistique}
              titre="Activités"
              initialOuvert={estDansActivitesSuperAdmin}
            >
              <div className="space-y-0.5">
                {LIENS_SUPER_ADMIN_ACTIVITES.map((lien) => {
                  const actif = pathname === lien.href;
                  return (
                    <Link
                      key={lien.href}
                      href={lien.href}
                      className={clsx(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-200 group",
                        actif
                          ? "bg-sable/60 text-lagune font-medium"
                          : "text-ardoise-clair/70 hover:bg-sable/40 hover:text-ardoise",
                      )}
                    >
                      <lien.Icone className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{lien.libelle}</span>
                    </Link>
                  );
                })}
              </div>
            </GroupePlie>
          </div>
        )}

        {/* Menu citoyen — visible uniquement pour les citoyens */}
        {utilisateur.role === "citoyen" && (
          <>
            <div className="border-t border-ardoise-clair/10 my-1.5" />
            {/* Mon espace personnel */}
            <GroupePlie
              estActif={pathname === "/tableau-de-bord" || pathname === "/profil" || pathname === "/documents" || pathname === "/historique" || pathname === "/notifications" || pathname.startsWith("/citoyen")}
              icone={IconeAccueil}
              titre="Mon espace"
              initialOuvert={true}
            >
              <div className="space-y-0.5">
                {[
                  { href: "/tableau-de-bord",       libelle: "Tableau de bord",      Icone: IconeAccueil },
                  { href: "/profil",                libelle: "Mon profil",           Icone: IconeUtilisateur },
                  { href: "/documents-identite",    libelle: "Documents d'identité", Icone: IconeIdentite },
                  { href: "/documents",             libelle: "Mes documents",         Icone: IconeJournal },
                  { href: "/historique",            libelle: "Historique d'accès",    Icone: IconeAlerte },
                  { href: "/notifications",         libelle: "Notifications",          Icone: IconeAlerte },
                ].map((lien) => {
                  const actif = pathname === lien.href;
                  return (
                    <Link
                      key={lien.href}
                      href={lien.href}
                      className={clsx(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-200 group",
                        actif
                          ? "bg-sable/60 text-lagune font-medium"
                          : "text-ardoise-clair/70 hover:bg-sable/40 hover:text-ardoise",
                      )}
                    >
                      <lien.Icone className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{lien.libelle}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Santé — Mes ordonnances */}
              <div className="space-y-0.5 mt-2">
                <p className="text-[10px] uppercase tracking-wider text-ardoise-clair/40 font-semibold px-3 py-1">
                  Santé
                </p>
                {[
                  { href: "/citoyen/mes-ordonnances", libelle: "Mes ordonnances", Icone: IconeJournal },
                  { href: "/citoyen/mon-dossier-medical", libelle: "Mon dossier médical", Icone: IconeStatistique },
                ].map((lien) => {
                  const actif = pathname === lien.href;
                  return (
                    <Link
                      key={lien.href}
                      href={lien.href}
                      className={clsx(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-200 group",
                        actif
                          ? "bg-sable/60 text-lagune font-medium"
                          : "text-ardoise-clair/70 hover:bg-sable/40 hover:text-ardoise",
                      )}
                    >
                      <lien.Icone className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{lien.libelle}</span>
                    </Link>
                  );
                })}
              </div>
            </GroupePlie>

            <div className="border-t border-ardoise-clair/10 my-1" />

            {/* Outils */}
            <GroupePlie
              estActif={pathname === "/chatbot" || pathname === "/parametres"}
              icone={IconeParametres}
              titre="Outils"
              initialOuvert={pathname === "/chatbot" || pathname === "/parametres"}
            >
              <div className="space-y-0.5">
                {[
                  { href: "/chatbot",    libelle: "Assistant",  Icone: IconeChat },
                  { href: "/parametres", libelle: "Paramètres", Icone: IconeParametres },
                  { href: "/aide",       libelle: "Aide",       Icone: IconeChat },
                ].map((lien) => {
                  const actif = pathname === lien.href;
                  return (
                    <Link
                      key={lien.href}
                      href={lien.href}
                      className={clsx(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-200 group",
                        actif
                          ? "bg-sable/60 text-lagune font-medium"
                          : "text-ardoise-clair/70 hover:bg-sable/40 hover:text-ardoise",
                      )}
                    >
                      <lien.Icone className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{lien.libelle}</span>
                    </Link>
                  );
                })}
              </div>
            </GroupePlie>

            <div className="border-t border-ardoise-clair/10 my-1" />

            <GroupeScore pathname={pathname} />

            <div className="border-t border-ardoise-clair/10 my-1" />

            <GroupeAttestations pathname={pathname} />

            <div className="border-t border-ardoise-clair/10 my-1" />

            <GroupeIdentite pathname={pathname} />
          </>
        )}
      </nav>
    </aside>
  );
}