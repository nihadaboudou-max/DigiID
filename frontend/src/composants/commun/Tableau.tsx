"use client";

/**
 * Composant Tableau — affichage tabulaire standardisé DigiID.
 * Supporte : colonnes typées, rendu custom par cellule, ligne d'état vide.
 */
import clsx from "clsx";
import type { ReactNode } from "react";

export interface Colonne<T> {
  cle: string;
  libelle: string;
  alignement?: "gauche" | "centre" | "droite";
  rendu?: (ligne: T, index: number) => ReactNode;
}

interface ProprietesTableau<T> {
  colonnes: Colonne<T>[];
  donnees: T[];
  cleLigne: (ligne: T) => string;
  vide?: ReactNode;
  className?: string;
}

const ALIGNEMENTS = {
  gauche: "text-left",
  centre: "text-center",
  droite: "text-right",
};

export function Tableau<T>({
  colonnes, donnees, cleLigne, vide, className,
}: ProprietesTableau<T>) {
  return (
    <div className={clsx("overflow-x-auto rounded-xl border border-ardoise-clair/10 bg-white", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-lagune text-white">
            {colonnes.map((c) => (
              <th
                key={c.cle}
                className={clsx(
                  "px-4 py-3 font-semibold tracking-wide uppercase text-xs",
                  ALIGNEMENTS[c.alignement || "gauche"],
                )}
              >
                {c.libelle}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {donnees.length === 0 ? (
            <tr>
              <td colSpan={colonnes.length} className="px-4 py-12 text-center text-ardoise-clair italic">
                {vide || "Aucune donnée à afficher."}
              </td>
            </tr>
          ) : (
            donnees.map((ligne, i) => (
              <tr
                key={cleLigne(ligne)}
                className={clsx(
                  "border-t border-ardoise-clair/10 transition-colors hover:bg-sable-clair",
                  i % 2 === 0 ? "bg-white" : "bg-sable-clair/40",
                )}
              >
                {colonnes.map((c) => (
                  <td
                    key={c.cle}
                    className={clsx(
                      "px-4 py-3 text-ardoise",
                      ALIGNEMENTS[c.alignement || "gauche"],
                    )}
                  >
                    {c.rendu
                      ? c.rendu(ligne, i)
                      : (ligne as Record<string, unknown>)[c.cle] as ReactNode}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
