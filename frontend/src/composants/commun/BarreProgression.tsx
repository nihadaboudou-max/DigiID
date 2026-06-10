/**
 * Barre de progression colorée — utilisée dans les statistiques.
 */
import clsx from "clsx";

interface ProprietesBarre {
  valeur: number;
  max?: number;
  couleur?: "lagune" | "ocre" | "terre" | "succes";
  className?: string;
  afficherPourcentage?: boolean;
}

const COULEURS = {
  lagune: "bg-lagune",
  ocre: "bg-ocre",
  terre: "bg-terre",
  succes: "bg-green-600",
};

export function BarreProgression({
  valeur, max = 100, couleur = "lagune", className, afficherPourcentage,
}: ProprietesBarre) {
  const pourcentage = Math.min(100, Math.max(0, (valeur / max) * 100));
  return (
    <div className={clsx("flex items-center gap-3", className)}>
      <div className="flex-grow h-2 bg-sable-clair rounded-full overflow-hidden">
        <div
          className={clsx("h-full transition-all duration-500 rounded-full", COULEURS[couleur])}
          style={{ width: `${pourcentage}%` }}
        />
      </div>
      {afficherPourcentage && (
        <span className="text-xs font-semibold text-ardoise-clair tabular-nums w-10 text-right">
          {Math.round(pourcentage)}%
        </span>
      )}
    </div>
  );
}
