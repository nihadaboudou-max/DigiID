"use client";
/**
 * BoutonMuet — interrupteur global du son (S5).
 *
 * Coupe / réactive la voix de toute l'application et persiste la préférence
 * (utile en environnement bruyant, au guichet comme en route).
 */
import clsx from "clsx";

import { useLangue, useVoix } from "@/i18n/useLangue";

export function BoutonMuet({ className }: { className?: string }) {
  const { muet, basculerMuet } = useVoix();
  const { t } = useLangue();

  const libelle = muet ? t("audio.activer") : t("audio.couper");

  return (
    <button
      type="button"
      onClick={() => basculerMuet()}
      title={libelle}
      aria-label={libelle}
      aria-pressed={!muet}
      className={clsx(
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-all duration-200",
        muet
          ? "text-terre hover:bg-terre/5"
          : "text-ardoise-clair hover:text-lagune hover:bg-sable",
        className,
      )}
    >
      {muet ? (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      ) : (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <path d="M15.54 8.46a5 5 0 010 7.07" />
          <path d="M19.07 4.93a10 10 0 010 14.14" />
        </svg>
      )}
      <span className="hidden sm:inline">{muet ? t("audio.activer") : t("audio.couper")}</span>
    </button>
  );
}
