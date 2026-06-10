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

const LIENS_ADMIN: Lien[] = [
  { href: "/admin/tableau-de-bord", libelle: "Tableau de bord", Icone: IconeAccueil },
  { href: "/admin/utilisateurs",    libelle: "Utilisateurs",     Icone: IconeUtilisateur },
  { href: "/admin/attestations",    libelle: "Attestations",     Icone: IconeCheck },
  { href: "/admin/droits",          libelle: "Droits",           Icone: IconeBouclier },
  { href: "/admin/alertes",         libelle: "Alertes",          Icone: IconeAlerte },
  { href: "/admin/statistiques",    libelle: "Statistiques",     Icone: IconeStatistique },
];

const LIENS_SUPER_ADMIN: Lien[] = [
  { href: "/super-admin/tableau-de-bord", libelle: "Tableau de bord",  Icone: IconeAccueil },
  { href: "/super-admin/statistiques",    libelle: "Statistiques",     Icone: IconeStatistique },
  { href: "/super-admin/utilisateurs",    libelle: "Utilisateurs",     Icone: IconeUtilisateur },
  { href: "/super-admin/administrateurs", libelle: "Administrateurs",  Icone: IconeBouclier },
  { href: "/admin/attestations",          libelle: "Attestations",     Icone: IconeCheck },
  { href: "/super-admin/droits",          libelle: "Droits",           Icone: IconeCle },
  { href: "/super-admin/audit",           libelle: "Audit",            Icone: IconeJournal },
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
    <aside className="hidden md:flex md:flex-col w-60 bg-white border-r border-ardoise-clair/10">
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

      {/* Barre de navigation */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-3">
        {/* Liens principaux */}
        <div className="space-y-1">
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

        {/* Séparateur */}
        <div className="border-t border-ardoise-clair/10 my-2" />

        {/* Menu Score — Suivi et amélioration */}
        <GroupeScore pathname={pathname} />

        <div className="border-t border-ardoise-clair/10 my-2" />

        {/* Menu Attestations Communautaires — Étape 4 */}
        <GroupeAttestations pathname={pathname} />

        <div className="border-t border-ardoise-clair/10 my-2" />

        {/* Menu Identité (accessible à tous les utilisateurs) */}
        <GroupeIdentite pathname={pathname} />
      </nav>

      {/* Pied — raccourci espace personnel pour admins */}
      {(estSuperAdmin || estAdmin) && (
        <div className="px-3 py-3 border-t border-ardoise-clir/10 mt-auto bg-sable/30">
          <p className="text-[10px] uppercase text-ardoise-clair/40 font-semibold tracking-wider px-3 mb-1.5">
            Espace personnel
          </p>
          <Link
            href="/tableau-de-bord"
            className={clsx(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200",
              pathname === "/tableau-de-bord" || (!pathname.startsWith("/super-admin") && !pathname.startsWith("/admin"))
                ? "bg-sable text-lagune font-semibold"
                : "text-ardoise-clair/60 hover:text-ardoise hover:bg-sable/60",
            )}
          >
            <div className={clsx(
              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
              pathname === "/tableau-de-bord" || (!pathname.startsWith("/super-admin") && !pathname.startsWith("/admin"))
                ? "bg-lagune text-white"
                : "bg-sable-clair text-ardoise-clair"
            )}>
              <IconeAccueil className="w-4 h-4" />
            </div>
            <span>Vue utilisateur</span>
          </Link>
        </div>
      )}
    </aside>
  );
}
