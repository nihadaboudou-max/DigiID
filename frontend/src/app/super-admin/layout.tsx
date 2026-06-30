/**
 * Layout Super Admin — englobe TOUTES les pages /super-admin/*.
 * Affiche l'en-tête + la barre latérale à gauche + le contenu à droite.
 */
import { EnTete } from "@/composants/layouts/EnTete";
import { BarreLaterale } from "@/composants/layouts/BarreLaterale";
import Link from "next/link";

export const metadata = {
  title: "Super Admin — DigiID",
  description: "Panneau de super administration DigiID",
};

export default function LayoutSuperAdmin({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-sable-clair">
      {/* En-tête en haut (sur toute la largeur) */}
      <EnTete />

      {/* Corps : barre latérale à gauche + contenu à droite */}
      <div className="flex flex-1">
        {/* Barre latérale — toujours visible */}
        <aside className="w-60 flex-shrink-0 bg-white border-r border-ardoise-clair/10 sticky top-[64px] h-[calc(100vh-64px)] overflow-y-auto">
          <BarreLaterale />
        </aside>

        {/* Contenu principal */}
        <main className="flex-1 overflow-y-auto">
          {/* Fil d'Ariane global pour revenir en arrière */}
          <div className="px-8 pt-6">
            <Link
              href="/super-admin/tableau-de-bord"
              className="inline-flex items-center gap-1 text-sm text-ardoise-clair hover:text-lagune transition-colors"
            >
              ← Retour au tableau de bord
            </Link>
          </div>

          {/* Contenu de la page */}
          {children}
        </main>
      </div>
    </div>
  );
}