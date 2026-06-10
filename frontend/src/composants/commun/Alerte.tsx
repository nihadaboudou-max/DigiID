/**
 * Composant Alerte — message d'information, succès, avertissement ou erreur.
 */
import clsx from "clsx";
import type { ReactNode } from "react";

interface ProprietesAlerte {
  variante?: "info" | "succes" | "avertissement" | "erreur";
  titre?: string;
  children: ReactNode;
  className?: string;
}

const STYLES = {
  info: "bg-lagune/5 border-l-4 border-lagune text-ardoise",
  succes: "bg-green-50 border-l-4 border-green-600 text-ardoise",
  avertissement: "bg-ocre/10 border-l-4 border-ocre text-ardoise",
  erreur: "bg-terre/10 border-l-4 border-terre text-ardoise",
};

const COULEURS_TITRE = {
  info: "text-lagune",
  succes: "text-green-700",
  avertissement: "text-ocre-fonce",
  erreur: "text-terre",
};

export function Alerte({
  variante = "info",
  titre,
  children,
  className,
}: ProprietesAlerte) {
  return (
    <div className={clsx(STYLES[variante], "p-4 rounded", className)}>
      {titre && (
        <p className={clsx("font-semibold mb-1", COULEURS_TITRE[variante])}>
          {titre}
        </p>
      )}
      <div className="text-sm">{children}</div>
    </div>
  );
}
