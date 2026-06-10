/**
 * Indicateur de chargement global — affiché pendant le rendu d'une page.
 */
import { Logo } from "@/composants/commun/Logo";

export default function ChargementGlobal() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-sable-clair">
      <div className="apparition">
        <Logo taille="grand" />
      </div>
      <div className="mt-8 flex gap-2">
        <span className="w-2 h-2 bg-lagune rounded-full animate-bounce" />
        <span className="w-2 h-2 bg-ocre rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
        <span className="w-2 h-2 bg-terre rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
      </div>
      <p className="text-sm text-ardoise-clair italic mt-4">Chargement en cours...</p>
    </div>
  );
}
