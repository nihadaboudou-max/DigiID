/**
 * StatutAttestation — Badge de statut coloré pour une attestation.
 * 
 * Affiche le statut avec une couleur et une icône représentative :
 *   - EN_ATTENTE : 🟡 Ocre (en attente)
 *   - APPROUVEE  : 🟢 Vert (approuvée)
 *   - REFUSEE    : 🔴 Rouge (refusée)
 *   - EXPIREE    : ⚪ Gris (expirée)
 */
import type { StatutAttestation } from "@/services/attestations_communautaires";
import { ETIQUETTES_STATUTS } from "@/services/attestations_communautaires";
import clsx from "clsx";

/** Propriétés du composant */
interface ProprietesStatutAttestation {
  /** Statut de l'attestation */
  statut: StatutAttestation;
  /** Taille du badge : "petit" (défaut) ou "moyen" */
  taille?: "petit" | "moyen";
  /** Classes CSS supplémentaires */
  className?: string;
}

/**
 * Carte des couleurs et icônes par statut.
 * 
 * Chaque statut a :
 *   - bg      : Couleur de fond
 *   - text    : Couleur du texte
 *   - dot     : Couleur du point indicateur
 *   - icone   : Icône SVG représentative du statut
 */
const CONFIG_STATUT: Record<
  StatutAttestation,
  { bg: string; text: string; dot: string; anneau: string }
> = {
  EN_ATTENTE: {
    bg: "bg-ocre/10",
    text: "text-ocre",
    dot: "bg-ocre",
    anneau: "border-ocre/30",
  },
  APPROUVEE: {
    bg: "bg-green-50",
    text: "text-green-700",
    dot: "bg-green-500",
    anneau: "border-green-200",
  },
  REFUSEE: {
    bg: "bg-red-50",
    text: "text-red-700",
    dot: "bg-red-500",
    anneau: "border-red-200",
  },
  EXPIREE: {
    bg: "bg-gray-100",
    text: "text-gray-500",
    dot: "bg-gray-400",
    anneau: "border-gray-200",
  },
};

/**
 * Badge de statut coloré pour les attestations.
 * 
 * @example
 * // Badge moyen
 * <StatutAttestation statut="EN_ATTENTE" taille="moyen" />
 * 
 * @example
 * // Petit badge pour les listes
 * <StatutAttestation statut="APPROUVEE" />
 */
export function StatutAttestation({
  statut,
  taille = "petit",
  className,
}: ProprietesStatutAttestation) {
  // Récupérer la configuration du statut
  const config = CONFIG_STATUT[statut] || CONFIG_STATUT.EN_ATTENTE;
  const libelle = ETIQUETTES_STATUTS[statut] || statut;

  // Classes selon la taille
  const classesTaille = taille === "moyen"
    ? "px-3 py-1.5 text-sm gap-2"
    : "px-2 py-0.5 text-xs gap-1.5";

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full font-medium border transition-colors",
        classesTaille,
        config.bg,
        config.text,
        config.anneau,
        className,
      )}
      title={`Statut : ${libelle}`}
      role="status"
      aria-label={`Attestation ${libelle}`}
    >
      {/* Point indicateur animé pour EN_ATTENTE */}
      <span
        className={clsx(
          "w-1.5 h-1.5 rounded-full",
          config.dot,
          statut === "EN_ATTENTE" && "animate-pulse",
        )}
      />
      <span>{libelle}</span>
    </span>
  );
}
