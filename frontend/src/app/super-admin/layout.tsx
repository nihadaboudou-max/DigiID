"use client";

/**
 * Layout de l'espace Super Admin.
 * Ajoute une sidebar de navigation persistante pour accéder
 * rapidement à toutes les sections d'administration.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";

// ---------- Types ----------

interface LienMenu {
  icone: string;
  titre: string;
  href: string;
  description: string;
}

// ---------- Liens de navigation ----------

const LIENS_MENU: LienMenu[] = [
  { icone: "📊", titre: "Tableau de bord", href: "/super-admin/tableau-de-bord", description: "Vue système" },
  { icone: "👤", titre: "Administrateurs", href: "/super-admin/administrateurs", description: "Gestion des admins" },
  { icone: "👥", titre: "Utilisateurs", href: "/super-admin/utilisateurs", description: "Gestion des utilisateurs" },
  { icone: "🛡️", titre: "Droits", href: "/super-admin/droits", description: "RBAC & permissions" },
  { icone: "🎛️", titre: "Droits UI", href: "/super-admin/droits-ui", description: "Modules UI par rôle" },
  { icone: "📜", titre: "Journal d'audit", href: "/super-admin/audit", description: "Traçabilité & logs" },
  { icone: "⚙️", titre: "Configuration", href: "/super-admin/configuration", description: "Feature flags & params" },
  { icone: "📈", titre: "Statistiques", href: "/super-admin/statistiques", description: "Métriques & KPIs" },
  { icone: "🔄", titre: "Monitoring", href: "/super-admin/monitoring", description: "Temps réel" },
  { icone: "👤", titre: "Mon profil", href: "/super-admin/mon-profil", description: "Infos personnelles" },
];

// ---------- Composant Sidebar ----------

function Sidebar({ ouvert, fermer }: { ouvert: boolean; fermer: () => void }) {
  const chemin = usePathname();

  const contenu = (
    <nav className="space-y-1" role="navigation" aria-label="Navigation super admin">
      {LIENS_MENU.map((lien) => {
        const actif = chemin === lien.href || chemin.startsWith(lien.href + "/");
        return (
          <Link
            key={lien.href}
            href={lien.href}
            onClick={fermer}
            className={clsx(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
              actif
                ? "bg-ocre/10 text-ocre border-l-2 border-ocre"
                : "text-ardoise-clair hover:text-ardoise hover:bg-sable"
            )}
          >
            <span className="flex-shrink-0 text-lg w-7 text-center">{lien.icone}</span>
            <div className="flex-1 min-w-0">
              <p className="truncate">{lien.titre}</p>
              <p className="text-[11px] text-ardoise-clair/60 truncate">{lien.description}</p>
            </div>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-ardoise-clair/10 h-screen sticky top-0 overflow-y-auto">
        <div className="p-4 border-b border-ardoise-clair/10">
          <Link href="/super-admin/tableau-de-bord" className="flex items-center gap-2">
            <span className="text-xl">🛡️</span>
            <div>
              <p className="font-bold text-ardoise text-sm">Super Admin</p>
              <p className="text-[11px] text-ocre font-semibold">DigiID</p>
            </div>
          </Link>
        </div>
        <div className="flex-1 p-3 overflow-y-auto">
          {contenu}
        </div>
        <div className="p-3 border-t border-ardoise-clair/10">
          <Link
            href="/tableau-de-bord"
            className="flex items-center gap-2 px-3 py-2 text-xs text-ardoise-clair hover:text-ardoise rounded-lg hover:bg-sable transition-colors"
          >
            <span>←</span>
            <span>Retour à l'accueil</span>
          </Link>
        </div>
      </aside>

      {/* Mobile overlay */}
      {ouvert && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={fermer}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={clsx(
          "fixed top-0 left-0 z-50 h-full w-72 bg-white shadow-2xl transform transition-transform duration-300 lg:hidden",
          ouvert ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-ardoise-clair/10">
          <Link href="/super-admin/tableau-de-bord" className="flex items-center gap-2" onClick={fermer}>
            <span className="text-xl">🛡️</span>
            <div>
              <p className="font-bold text-ardoise text-sm">Super Admin</p>
              <p className="text-[11px] text-ocre font-semibold">DigiID</p>
            </div>
          </Link>
          <button
            onClick={fermer}
            className="p-2 rounded-lg hover:bg-sable text-ardoise-clair"
            aria-label="Fermer le menu"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 p-3 overflow-y-auto h-[calc(100%-130px)]">
          {contenu}
        </div>
      </aside>
    </>
  );
}

// ---------- Layout ----------

export default function LayoutSuperAdmin({
  children,
}: {
  children: React.ReactNode;
}) {
  const [menuOuvert, setMenuOuvert] = useState(false);
  const chemin = usePathname();

  // Titre de la page courante pour l'en-tête mobile
  const pageCourante = LIENS_MENU.find(
    (l) => chemin === l.href || chemin.startsWith(l.href + "/")
  );

  return (
    <EnvelopperEspaceProtege rolesAutorises={["super_administrateur"]}>
      <div className="min-h-screen bg-sable/30 flex">
        {/* Sidebar desktop */}
        <Sidebar ouvert={menuOuvert} fermer={() => setMenuOuvert(false)} />

        {/* Contenu principal */}
        <div className="flex-1 flex flex-col min-h-screen">
          {/* Barre mobile */}
          <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-ardoise-clair/10">
            <div className="flex items-center justify-between px-4 py-3">
              <button
                onClick={() => setMenuOuvert(true)}
                className="p-2 rounded-lg hover:bg-sable text-ardoise"
                aria-label="Ouvrir le menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="flex items-center gap-2">
                <span className="text-lg">🛡️</span>
                <span className="text-sm font-semibold text-ardoise">
                  {pageCourante?.titre || "Super Admin"}
                </span>
              </div>
              <div className="w-10" /> {/* Spacer for centering */}
            </div>
          </header>

          {/* Children */}
          <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            {children}
          </main>
        </div>
      </div>
    </EnvelopperEspaceProtege>
  );
}
