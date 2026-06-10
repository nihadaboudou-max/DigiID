"use client";

/**
 * Champ de recherche standardisé — avec icône intégrée.
 */
import type { InputHTMLAttributes } from "react";

interface ProprietesRecherche extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  placeholder?: string;
}

export function ChampRecherche({
  placeholder = "Rechercher...",
  className,
  ...reste
}: ProprietesRecherche) {
  return (
    <div className="relative">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 text-ardoise-clair"
        width="18" height="18" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        viewBox="0 0 24 24"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="search"
        placeholder={placeholder}
        className={`champ-saisie !pl-10 ${className || ""}`}
        {...reste}
      />
    </div>
  );
}
