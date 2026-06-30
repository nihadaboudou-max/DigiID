/**
 * Layout Super Admin — englobe TOUTES les pages /super-admin/*.
 * Affiche l'en-tête + la barre latérale à gauche + le contenu à droite.
 */
import { EnTete } from "@/composants/layouts/EnTete";
import { BarreLaterale } from "@/composants/layouts/BarreLaterale";

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
        <aside className="hidden md:flex md:flex-col w-60 flex-shrink-0 bg-white border-r border-ardoise-clair/10 sticky top-0 h-screen overflow-y-auto">
          <BarreLaterale />
        </aside>

        {/* Contenu principal */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}