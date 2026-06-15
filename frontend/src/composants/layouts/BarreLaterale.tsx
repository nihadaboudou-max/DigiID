"prouse client";

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
  { href: "/tableau-de-bord", libelle: "Tableau de bord", Icone: IconeAccueil },
  { href: "/profil",          libelle: "Mon profil",      Icone: IconeUtilisateur },
  { href: "/chatbot",         libelle: "Assistant",       Icone: IconeChat },
  { href: "/parametres",      libelle: "Paramètres",      Icone: IconeParametres },
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
  { href: "/admin/utilisateurs",    libelle: "Utilisateurs",     Icone: IconeUtilisateur },
  { href: "/admin/attestations",    libelle: "Attestations",     Icone: IconeCheck },
  { href: "/admin/droits",          libelle: "Droits",           Icone: IconeBouclier },
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
  { href: "/super-admin/tableau-de-bord", libelle: "Tableau de bord",  Icone: IconeAccueil },
  { href: "/super-admin/monitoring",      libelle: "Monitoring",       Icone: IconeStatistique },
  { href: "/super-admin/statistiques",    libelle: "Statistiques",     Icone: IconeStatistique },
  { href: "/super-admin/utilisateurs",    libelle: "Utilisateurs",     Icone: IconeUtilisateur },
  { href: "/super-admin/activites",       libelle: "Activités",       Icone: IconeStatistique },
  { href: "/super-admin/administrateurs", libelle: "Administrateurs",  Icone: IconeBouclier },
  { href: "/admin/attestations",          libelle: "Attestations",     Icone: IconeCheck },
  { href: "/super-admin/droits-ui",       libelle: "Droits UI",        Icone: IconeBouclier },
  { href: "/super-admin/droits",          libelle: "Droits",           Icone: IconeCle },
  { href: "/super-admin/audit",           libelle: "Journal d'audit",  Icone: IconeJournal },
  { href: "/super-admin/configuration",   libelle: "Configuration",    Icone: IconeParametres },
  { href: "/super-admin/mon-profil",      libelle: "Mon profil",       Icone: IconeUtilisateur },
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

  const estSuperAdmin = utilisateur.role === "super_administrateur";
  const estAdmin = utilisateur.role === "administrateur";
  const estDansActivitesAdmin = pathname.startsWith("/admin/activites");
  const estDansActivitesSuperAdmin = pathname.startsWith("/super-admin/activites");
  const estPro = utilisateur.role === "medecin" || utilisateur.role === "agent" || utilisateur.role === "police" || utilisateur.role === "ong";

  const estDansProfilCitoyen =
    pathname === "/tableau-de-bord" ||
    pathname === "/profil" ||
    pathname === "/chatbot" ||
    pathname === "/parametres" ||
    pathname.startsWith("/score") ||
    pathname === "/parrainage" ||
    pathname.startsWith("/attestations-communautaires") ||
    pathname.startsWith("/identite") ||
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
  } else if (utilisateur.role === "medecin") {
    liens = [
      { href: "/medecin/dashboard", libelle: "Tableau de bord", Icone: IconeAccueil },
      { href: "/medecin/nouveau-dossier", libelle: "Nouveau dossier", Icone: IconeUtilisateur },
      { href: "/medecin/dossiers", libelle: "Dossiers patients", Icone: IconeStatistique },
      { href: "/medecin/ordonnances", libelle: "Ordonnances", Icone: IconeJournal },
      { href: "/medecin/attestations", libelle: "Attestations", Icone: IconeCheck },
      { href: "/medecin/calendrier", libelle: "Calendrier", Icone: IconeParametres },
      { href: "/medecin/historique", libelle: "Historique", Icone: IconeAlerte },
    ];
    titreSection = "Espace médical";
    couleurLabel = "text-lagune";
    accentColor = "bg-lagune";
  } else if (utilisateur.role === "agent") {
    liens = [
      { href: "/agent/dashboard", libelle: "Tableau de bord", Icone: IconeAccueil },
      { href: "/agent/enrolement", libelle: "Enrôlement", Icone: IconeUtilisateur },
      { href: "/agent/scan", libelle: "Scan CNI", Icone: IconeScan },
    ];
    titreSection = "Agent terrain";
    couleurLabel = "text-lagune";
    accentColor = "bg-lagune";
  } else if (utilisateur.role === "police") {
    liens = [
      { href: "/police/dashboard", libelle: "Tableau de bord", Icone: IconeAccueil },
      { href: "/police/verification", libelle: "Vérification", Icone: IconeBouclier },
      { href: "/police/recherche", libelle: "Recherche", Icone: IconeScan },
      { href: "/police/signalement", libelle: "Signalements", Icone: IconeAlerte },
      { href: "/police/audit", libelle: "Audit", Icone: IconeJournal },
    ];
    titreSection = "Forces de l'ordre";
    couleurLabel = "text-terre";
    accentColor = "bg-terre";
  } else if (utilisateur.role === "ong") {
    liens = [
      { href: "/ong/dashboard", libelle: "Tableau de bord", Icone: IconeAccueil },
      { href: "/ong/beneficiaires", libelle: "Bénéficiaires", Icone: IconeUtilisateur },
      { href: "/ong/programme", libelle: "Programmes", Icone: IconeStatistique },
      { href: "/ong/missions", libelle: "Missions terrain", Icone: IconeEnvoyer },
      { href: "/ong/attestations", libelle: "Attestations", Icone: IconeCheck },
    ];
    titreSection = "ONG Partenaire";
    couleurLabel = "text-ocre";
    accentColor = "bg-ocre";
  } else {
    liens = LIENS_UTILISATEUR;
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
    <aside className="hidden md:flex md:flex-col w-60 h-screen sticky top-0 bg-white border-r border-ardoise-clair/10">
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
        {/* Liens principaux du rôle */}
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

        {/* Menu citoyen — visible pour TOUS les profils */}
        {(utilisateur.role === "citoyen" || estPro) && (
          <>
            <div className="border-t border-ardoise-clair/10 my-1.5" />

            {/* Si pro : groupe pliable 'Mon espace personnel' */}
            {estPro ? (
              <GroupePlie
                estActif={estDansProfilCitoyen}
                icone={IconeAccueil}
                titre="Mon espace personnel"
                initialOuvert={estDansProfilCitoyen}
              >
                {/* Liens citoyens de base */}
                <div className="space-y-0.5">
                  <p className="text-[10px] uppercase tracking-wider text-ardoise-clair/40 font-semibold px-3 py-1">
                    Navigation
                  </p>
                  {[
                    { href: "/tableau-de-bord", libelle: "Tableau de bord", Icone: IconeAccueil },
                    { href: "/profil",          libelle: "Mon profil",      Icone: IconeUtilisateur },
                    { href: "/chatbot",         libelle: "Assistant",       Icone: IconeChat },
                    { href: "/parametres",      libelle: "Paramètres",      Icone: IconeParametres },
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

                <div className="mt-1" />
                <GroupeScore pathname={pathname} />
                <GroupeAttestations pathname={pathname} />
                <GroupeIdentite pathname={pathname} />
              </GroupePlie>
            ) : (
              /* Citoyen : tout affiché directement */
              <>
                <GroupeScore pathname={pathname} />
                <div className="border-t border-ardoise-clair/10 my-1.5" />
                <GroupeAttestations pathname={pathname} />
                <div className="border-t border-ardoise-clair/10 my-1.5" />
                <GroupeIdentite pathname={pathname} />
              </>
            )}
          </>
        )}
      </nav>
    </aside>
  );
}
