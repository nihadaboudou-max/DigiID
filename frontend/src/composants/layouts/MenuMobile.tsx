"use client";

/**
 * Menu mobile (hamburger) — version mobile de la BarreLaterale.
 * S'affiche sous la forme d'un drawer glissant depuis la gauche.
 * Palette : Lagune, Ocre, Sable, Ardoise.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";

import { useAuthentification } from "@/contextes/authentification";
import {
  IconeAccueil, IconeUtilisateur, IconeScore, IconeChat,
  IconePartage, IconeParametres, IconeBouclier, IconeStatistique,
  IconeAlerte, IconeJournal, IconeCle, IconeCheck, IconeFlecheBas, IconeVisage,
  IconeIdentite, IconeEmail, IconeCadenas, IconeScan, IconeEnvoyer,
} from "@/composants/commun/Icones";

interface Lien {
  href: string;
  libelle: string;
  Icone: typeof IconeAccueil;
}

const LIENS_UTILISATEUR: Lien[] = [
  { href: "/tableau-de-bord", libelle: "Tableau de bord", Icone: IconeAccueil },
  { href: "/profil",          libelle: "Mon profil",      Icone: IconeUtilisateur },
  { href: "/score",           libelle: "Mon score",       Icone: IconeScore },
  { href: "/chatbot",         libelle: "Assistant",       Icone: IconeChat },
  { href: "/parametres",      libelle: "Paramètres",      Icone: IconeParametres },
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
  { href: "/super-admin/monitoring",      libelle: "Monitoring",       Icone: IconeStatistique },
  { href: "/super-admin/statistiques",    libelle: "Statistiques",     Icone: IconeStatistique },
  { href: "/super-admin/utilisateurs",    libelle: "Utilisateurs",     Icone: IconeUtilisateur },
  { href: "/super-admin/administrateurs", libelle: "Administrateurs",  Icone: IconeBouclier },
  { href: "/admin/attestations",          libelle: "Attestations",     Icone: IconeCheck },
  { href: "/super-admin/droits-ui",       libelle: "Droits UI",        Icone: IconeBouclier },
  { href: "/super-admin/droits",          libelle: "Droits",           Icone: IconeCle },
  { href: "/super-admin/audit",           libelle: "Journal d'audit",  Icone: IconeJournal },
  { href: "/super-admin/configuration",   libelle: "Configuration",    Icone: IconeParametres },
  { href: "/super-admin/mon-profil",      libelle: "Mon profil",       Icone: IconeUtilisateur },
];

// ---- Composant section pliable mobile ----

function SectionPlieMobile({
  titre,
  couleur,
  initialOuvert,
  children,
}: {
  titre: string;
  couleur: string;
  initialOuvert: boolean;
  children: React.ReactNode;
}) {
  const [ouvert, setOuvert] = useState(initialOuvert);

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOuvert(!ouvert)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs uppercase font-bold tracking-wider"
      >
        <span className={couleur}>{titre}</span>
        <IconeFlecheBas
          className={clsx(
            "w-3.5 h-3.5 transition-transform duration-300",
            ouvert ? "rotate-0" : "-rotate-90",
            couleur,
          )}
        />
      </button>
      <div
        className={clsx(
          "overflow-hidden transition-all duration-300",
          ouvert ? "max-h-96 opacity-100" : "max-h-0 opacity-0",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function BoutonMenuMobile() {
  const [ouvert, setOuvert] = useState(false);
  const pathname = usePathname();
  const { utilisateur } = useAuthentification();

  if (!utilisateur) return null;

  const estSuperAdminRole = utilisateur.role === "super_administrateur";
  const estAdminRole = utilisateur.role === "administrateur";
  const estMedecin = utilisateur.role === "medecin";
  const estAgent = utilisateur.role === "agent";
  const estPolice = utilisateur.role === "police";
  const estOng = utilisateur.role === "ong";
  const estProfessionnel = estMedecin || estAgent || estPolice || estOng;

  const initiales = utilisateur.prenom
    ? (utilisateur.prenom.charAt(0) + (utilisateur.nom?.charAt(0) || "")).toUpperCase()
    : utilisateur.email?.charAt(0).toUpperCase() || "?";

  let couleurSection = "text-lagune";
  let bgCercle = "bg-lagune";
  let titreSection = "Menu";

  if (estSuperAdminRole) {
    couleurSection = "text-ocre";
    bgCercle = "bg-ocre";
    titreSection = "Super admin";
  } else if (estAdminRole) {
    couleurSection = "text-terre";
    bgCercle = "bg-terre";
    titreSection = "Admin";
  } else if (estMedecin) {
    couleurSection = "text-lagune";
    bgCercle = "bg-lagune";
    titreSection = "Espace médical";
  } else if (estAgent) {
    couleurSection = "text-lagune";
    bgCercle = "bg-lagune";
    titreSection = "Agent terrain";
  } else if (estPolice) {
    couleurSection = "text-terre";
    bgCercle = "bg-terre";
    titreSection = "Forces de l'ordre";
  } else if (estOng) {
    couleurSection = "text-ocre";
    bgCercle = "bg-ocre";
    titreSection = "ONG Partenaire";
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="md:hidden text-ardoise p-2 -m-2 hover:bg-sable rounded-lg transition-colors"
        aria-label="Ouvrir le menu"
      >
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {ouvert && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-ardoise/60 backdrop-blur-sm"
          onClick={() => setOuvert(false)}
        >
          <aside
            className="w-72 max-w-[80vw] h-full bg-white shadow-xl apparition overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête avec avatar */}
            <div className="p-5 border-b border-ardoise-clair/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    "w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm flex-shrink-0",
                    bgCercle
                  )}>
                    {initiales}
                  </div>
                  <div>
                    <p className={clsx("text-xs uppercase tracking-wider font-bold", couleurSection)}>
                      {titreSection}
                    </p>
                    <p className="text-sm text-ardoise truncate max-w-[140px]">
                      {utilisateur.prenom || utilisateur.email}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOuvert(false)}
                  aria-label="Fermer"
                  className="text-ardoise-clair hover:text-ardoise p-1.5 hover:bg-sable rounded-lg transition-colors"
                >
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Navigation */}
            <nav className="p-3">
              {estSuperAdminRole && (
                <>
                  {/* Section super admin */}
                  <SectionPlieMobile
                    titre="Super administration"
                    couleur="text-ocre"
                    initialOuvert={pathname.startsWith("/super-admin")}
                  >
                    <div className="pl-2">
                      {LIENS_SUPER_ADMIN.map(({ href, libelle, Icone }) => {
                        const actif = pathname.startsWith(href);
                        return (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setOuvert(false)}
                            className={clsx(
                              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5 transition-all duration-200",
                              actif
                                ? "bg-sable text-lagune font-semibold"
                                : "text-ardoise hover:bg-sable/60",
                            )}
                          >
                            <div className={clsx(
                              "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                              actif ? "bg-lagune text-white" : "bg-sable-clair text-ardoise-clair"
                            )}>
                              <Icone className="w-3.5 h-3.5" />
                            </div>
                            <span>{libelle}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </SectionPlieMobile>

                  {/* Section Score */}
                  <SectionPlieMobile
                    titre="Suivi &amp; Score"
                    couleur="text-ardoise-clair/50"
                    initialOuvert={pathname.startsWith("/score") || pathname === "/parrainage"}
                  >
                    <div className="ml-2 pl-3 border-l-2 border-ardoise-clair/10 space-y-0.5 mb-3">
                      {[
                        { href: "/score", libelle: "Mon score actuel", Icone: IconeScore },
                        { href: "/score/facteurs", libelle: "Facteurs d'impact", Icone: IconeStatistique },
                        { href: "/score/amelioration", libelle: "Conseils d'amélioration", Icone: IconeAlerte },
                        { href: "/parrainage", libelle: "Parrainage (bonus)", Icone: IconePartage },
                      ].map(({ href, libelle, Icone }) => {
                        const actif = pathname === href || pathname.startsWith(href);
                        return (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setOuvert(false)}
                            className={clsx(
                              "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-200 group",
                              actif
                                ? "bg-sable/60 text-lagune font-medium"
                                : "text-ardoise-clair/70 hover:bg-sable/40 hover:text-ardoise",
                            )}
                          >
                            <Icone className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{libelle}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </SectionPlieMobile>

                  {/* Section Attestations */}
                  <SectionPlieMobile
                    titre="Attestations"
                    couleur="text-ardoise-clair/50"
                    initialOuvert={pathname.startsWith("/attestations-communautaires")}
                  >
                    <div className="ml-2 pl-3 border-l-2 border-ardoise-clair/10 space-y-0.5 mb-3">
                      {[
                        { href: "/attestations-communautaires", libelle: "Tableau de bord", Icone: IconeAccueil },
                        { href: "/attestations-communautaires/nouvelle", libelle: "Nouvelle attestation", Icone: IconeEnvoyer },
                        { href: "/attestations-communautaires/recues", libelle: "Reçues", Icone: IconeFlecheBas },
                        { href: "/attestations-communautaires/envoyees", libelle: "Envoyées", Icone: IconeEnvoyer },
                        { href: "/attestations-communautaires/en-attente", libelle: "En attente", Icone: IconeAlerte },
                      ].map(({ href, libelle, Icone }) => {
                        const actif = pathname === href;
                        return (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setOuvert(false)}
                            className={clsx(
                              "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-200 group",
                              actif
                                ? "bg-sable/60 text-lagune font-medium"
                                : "text-ardoise-clair/70 hover:bg-sable/40 hover:text-ardoise",
                            )}
                          >
                            <Icone className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{libelle}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </SectionPlieMobile>

                  {/* Section Identité */}
                  <SectionPlieMobile
                    titre="Identité"
                    couleur="text-ardoise-clair/50"
                    initialOuvert={pathname.startsWith("/identite")}
                  >
                    <div className="ml-2 pl-3 border-l-2 border-ardoise-clair/10 space-y-0.5 mb-3">
                      {[
                        { href: "/identite", libelle: "Tableau de bord identité", Icone: IconeAccueil },
                        { href: "/identite/verification-visuelle", libelle: "Reconnaissance faciale", Icone: IconeVisage },
                        { href: "/identite/verification-cni", libelle: "Scan CNI", Icone: IconeScan },
                        { href: "/identite/email", libelle: "Vérification email", Icone: IconeEmail },
                        { href: "/identite/2fa", libelle: "Double authentification", Icone: IconeCadenas },
                        { href: "/identite/mot-de-passe", libelle: "Mot de passe", Icone: IconeCle },
                        { href: "/identite/role", libelle: "Rôle &amp; permissions", Icone: IconeBouclier },
                      ].map(({ href, libelle, Icone }) => {
                        const actif = pathname === href || pathname.startsWith(href);
                        return (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setOuvert(false)}
                            className={clsx(
                              "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-200 group",
                              actif
                                ? "bg-sable/60 text-lagune font-medium"
                                : "text-ardoise-clair/70 hover:bg-sable/40 hover:text-ardoise",
                            )}
                          >
                            <Icone className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{libelle}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </SectionPlieMobile>

                  {/* Section espace personnel */}
                  <SectionPlieMobile
                    titre="Mon espace"
                    couleur="text-ardoise-clair/50"
                    initialOuvert={pathname === "/tableau-de-bord" || pathname === "/profil"}
                  >
                    <div className="pl-2">
                      <Link
                        href="/tableau-de-bord"
                        onClick={() => setOuvert(false)}
                        className={clsx(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5 transition-all duration-200",
                          pathname === "/tableau-de-bord"
                            ? "bg-sable text-lagune font-semibold"
                            : "text-ardoise-clair hover:text-ardoise hover:bg-sable/60",
                        )}
                      >
                        <div className={clsx(
                          "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                          pathname === "/tableau-de-bord" ? "bg-lagune text-white" : "bg-sable-clair text-ardoise-clair"
                        )}>
                          <IconeAccueil className="w-3.5 h-3.5" />
                        </div>
                        <span>Accueil utilisateur</span>
                      </Link>
                      <Link
                        href="/profil"
                        onClick={() => setOuvert(false)}
                        className={clsx(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5 transition-all duration-200",
                          pathname === "/profil"
                            ? "bg-sable text-lagune font-semibold"
                            : "text-ardoise-clair hover:text-ardoise hover:bg-sable/60",
                        )}
                      >
                        <div className={clsx(
                          "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                          pathname === "/profil" ? "bg-lagune text-white" : "bg-sable-clair text-ardoise-clair"
                        )}>
                          <IconeUtilisateur className="w-3.5 h-3.5" />
                        </div>
                        <span>Mon profil personnel</span>
                      </Link>
                    </div>
                  </SectionPlieMobile>
                </>
              )}

              {/* Admin normal */}
              {estAdminRole && !estSuperAdminRole && (
                <div>
                  <SectionPlieMobile
                    titre="Administration"
                    couleur="text-terre"
                    initialOuvert={pathname.startsWith("/admin")}
                  >
                    <div className="pl-2">
                      {LIENS_ADMIN.map(({ href, libelle, Icone }) => {
                        const actif = pathname.startsWith(href);
                        return (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setOuvert(false)}
                            className={clsx(
                              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5 transition-all duration-200",
                              actif
                                ? "bg-sable text-lagune font-semibold"
                                : "text-ardoise hover:bg-sable/60",
                            )}
                          >
                            <div className={clsx(
                              "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                              actif ? "bg-lagune text-white" : "bg-sable-clair text-ardoise-clair"
                            )}>
                              <Icone className="w-3.5 h-3.5" />
                            </div>
                            <span>{libelle}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </SectionPlieMobile>

                  {/* Section Score */}
                  <SectionPlieMobile
                    titre="Suivi &amp; Score"
                    couleur="text-ardoise-clair/50"
                    initialOuvert={pathname.startsWith("/score") || pathname === "/parrainage"}
                  >
                    <div className="ml-2 pl-3 border-l-2 border-ardoise-clair/10 space-y-0.5 mb-3">
                      {[
                        { href: "/score", libelle: "Mon score actuel", Icone: IconeScore },
                        { href: "/score/facteurs", libelle: "Facteurs d'impact", Icone: IconeStatistique },
                        { href: "/score/amelioration", libelle: "Conseils d'amélioration", Icone: IconeAlerte },
                        { href: "/parrainage", libelle: "Parrainage (bonus)", Icone: IconePartage },
                      ].map(({ href, libelle, Icone }) => {
                        const actif = pathname === href || pathname.startsWith(href);
                        return (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setOuvert(false)}
                            className={clsx(
                              "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-200 group",
                              actif
                                ? "bg-sable/60 text-lagune font-medium"
                                : "text-ardoise-clair/70 hover:bg-sable/40 hover:text-ardoise",
                            )}
                          >
                            <Icone className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{libelle}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </SectionPlieMobile>

                  {/* Section Attestations */}
                  <SectionPlieMobile
                    titre="Attestations"
                    couleur="text-ardoise-clair/50"
                    initialOuvert={pathname.startsWith("/attestations-communautaires")}
                  >
                    <div className="ml-2 pl-3 border-l-2 border-ardoise-clair/10 space-y-0.5 mb-3">
                      {[
                        { href: "/attestations-communautaires", libelle: "Tableau de bord", Icone: IconeAccueil },
                        { href: "/attestations-communautaires/nouvelle", libelle: "Nouvelle attestation", Icone: IconeEnvoyer },
                        { href: "/attestations-communautaires/recues", libelle: "Reçues", Icone: IconeFlecheBas },
                        { href: "/attestations-communautaires/envoyees", libelle: "Envoyées", Icone: IconeEnvoyer },
                        { href: "/attestations-communautaires/en-attente", libelle: "En attente", Icone: IconeAlerte },
                      ].map(({ href, libelle, Icone }) => {
                        const actif = pathname === href;
                        return (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setOuvert(false)}
                            className={clsx(
                              "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-200 group",
                              actif
                                ? "bg-sable/60 text-lagune font-medium"
                                : "text-ardoise-clair/70 hover:bg-sable/40 hover:text-ardoise",
                            )}
                          >
                            <Icone className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{libelle}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </SectionPlieMobile>

                  {/* Section Identité */}
                  <SectionPlieMobile
                    titre="Identité"
                    couleur="text-ardoise-clair/50"
                    initialOuvert={pathname.startsWith("/identite")}
                  >
                    <div className="ml-2 pl-3 border-l-2 border-ardoise-clair/10 space-y-0.5 mb-3">
                      {[
                        { href: "/identite", libelle: "Tableau de bord identité", Icone: IconeAccueil },
                        { href: "/identite/verification-visuelle", libelle: "Reconnaissance faciale", Icone: IconeVisage },
                        { href: "/identite/verification-cni", libelle: "Scan CNI", Icone: IconeScan },
                        { href: "/identite/email", libelle: "Vérification email", Icone: IconeEmail },
                        { href: "/identite/2fa", libelle: "Double authentification", Icone: IconeCadenas },
                        { href: "/identite/mot-de-passe", libelle: "Mot de passe", Icone: IconeCle },
                        { href: "/identite/role", libelle: "Rôle &amp; permissions", Icone: IconeBouclier },
                      ].map(({ href, libelle, Icone }) => {
                        const actif = pathname === href || pathname.startsWith(href);
                        return (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setOuvert(false)}
                            className={clsx(
                              "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-200 group",
                              actif
                                ? "bg-sable/60 text-lagune font-medium"
                                : "text-ardoise-clair/70 hover:bg-sable/40 hover:text-ardoise",
                            )}
                          >
                            <Icone className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{libelle}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </SectionPlieMobile>

                  <div className="mt-2 pt-2 border-t border-ardoise-clair/10">
                    <SectionPlieMobile
                      titre="Mon espace"
                      couleur="text-ardoise-clair/50"
                      initialOuvert={pathname === "/tableau-de-bord" || pathname === "/profil"}
                    >
                      <div className="pl-2">
                        <Link
                          href="/tableau-de-bord"
                          onClick={() => setOuvert(false)}
                          className={clsx(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                            pathname === "/tableau-de-bord"
                              ? "bg-sable text-lagune font-semibold"
                              : "text-ardoise-clair hover:text-ardoise hover:bg-sable/60",
                          )}
                        >
                          <div className={clsx(
                            "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                            pathname === "/tableau-de-bord" ? "bg-lagune text-white" : "bg-sable-clair text-ardoise-clair"
                          )}>
                            <IconeAccueil className="w-3.5 h-3.5" />
                          </div>
                          <span>Mon espace utilisateur</span>
                        </Link>
                      </div>
                    </SectionPlieMobile>
                  </div>
                </div>
              )}

              {/* Rôles professionnels : Médecin */}
              {estMedecin && (
                <SectionPlieMobile
                  titre="Espace médical"
                  couleur="text-lagune"
                  initialOuvert={true}
                >
                  <div className="pl-2">
                    {[
                      { href: "/medecin/dashboard", libelle: "Tableau de bord", Icone: IconeAccueil },
                      { href: "/medecin/nouveau-dossier", libelle: "Nouveau dossier", Icone: IconeUtilisateur },
                      { href: "/medecin/dossiers", libelle: "Dossiers patients", Icone: IconeStatistique },
                      { href: "/medecin/ordonnances", libelle: "Ordonnances", Icone: IconeJournal },
                      { href: "/medecin/attestations", libelle: "Attestations", Icone: IconeCheck },
                    ].map(({ href, libelle, Icone }) => {
                      const actif = pathname === href || pathname.startsWith(href);
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setOuvert(false)}
                          className={clsx(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5 transition-all duration-200",
                            actif
                              ? "bg-sable text-lagune font-semibold"
                              : "text-ardoise hover:bg-sable/60",
                          )}
                        >
                          <div className={clsx(
                            "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                            actif ? "bg-lagune text-white" : "bg-sable-clair text-ardoise-clair"
                          )}>
                            <Icone className="w-3.5 h-3.5" />
                          </div>
                          <span>{libelle}</span>
                        </Link>
                      );
                    })}
                  </div>
                </SectionPlieMobile>
              )}

              {/* Rôles professionnels : Agent */}
              {estAgent && (
                <SectionPlieMobile
                  titre="Agent terrain"
                  couleur="text-lagune"
                  initialOuvert={true}
                >
                  <div className="pl-2">
                    {[
                      { href: "/agent/dashboard", libelle: "Tableau de bord", Icone: IconeAccueil },
                      { href: "/agent/enrolement", libelle: "Enrôlement", Icone: IconeUtilisateur },
                      { href: "/agent/scan", libelle: "Scan CNI", Icone: IconeScan },
                    ].map(({ href, libelle, Icone }) => {
                      const actif = pathname === href || pathname.startsWith(href);
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setOuvert(false)}
                          className={clsx(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5 transition-all duration-200",
                            actif
                              ? "bg-sable text-lagune font-semibold"
                              : "text-ardoise hover:bg-sable/60",
                          )}
                        >
                          <div className={clsx(
                            "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                            actif ? "bg-lagune text-white" : "bg-sable-clair text-ardoise-clair"
                          )}>
                            <Icone className="w-3.5 h-3.5" />
                          </div>
                          <span>{libelle}</span>
                        </Link>
                      );
                    })}
                  </div>
                </SectionPlieMobile>
              )}

              {/* Rôles professionnels : Police */}
              {estPolice && (
                <SectionPlieMobile
                  titre="Forces de l'ordre"
                  couleur="text-terre"
                  initialOuvert={true}
                >
                  <div className="pl-2">
                    {[
                      { href: "/police/dashboard", libelle: "Tableau de bord", Icone: IconeAccueil },
                      { href: "/police/verification", libelle: "Vérification", Icone: IconeBouclier },
                      { href: "/police/recherche", libelle: "Recherche", Icone: IconeScan },
                      { href: "/police/signalement", libelle: "Signalements", Icone: IconeAlerte },
                      { href: "/police/audit", libelle: "Audit", Icone: IconeJournal },
                    ].map(({ href, libelle, Icone }) => {
                      const actif = pathname === href || pathname.startsWith(href);
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setOuvert(false)}
                          className={clsx(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5 transition-all duration-200",
                            actif
                              ? "bg-sable text-lagune font-semibold"
                              : "text-ardoise hover:bg-sable/60",
                          )}
                        >
                          <div className={clsx(
                            "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                            actif ? "bg-lagune text-white" : "bg-sable-clair text-ardoise-clair"
                          )}>
                            <Icone className="w-3.5 h-3.5" />
                          </div>
                          <span>{libelle}</span>
                        </Link>
                      );
                    })}
                  </div>
                </SectionPlieMobile>
              )}

              {/* Rôles professionnels : ONG */}
              {estOng && (
                <SectionPlieMobile
                  titre="ONG Partenaire"
                  couleur="text-ocre"
                  initialOuvert={true}
                >
                  <div className="pl-2">
                    {[
                      { href: "/ong/dashboard", libelle: "Tableau de bord", Icone: IconeAccueil },
                      { href: "/ong/beneficiaires", libelle: "Bénéficiaires", Icone: IconeUtilisateur },
                      { href: "/ong/programme", libelle: "Programmes", Icone: IconeStatistique },
                      { href: "/ong/missions", libelle: "Missions terrain", Icone: IconeEnvoyer },
                      { href: "/ong/attestations", libelle: "Attestations", Icone: IconeCheck },
                    ].map(({ href, libelle, Icone }) => {
                      const actif = pathname === href || pathname.startsWith(href);
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setOuvert(false)}
                          className={clsx(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5 transition-all duration-200",
                            actif
                              ? "bg-sable text-lagune font-semibold"
                              : "text-ardoise hover:bg-sable/60",
                          )}
                        >
                          <div className={clsx(
                            "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                            actif ? "bg-lagune text-white" : "bg-sable-clair text-ardoise-clair"
                          )}>
                            <Icone className="w-3.5 h-3.5" />
                          </div>
                          <span>{libelle}</span>
                        </Link>
                      );
                    })}
                  </div>
                </SectionPlieMobile>
              )}

              {/* Citoyen — utilisateur normal */}
              {!estSuperAdminRole && !estAdminRole && !estProfessionnel && (
                <div>
                  <SectionPlieMobile
                    titre="Navigation"
                    couleur="text-lagune"
                    initialOuvert={true}
                  >
                    <div className="pl-2">
                      {LIENS_UTILISATEUR.map(({ href, libelle, Icone }) => {
                        const actif = pathname === href;
                        return (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setOuvert(false)}
                            className={clsx(
                              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5 transition-all duration-200",
                              actif
                                ? "bg-sable text-lagune font-semibold"
                                : "text-ardoise hover:bg-sable/60",
                            )}
                          >
                            <div className={clsx(
                              "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                              actif ? "bg-lagune text-white" : "bg-sable-clair text-ardoise-clair"
                            )}>
                              <Icone className="w-3.5 h-3.5" />
                            </div>
                            <span>{libelle}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </SectionPlieMobile>

                  {/* Section Score */}
                  <SectionPlieMobile
                    titre="Suivi &amp; Score"
                    couleur="text-ardoise-clair/50"
                    initialOuvert={pathname.startsWith("/score") || pathname === "/parrainage"}
                  >
                    <div className="ml-2 pl-3 border-l-2 border-ardoise-clair/10 space-y-0.5 mb-3">
                      {[
                        { href: "/score", libelle: "Mon score actuel", Icone: IconeScore },
                        { href: "/score/facteurs", libelle: "Facteurs d'impact", Icone: IconeStatistique },
                        { href: "/score/amelioration", libelle: "Conseils d'amélioration", Icone: IconeAlerte },
                        { href: "/parrainage", libelle: "Parrainage (bonus)", Icone: IconePartage },
                      ].map(({ href, libelle, Icone }) => {
                        const actif = pathname === href || pathname.startsWith(href);
                        return (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setOuvert(false)}
                            className={clsx(
                              "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-200 group",
                              actif
                                ? "bg-sable/60 text-lagune font-medium"
                                : "text-ardoise-clair/70 hover:bg-sable/40 hover:text-ardoise",
                            )}
                          >
                            <Icone className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{libelle}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </SectionPlieMobile>

                  {/* Section Attestations */}
                  <SectionPlieMobile
                    titre="Attestations"
                    couleur="text-ardoise-clair/50"
                    initialOuvert={pathname.startsWith("/attestations-communautaires")}
                  >
                    <div className="ml-2 pl-3 border-l-2 border-ardoise-clair/10 space-y-0.5 mb-3">
                      {[
                        { href: "/attestations-communautaires", libelle: "Tableau de bord", Icone: IconeAccueil },
                        { href: "/attestations-communautaires/nouvelle", libelle: "Nouvelle attestation", Icone: IconeEnvoyer },
                        { href: "/attestations-communautaires/recues", libelle: "Reçues", Icone: IconeFlecheBas },
                        { href: "/attestations-communautaires/envoyees", libelle: "Envoyées", Icone: IconeEnvoyer },
                        { href: "/attestations-communautaires/en-attente", libelle: "En attente", Icone: IconeAlerte },
                      ].map(({ href, libelle, Icone }) => {
                        const actif = pathname === href;
                        return (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setOuvert(false)}
                            className={clsx(
                              "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-200 group",
                              actif
                                ? "bg-sable/60 text-lagune font-medium"
                                : "text-ardoise-clair/70 hover:bg-sable/40 hover:text-ardoise",
                            )}
                          >
                            <Icone className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{libelle}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </SectionPlieMobile>

                  {/* Section Identité */}
                  <SectionPlieMobile
                    titre="Identité"
                    couleur="text-ardoise-clair/50"
                    initialOuvert={pathname.startsWith("/identite")}
                  >
                    <div className="ml-2 pl-3 border-l-2 border-ardoise-clair/10 space-y-0.5 mb-3">
                      {[
                        { href: "/identite", libelle: "Tableau de bord identité", Icone: IconeAccueil },
                        { href: "/identite/verification-visuelle", libelle: "Reconnaissance faciale", Icone: IconeVisage },
                        { href: "/identite/verification-cni", libelle: "Scan CNI", Icone: IconeScan },
                        { href: "/identite/email", libelle: "Vérification email", Icone: IconeEmail },
                        { href: "/identite/2fa", libelle: "Double authentification", Icone: IconeCadenas },
                        { href: "/identite/mot-de-passe", libelle: "Mot de passe", Icone: IconeCle },
                        { href: "/identite/role", libelle: "Rôle &amp; permissions", Icone: IconeBouclier },
                      ].map(({ href, libelle, Icone }) => {
                        const actif = pathname === href || pathname.startsWith(href);
                        return (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setOuvert(false)}
                            className={clsx(
                              "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-200 group",
                              actif
                                ? "bg-sable/60 text-lagune font-medium"
                                : "text-ardoise-clair/70 hover:bg-sable/40 hover:text-ardoise",
                            )}
                          >
                            <Icone className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{libelle}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </SectionPlieMobile>
                </div>
              )}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
