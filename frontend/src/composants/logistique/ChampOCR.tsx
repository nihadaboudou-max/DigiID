"use client";
/**
 * Champ d'import d'un document photographié, avec analyse OCR.
 *
 * Pensé pour le terrain : on prend la photo avec l'appareil du téléphone
 * (`capture="environment"`), l'OCR lit le document et remplit le dossier.
 * Le chauffeur n'a donc rien à recopier — juste à **vérifier** ce qui a été lu
 * avant d'enregistrer (une machine peut se tromper, l'humain valide).
 */
import { useRef, useState } from "react";

import { IconeScan } from "@/composants/commun/Icones";

export function ChampOCR({
  libelle,
  description,
  surFichier,
  desactive = false,
}: {
  libelle: string;
  /** Ce qui sera lu sur le document (rassure l'utilisateur sur l'intérêt). */
  description: string;
  /** Reçoit le fichier choisi ; l'appelant déclenche l'OCR. */
  surFichier: (fichier: File) => Promise<void>;
  desactive?: boolean;
}) {
  const [enCours, setEnCours] = useState(false);
  const champFichier = useRef<HTMLInputElement>(null);

  async function traiter(fichier: File | undefined) {
    if (!fichier) return;
    setEnCours(true);
    try {
      await surFichier(fichier);
    } finally {
      setEnCours(false);
      // Permet de reprendre la même photo après une correction.
      if (champFichier.current) champFichier.current.value = "";
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-ardoise-clair/40 bg-white px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-lagune/10 text-lagune">
          <IconeScan className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ardoise">{libelle}</p>
          <p className="mt-0.5 text-xs text-ardoise-clair">{description}</p>

          <input
            ref={champFichier}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void traiter(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={enCours || desactive}
            onClick={() => champFichier.current?.click()}
            className="mt-2 rounded-lg border border-lagune/40 bg-lagune/5 px-3 py-1.5 text-xs font-semibold text-lagune transition hover:bg-lagune hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enCours ? "Lecture du document…" : "Prendre la photo / choisir un fichier"}
          </button>
        </div>
      </div>
    </div>
  );
}
