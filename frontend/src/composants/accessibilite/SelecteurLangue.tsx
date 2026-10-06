"use client";
/**
 * SelecteurLangue — choisir sa langue « à l'oreille » (S5).
 *
 * Quatre grandes cartes (une par langue). Toucher une carte l'annonce à voix
 * haute dans cette langue : l'utilisateur choisit donc en ÉCOUTANT, sans lire.
 * Un petit haut-parleur, bouton distinct, permet de réécouter l'échantillon.
 *
 * Trois présentations :
 *   - `cartes`   : grille 2×2, pour l'onboarding ;
 *   - `compacte` : liste verticale, pour la page Paramètres ;
 *   - `ligne`    : les 4 langues sur UNE ligne, format réduit (accueil).
 */
import clsx from "clsx";

import { useLangue } from "@/i18n/useLangue";
import type { MetaLangue } from "@/i18n/langues";

interface Proprietes {
  variante?: "cartes" | "compacte" | "ligne";
  className?: string;
}

export function SelecteurLangue({
  variante = "cartes",
  className,
}: Proprietes) {
  const { langue, langues, definirLangue, jouer, t } = useLangue();

  /** Choix d'une langue : sélectionne puis annonce l'accueil dans CETTE langue. */
  function choisir(meta: MetaLangue) {
    definirLangue(meta.code);
    jouer("accueil.bienvenue", undefined, meta.code);
  }

  return (
    <div className={className}>
      {variante === "ligne" ? (
        <p className="text-[11px] font-semibold text-ardoise-clair uppercase tracking-wider mb-1.5">
          {t("langue.titre")}
        </p>
      ) : (
        <div className="mb-4">
          <h2 className="text-lg font-bold text-ardoise">{t("langue.titre")}</h2>
          <p className="text-sm text-ardoise-clair mt-0.5">{t("langue.description")}</p>
        </div>
      )}

      <div
        className={clsx(
          variante === "cartes" && "grid grid-cols-2 gap-3",
          variante === "compacte" && "flex flex-col gap-3",
          variante === "ligne" && "grid grid-cols-2 sm:grid-cols-4 gap-2",
        )}
      >
        {langues.map((meta) => {
          const actif = meta.code === langue;

          /* Variante « ligne » : une puce compacte par langue. Cliquer sur la
             langue déjà active la ré-annonce (même effet que le haut-parleur
             des autres variantes). */
          if (variante === "ligne") {
            return (
              <button
                key={meta.code}
                type="button"
                onClick={() => choisir(meta)}
                aria-pressed={actif}
                title={`${t("langue.ecouter")} — ${meta.libelle}`}
                className={clsx(
                  "flex items-center justify-center gap-1.5 min-w-0 px-2 py-1.5 rounded-xl border-2 text-sm transition-all duration-200",
                  actif
                    ? "border-lagune bg-lagune/5 text-lagune font-semibold"
                    : "border-ardoise-clair/15 bg-white text-ardoise hover:border-ocre/40",
                )}
              >
                <span className="text-base leading-none" aria-hidden="true">
                  {meta.emoji}
                </span>
                <span className="truncate">{meta.natif}</span>
              </button>
            );
          }

          return (
            <div
              key={meta.code}
              className={clsx(
                "relative rounded-2xl border-2 transition-all duration-200",
                actif
                  ? "border-lagune bg-lagune/5 shadow-sm"
                  : "border-ardoise-clair/15 bg-white hover:border-ocre/40 hover:shadow-md",
              )}
            >
              {/* Zone de choix (toute la carte, sauf le haut-parleur) */}
              <button
                type="button"
                onClick={() => choisir(meta)}
                aria-pressed={actif}
                className={clsx(
                  "w-full rounded-2xl p-4 min-w-0",
                  variante === "cartes"
                    ? "flex flex-col items-center justify-center text-center gap-2 min-h-[140px] pl-7 pr-7"
                    : "flex flex-row items-center gap-3 text-left pr-14",
                )}
              >
                <span className="text-2xl leading-none" aria-hidden="true">
                  {meta.emoji}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-ardoise truncate">
                    {meta.natif}
                  </span>
                  {meta.natif !== meta.libelle && (
                    <span className="block text-xs text-ardoise-clair">
                      {meta.libelle}
                    </span>
                  )}
                </span>
              </button>

              {/* Haut-parleur : RÉÉCOUTE l'échantillon (bouton frère, non imbriqué) */}
              <button
                type="button"
                onClick={() => jouer("accueil.bienvenue", undefined, meta.code)}
                aria-label={`${t("langue.ecouter")} — ${meta.libelle}`}
                title={t("langue.ecouter")}
                className={clsx(
                  "absolute bottom-2 right-2 w-9 h-9 rounded-full flex items-center justify-center transition-colors",
                  actif
                    ? "bg-lagune text-white hover:bg-lagune-clair"
                    : "bg-ocre/15 text-ocre-fonce hover:bg-ocre/25",
                )}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M15.54 8.46a5 5 0 010 7.07" />
                  <path d="M19.07 4.93a10 10 0 010 14.14" />
                </svg>
              </button>

              {/* Marqueur de sélection */}
              {actif && (
                <span className="absolute top-2 left-2 flex items-center gap-1 text-xs font-semibold text-lagune">
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {variante === "compacte" && t("langue.choisie")}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
