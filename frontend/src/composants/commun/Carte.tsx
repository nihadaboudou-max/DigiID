/**
 * Composant Carte — boîte standardisée DigiID.
 * Variantes : par défaut, avec accent ocre, en pointillés.
 */
import clsx from "clsx";
import type { ReactNode } from "react";

interface ProprietesCarte {
  titre?: string;
  description?: string;
  variante?: "standard" | "accent" | "pointilles" | "danger";
  className?: string;
  children: ReactNode;
}

export function Carte({
  titre,
  description,
  variante = "standard",
  className,
  children,
}: ProprietesCarte) {
  const classesVariante =
    variante === "accent"
      ? "carte-accent"
      : variante === "pointilles"
      ? "carte border-dashed border-2 border-ocre/30 bg-sable"
      : variante === "danger"
      ? "carte border-red-200 bg-red-50/50"
      : "carte";

  return (
    <div className={clsx(classesVariante, className)}>
      {(titre || description) && (
        <div className="mb-4">
          {titre && <h3 className="text-lagune mb-1">{titre}</h3>}
          {description && (
            <p className="text-sm text-ardoise-clair">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
