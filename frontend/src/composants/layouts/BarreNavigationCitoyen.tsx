"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  IconeAccueil,
  IconeColis,
  IconeIdentite,
  IconePortefeuille,
  IconeUtilisateur,
} from "@/composants/commun/Icones";

const ENTREES = [
  { href: "/citoyen/dashboard", libelle: "Accueil", Icone: IconeAccueil },
  { href: "/citoyen/envois", libelle: "Mes envois", Icone: IconeColis },
  { href: "/horaires", libelle: "Horaires", Icone: IconePortefeuille },
  { href: "/identite/carte", libelle: "Ma carte", Icone: IconeIdentite },
  { href: "/profil", libelle: "Profil", Icone: IconeUtilisateur },
];

function estDansProfil(pathname: string): boolean {
  return [
    "/profil",
    "/inspection",
    "/documents-identite",
    "/verification-visuelle",
    "/identite/verification-visuelle",
    "/citoyen/qr-code",
    "/aide",
    "/parametres",
    "/commercant",
  ].some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function BarreNavigationCitoyen() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation citoyen"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ardoise-clair/15 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_18px_rgba(27,39,48,0.08)] md:hidden"
    >
      <ul className="mx-auto grid max-w-screen-sm grid-cols-5">
        {ENTREES.map(({ href, libelle, Icone }) => {
          const actif =
            href === "/profil"
              ? estDansProfil(pathname)
              : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={actif ? "page" : undefined}
                className={`flex min-h-20 flex-col items-center justify-center gap-1 px-1 py-2 text-center text-lg font-semibold leading-tight ${
                  actif ? "text-lagune" : "text-ardoise-clair"
                }`}
              >
                <Icone className="h-5 w-5" aria-hidden="true" />
                <span className="leading-tight">{libelle}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
