"use client";

/**
 * Composant Modal — boîte de dialogue réutilisable.
 * Fermeture par clic extérieur, touche Échap, ou bouton X.
 *
 * Rendu via portal sur document.body pour que position:fixed reste
 * relatif au viewport (les pages wrappent souvent le contenu avec
 * .apparition / transform, ce qui sinon ancre la modale en haut de page).
 */
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
  const [monte, setMonte] = useState(false);

  useEffect(() => {
    setMonte(true);
  }, []);

  // Échap ferme la modale + bloque le scroll de fond
  useEffect(() => {
    if (!ouvert) return;
    const gestionTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") surFermeture();
    };
    window.addEventListener("keydown", gestionTouche);
    const overflowAvant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", gestionTouche);
      document.body.style.overflow = overflowAvant;
    };
  }, [ouvert, surFermeture]);

  if (!ouvert || !monte) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ardoise/60 backdrop-blur-sm"
      onClick={surFermeture}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={clsx(
          "bg-white rounded-2xl shadow-xl w-full max-h-[min(90vh,100%)] overflow-y-auto apparition-echelle",
          TAILLES[taille],
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {(titre || description) && (
          <div className="px-6 pt-6 pb-4 border-b border-ardoise-clair/10 flex items-start justify-between gap-4 sticky top-0 bg-white z-10">
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
    </div>,
    document.body,
  );
}
