"use client";
/**
 * ControleurBagages — compteur visuel 1 à 10 sacs (Plan B, P0 ajusté).
 *
 * Le receveur précise le **nombre exact de sacs** d'un passager (ou colis) :
 * DigiID génère alors **une étiquette QR par sac** (imprimée en une seule fois).
 *
 * Rappel : le nombre de sacs sert uniquement à la **traçabilité** et à la
 * vérification **anti-fraude à l'arrivée** (recompter les sacs remis) ; il
 * **n'impacte jamais** le prix (frais fixe de 100 FCFA par passager/enfant).
 */
import { IconeMoins, IconePlus } from "@/composants/commun/Icones";

const MIN = 1;
const MAX = 10;

interface Props {
  valeur: number;
  onChange: (valeur: number) => void;
  libelle?: string;
  aide?: string;
  desactive?: boolean;
}

export function ControleurBagages({
  valeur,
  onChange,
  libelle = "Nombre de sacs",
  aide = "De 1 à 10 sacs — une étiquette QR sera générée par sac (traçabilité, sans impact sur le prix).",
  desactive = false,
}: Props) {
  const borne = (n: number) => Math.max(MIN, Math.min(MAX, n));

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-ardoise">{libelle}</label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Retirer un sac"
          onClick={() => onChange(borne(valeur - 1))}
          disabled={desactive || valeur <= MIN}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-ardoise/20 bg-white text-ardoise transition hover:bg-lagune-teinte disabled:cursor-not-allowed disabled:opacity-40"
        >
          <IconeMoins className="h-5 w-5" />
        </button>

        <div className="flex min-w-[4.5rem] flex-col items-center">
          <span
            className="text-3xl font-bold tabular-nums text-lagune"
            aria-live="polite"
          >
            {valeur}
          </span>
          <span className="text-xs text-ardoise-clair">
            {valeur > 1 ? "sacs" : "sac"}
          </span>
        </div>

        <button
          type="button"
          aria-label="Ajouter un sac"
          onClick={() => onChange(borne(valeur + 1))}
          disabled={desactive || valeur >= MAX}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-ardoise/20 bg-white text-ardoise transition hover:bg-lagune-teinte disabled:cursor-not-allowed disabled:opacity-40"
        >
          <IconePlus className="h-5 w-5" />
        </button>

        <span className="ml-1 text-xs italic text-ardoise-clair">
          {Math.max(MIN, Math.min(MAX, valeur))} / {MAX}
        </span>
      </div>
      {aide && <p className="text-xs italic text-ardoise-clair">{aide}</p>}
    </div>
  );
}
