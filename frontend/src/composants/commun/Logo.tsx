/**
 * Composant Logo DigiID — image officielle du produit.
 *
 * Source : `Logo_DigiID_1.png` (racine du dépôt), recadrée et déclinée en
 * `public/logo-digiid.png` (hauteur 480 px) : l'original (7731 px de large)
 * n'est donc jamais servi au navigateur. Favicon : `src/app/icon.png`.
 */
import clsx from "clsx";

interface ProprietesLogo {
  taille?: "petit" | "moyen" | "grand";
  variante?: "couleur" | "monochrome-blanc" | "monochrome-lagune";
  className?: string;
}

const TAILLES = {
  petit: "h-8",
  moyen: "h-12",
  grand: "h-20",
};

/** Variantes monochromes : un filtre CSS suffit, le PNG reste unique. */
const FILTRES: Record<string, string> = {
  couleur: "",
  "monochrome-blanc": "brightness-0 invert",
  "monochrome-lagune": "brightness-0",
};

export function Logo({
  taille = "moyen",
  variante = "couleur",
  className = "",
}: ProprietesLogo) {
  return (
    <span className={clsx("inline-flex items-center", TAILLES[taille], className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- logo déjà optimisé en amont */}
      <img
        src="/logo-digiid.png"
        alt="DigiID — une identité née de la vie quotidienne"
        className={clsx("h-full w-auto object-contain", FILTRES[variante])}
      />
    </span>
  );
}
