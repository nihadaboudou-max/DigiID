"use client";
/**
 * ControleurBagages — compteur visuel du nombre de sacs.
 *
 * Le receveur précise le **nombre exact de sacs** d'un passager (ou colis) :
 * DigiID génère alors **une étiquette QR par sac** (imprimée en une seule fois).
 *
 * Le nombre de sacs est la quantité unique demandée à l'agent pour éviter
 * de saisir deux fois une information équivalente.
 */
import { IconeMoins, IconePlus } from "@/composants/commun/Icones";
import { useEffect, useState } from "react";

const MIN = 1;
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
  aide = "Saisissez le nombre de sacs ou utilisez les boutons + et −.",
  desactive = false,
}: Props) {
  const borne = (n: number) => Math.max(MIN, n);
  const [saisie, setSaisie] = useState(String(valeur));

  useEffect(() => {
    setSaisie(String(valeur));
  }, [valeur]);

  function modifierSaisie(valeurBrute: string) {
    const chiffres = valeurBrute.replace(/\D/g, "");
    setSaisie(chiffres);
    if (chiffres) {
      onChange(borne(Number(chiffres)));
    }
  }

  function validerSaisie() {
    const valeurFinale = borne(Number(saisie) || MIN);
    setSaisie(String(valeurFinale));
    onChange(valeurFinale);
  }

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
          <input
            type="number"
            min={MIN}
            step={1}
            value={saisie}
            disabled={desactive}
            onChange={(e) => modifierSaisie(e.target.value)}
            onBlur={validerSaisie}
            className="w-20 rounded-xl border border-ardoise-clair/25 bg-white px-2 py-1 text-center text-2xl font-bold tabular-nums text-lagune focus:border-lagune focus:outline-none focus:ring-2 focus:ring-lagune/30"
            aria-label="Nombre de sacs"
          />
          <span className="text-xs text-ardoise-clair">
            {valeur > 1 ? "sacs" : "sac"}
          </span>
        </div>

        <button
          type="button"
          aria-label="Ajouter un sac"
          onClick={() => onChange(borne(valeur + 1))}
          disabled={desactive}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-ardoise/20 bg-white text-ardoise transition hover:bg-lagune-teinte disabled:cursor-not-allowed disabled:opacity-40"
        >
          <IconePlus className="h-5 w-5" />
        </button>

      </div>
      {aide && <p className="text-xs italic text-ardoise-clair">{aide}</p>}
    </div>
  );
}
