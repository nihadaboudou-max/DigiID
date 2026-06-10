/**
 * Composant Badge — étiquette colorée courte (statut, rôle, etc.).
 */
import clsx from "clsx";
import type { ReactNode } from "react";

interface ProprietesBadge {
  variante?: "lagune" | "ocre" | "terre" | "neutre" | "succes" | "info";
  taille?: "petit" | "moyen";
  children: ReactNode;
  className?: string;
}

const STYLES = {
  lagune: "bg-lagune/10 text-lagune",
  ocre: "bg-ocre/15 text-ocre-fonce",
  terre: "bg-terre/10 text-terre",
  neutre: "bg-ardoise-clair/10 text-ardoise",
  succes: "bg-green-100 text-green-800",
  info: "bg-blue-100 text-blue-800",
};

const TAILLES = {
  petit: "px-2 py-0.5 text-xs",
  moyen: "px-3 py-1 text-sm",
};

export function Badge({
  variante = "neutre",
  taille = "petit",
  children,
  className,
}: ProprietesBadge) {
  return (
    <span
      className={clsx(
        "inline-flex items-center font-medium rounded-full",
        STYLES[variante],
        TAILLES[taille],
        className,
      )}
    >
      {children}
    </span>
  );
}
