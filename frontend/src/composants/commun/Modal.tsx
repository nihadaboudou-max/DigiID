"use client";

/**
 * Composant Modal — boîte de dialogue réutilisable.
 * Fermeture par clic extérieur, touche Échap, ou bouton X.
 */
import { useEffect, type ReactNode } from "react";
import clsx from "clsx";

interface ProprietesModal {
  ouvert: boolean;
  surFermeture: () => void;
  titre?: string;
  description?: string;
  taille?: "petit" | "moyen" | "grand";
  children: ReactNode;
}

const TAILLES = {
  petit: "max-w-md",
  moyen: "max-w-lg",
  grand: "max-w-2xl",
};

export function Modal({
  ouvert, surFermeture, titre, description, taille = "moyen", children,
}: ProprietesModal) {
  // Échap ferme la modale
  useEffect(() => {
    if (!ouvert) return;
    const gestionTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") surFermeture();
    };
    window.addEventListener("keydown", gestionTouche);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", gestionTouche);
      document.body.style.overflow = "";
    };
  }, [ouvert, surFermeture]);

  if (!ouvert) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 px-4 bg-ardoise/60 backdrop-blur-sm overflow-y-auto apparition"
      onClick={surFermeture}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={clsx(
          "bg-white rounded-2xl shadow-xl w-full my-auto",
          TAILLES[taille],
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {(titre || description) && (
          <div className="px-6 pt-6 pb-4 border-b border-ardoise-clair/10 flex items-start justify-between gap-4">
            <div className="min-w-0">
              {titre && <h3 className="text-lagune mb-1">{titre}</h3>}
              {description && (
                <p className="text-sm text-ardoise-clair">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={surFermeture}
              aria-label="Fermer"
              className="text-ardoise-clair hover:text-ardoise transition-colors p-1 -m-1 shrink-0"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
