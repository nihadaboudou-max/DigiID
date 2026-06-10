"use client";

/**
 * Composant ChampSaisie — input texte avec label et message d'erreur intégrés.
 */
import clsx from "clsx";
import type { InputHTMLAttributes } from "react";

interface ProprietesChamp extends InputHTMLAttributes<HTMLInputElement> {
  libelle: string;
  erreur?: string;
  aide?: string;
}

export function ChampSaisie({
  libelle,
  erreur,
  aide,
  className,
  id,
  ...reste
}: ProprietesChamp) {
  const idFinal = id || libelle.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={idFinal} className="text-sm font-medium text-ardoise">
        {libelle}
        {reste.required && <span className="text-terre ml-0.5">*</span>}
      </label>
      <input
        id={idFinal}
        className={clsx(
          "champ-saisie",
          erreur && "border-terre focus:ring-terre",
          className,
        )}
        {...reste}
      />
      {erreur && (
        <p className="text-sm text-terre">{erreur}</p>
      )}
      {aide && !erreur && (
        <p className="text-xs text-ardoise-clair italic">{aide}</p>
      )}
    </div>
  );
}
