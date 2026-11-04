"use client";
/**
 * Conteneur de layout dynamique — gère la barre latérale selon le rôle.
 * Ce composant EST un Client Component (utilise usePathname et useAuthentification).
 */
import { usePathname, useRouter } from "next/navigation";
import { useAuthentification } from "@/contextes/authentification";
import { BarreLaterale } from "@/composants/layouts/BarreLaterale";
// Doublon masqué (version mobile) : l'icône du menu est déjà rendue dans l'EnTete.
// Dé-commenter cet import (et le bloc correspondant plus bas) pour le réafficher.
// import { BoutonMenuMobile } from "@/composants/layouts/MenuMobile";
import { EnTete } from "@/composants/layouts/EnTete";
import { IconeFlecheRetour } from "@/composants/commun/Icones";
import { cheminTableauDeBord } from "@/types/api";

// Pages publiques sans layout (connexion, inscription, etc.)
const PAGES_SANS_LAYOUT = [
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
  "/accepter-invitation",
  // Suivi public (familles) — accessible sans connexion, étape S7.
  "/suivi",
];

export function ConteneurLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { utilisateur, chargement } = useAuthentification();

  // Vérifier si c'est une page publique
  const estPagePublique = PAGES_SANS_LAYOUT.some(
    (p) => pathname === p || pathname.startsWith(p)
  );
  const estAccueil = pathname === "/";
  const estEspaceLogistique =
    pathname.startsWith("/chauffeur") ||
    pathname.startsWith("/receveur") ||
    pathname.startsWith("/gerant-gare") ||
    pathname.startsWith("/logistique");

  function retourner() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.replace(utilisateur ? cheminTableauDeBord(utilisateur.role) : "/");
  }

  // Pages publiques / chargement : un seul en-tête global, sans barre latérale
  // ni conteneur de contenu connecté.
  if (estPagePublique || estAccueil || chargement) {
    return (
      <div className="min-h-screen bg-sable-clair flex flex-col">
        <EnTete />
        <div className="flex-1 min-w-0 overflow-x-clip">{children}</div>
      </div>
    );
  }

  // Espace connecté → layout avec barre latérale (desktop) / menu hamburger (mobile)
  return (
    <div className={`flex min-h-screen bg-sable-clair overflow-x-clip${estEspaceLogistique ? " espace-logistique" : ""}`}>
      {/* Barre latérale — visible sur desktop (md et plus) */}
      <div className="hidden md:block flex-shrink-0">
        <BarreLaterale />
      </div>

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <EnTete />

        {/* Contenu : padding réduit sur mobile pour maximiser la largeur utile */}
        <main className="flex-1 px-3 py-4 sm:p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
          <div className="max-w-7xl mx-auto w-full min-w-0">
            <button
              type="button"
              onClick={retourner}
              className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-ardoise-clair/20 bg-white px-3.5 py-2 text-sm font-semibold text-ardoise transition hover:border-lagune/40 hover:bg-sable hover:text-lagune focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lagune/40"
              aria-label="Retourner à la page précédente"
            >
              <IconeFlecheRetour className="h-4 w-4" />
              Retour
            </button>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}