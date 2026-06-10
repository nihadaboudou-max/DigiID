"use client";

/**
 * Composant Bouton standardisé DigiID.
 * Trois variantes : primaire (lagune), secondaire (ocre), ghost (bordure).
 */
import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ProprietesBouton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: "primaire" | "secondaire" | "ghost" | "danger" | "succes";
  taille?: "petit" | "moyen" | "grand";
  chargement?: boolean;
  children: ReactNode;
}

const CLASSES_VARIANTES = {
  primaire: "bouton-primaire",
  secondaire: "bouton-secondaire",
  ghost: "bouton-ghost",
  danger: "bouton-danger",
  succes: "bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors",
};

const CLASSES_TAILLES = {
  petit: "px-3 py-1.5 text-sm",
  moyen: "px-6 py-3 text-base",
  grand: "px-8 py-4 text-lg",
};

export function Bouton({
  variante = "primaire",
  taille = "moyen",
  chargement = false,
  disabled,
  className,
  children,
  ...reste
}: ProprietesBouton) {
  return (
    <button
      className={clsx(
        CLASSES_VARIANTES[variante],
        CLASSES_TAILLES[taille],
        "inline-flex items-center justify-center gap-2",
        className,
      )}
      disabled={disabled || chargement}
      {...reste}
    >
      {chargement && (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
