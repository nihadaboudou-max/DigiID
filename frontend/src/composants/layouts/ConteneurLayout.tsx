"use client";
/**
 * Conteneur de layout dynamique — gère la barre latérale selon le rôle.
 * Ce composant EST un Client Component (utilise usePathname et useAuthentification).
 */
import { usePathname } from "next/navigation";
import { useAuthentification } from "@/contextes/authentification";
import { BarreLaterale } from "@/composants/layouts/BarreLaterale";
import { BoutonMenuMobile } from "@/composants/layouts/MenuMobile";
import { EnTete } from "@/composants/layouts/EnTete";

// Pages publiques sans layout (connexion, inscription, etc.)
const PAGES_SANS_LAYOUT = [
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
  "/accepter-invitation",
];

export function ConteneurLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { utilisateur, chargement } = useAuthentification();

  // Vérifier si c'est une page publique
  const estPagePublique = PAGES_SANS_LAYOUT.some(
    (p) => pathname === p || pathname.startsWith(p)
  );

  // Pages publiques ou en chargement → pas de layout
  if (estPagePublique || chargement) {
    return <>{children}</>;
  }

  // Utilisateur connecté → afficher le layout avec barre latérale
  return (
    <div className="flex min-h-screen bg-sable-clair">
      {/* Barre latérale — visible sur desktop (md et plus) */}
      <div className="hidden md:block flex-shrink-0">
        <BarreLaterale />
      </div>

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* En-tête */}
        <EnTete />

        {/* Menu mobile — visible uniquement sur mobile */}
        <div className="md:hidden px-4 py-3 border-b border-ardoise-clair/10 bg-white">
          <BoutonMenuMobile />
        </div>

        {/* Contenu de la page avec padding approprié */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}