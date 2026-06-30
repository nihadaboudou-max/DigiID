import { BarreLaterale } from "@/composants/layouts/BarreLaterale";
import { BoutonMenuMobile } from "@/composants/layouts/MenuMobile";
import { EnTete } from "@/composants/layouts/EnTete";

export default function LayoutAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-sable-clair">
      {/* Barre latérale — visible sur desktop */}
      <div className="hidden md:block">
        <BarreLaterale />
      </div>

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col">
        {/* En-tête avec menu mobile */}
        <EnTete />
        
        {/* Menu mobile — visible sur mobile */}
        <div className="md:hidden p-4">
          <BoutonMenuMobile />
        </div>

        {/* Contenu de la page */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}