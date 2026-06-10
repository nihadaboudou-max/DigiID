/**
 * Composant Logo DigiID — version simplifiée en pur SVG inline,
 * sans dépendance à un fichier image. Couleurs de la palette officielle.
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

export function Logo({
  taille = "moyen",
  variante = "couleur",
  className = "",
}: ProprietesLogo) {
  const couleurArc =
    variante === "monochrome-blanc"
      ? "#FFFFFF"
      : variante === "monochrome-lagune"
      ? "#1B4965"
      : "#1B4965";

  const couleurAccent =
    variante === "monochrome-blanc"
      ? "#FFFFFF"
      : variante === "monochrome-lagune"
      ? "#1B4965"
      : "#E8A857";

  const couleurTexte =
    variante === "monochrome-blanc"
      ? "#FFFFFF"
      : variante === "monochrome-lagune"
      ? "#1B4965"
      : "#1B4965";

  const couleurTexteAccent =
    variante === "monochrome-blanc"
      ? "#FFFFFF"
      : variante === "monochrome-lagune"
      ? "#1B4965"
      : "#E8A857";

  return (
    <div className={clsx("flex items-center gap-3", TAILLES[taille], className)}>
      <svg viewBox="0 0 80 60" className="h-full" xmlns="http://www.w3.org/2000/svg">
        {/* Arcs empreinte */}
        <path d="M 25 10 Q 5 18 5 35 Q 5 50 18 55" fill="none" stroke={couleurArc} strokeWidth="4" strokeLinecap="round" />
        <path d="M 28 18 Q 13 25 13 36 Q 13 47 24 50" fill="none" stroke={couleurArc} strokeWidth="3.5" strokeLinecap="round" />
        <path d="M 30 26 Q 21 30 21 38 Q 21 44 29 46" fill="none" stroke={couleurArc} strokeWidth="3" strokeLinecap="round" opacity="0.8" />
        {/* Réseau de nœuds */}
        <circle cx="50" cy="20" r="3" fill={couleurAccent} />
        <circle cx="55" cy="30" r="3.5" fill={couleurArc} stroke={couleurAccent} strokeWidth="1.5" />
        <circle cx="52" cy="42" r="2.5" fill={couleurAccent} />
        <line x1="32" y1="20" x2="50" y2="20" stroke={couleurAccent} strokeWidth="1" opacity="0.6" />
        <line x1="32" y1="32" x2="55" y2="30" stroke={couleurAccent} strokeWidth="1" opacity="0.6" />
        <line x1="32" y1="42" x2="52" y2="42" stroke={couleurAccent} strokeWidth="1" opacity="0.6" />
        <line x1="50" y1="20" x2="55" y2="30" stroke={couleurAccent} strokeWidth="0.8" opacity="0.5" />
        <line x1="55" y1="30" x2="52" y2="42" stroke={couleurAccent} strokeWidth="0.8" opacity="0.5" />
      </svg>
      <div className="flex flex-col leading-none">
        <span className="font-bold tracking-tight" style={{ color: couleurTexte, fontSize: taille === "grand" ? "1.8rem" : "1.25rem" }}>
          Digi<span style={{ color: couleurTexteAccent }}>ID</span>
        </span>
        {taille === "grand" && (
          <span className="text-xs text-ardoise-clair mt-1 italic">
            Une identité née de la vie quotidienne.
          </span>
        )}
      </div>
    </div>
  );
}
