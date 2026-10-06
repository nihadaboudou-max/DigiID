"use client";
/**
 * CarteTrajet — visualisation légère du trajet d'un colis ou d'un enfant suivi.
 *
 * Objectif : rassurer la famille en montrant **où en est** l'envoi, sans dépendre
 * d'une carte externe (pas de clé API, pas de données personnelles envoyées à un
 * tiers — point important pour un document de mémoire sur la vie privée).
 *
 * La progression est déduite des étapes déjà enregistrées dans la timeline.
 * C'est une représentation schématique, pas un suivi GPS : on l'assume et on
 * l'écrit à l'écran pour ne pas créer d'attente déçue.
 */
import type { EvenementSuiviPublic } from "@/types/logistique";

interface ProprietesCarteTrajet {
  gareDepart: string | null;
  gareArrivee: string | null;
  statut: string;
  evenements: EvenementSuiviPublic[];
}

/** Étapes qui font « avancer » le marqueur sur le trajet. */
const ETAPES_AVANCE: Record<string, number> = {
  enregistrement: 0,
  depart: 0.4,
  mise_en_transit: 0.6,
  arrivee: 0.9,
  livraison: 1,
  incident: 0.5,
};

/**
 * Calcule la progression (0 → 1) à partir des étapes enregistrées.
 *
 * On prend la **dernière** étape connue : c'est elle qui reflète la position
 * réelle, même si la timeline contient des étapes antérieures.
 */
export function calculerProgression(
  statut: string,
  evenements: EvenementSuiviPublic[],
): number {
  // Statuts finaux : on ne discute pas, on va au bout.
  if (statut === "livre" || statut === "arrive") return 1;
  if (statut === "enregistre" || statut === "enregistre_direct") {
    // Aucun événement de transport : le colis est encore au guichet.
    const aAvance = evenements.some((e) => e.type_evenement !== "enregistrement");
    if (!aAvance) return 0;
  }

  let progression = 0;
  for (const evenement of evenements) {
    const valeur = ETAPES_AVANCE[evenement.type_evenement];
    if (valeur !== undefined) progression = Math.max(progression, valeur);
  }
  return progression;
}

export function CarteTrajet({
  gareDepart,
  gareArrivee,
  statut,
  evenements,
}: ProprietesCarteTrajet) {
  const progression = calculerProgression(statut, evenements);

  // Dimensions du schéma (viewBox) — l'échelle est fluide via preserveAspectRatio.
  const LARGEUR = 600;
  const HAUTEUR = 120;
  const margeX = 60;
  const y = HAUTEUR / 2;
  const xDepart = margeX;
  const xArrivee = LARGEUR - margeX;
  const xMarqueur = xDepart + (xArrivee - xDepart) * progression;

  const libelleEtape =
    progression >= 1
      ? "Arrivé à destination"
      : progression === 0
        ? "Au guichet de départ"
        : `En route (${Math.round(progression * 100)} %)`;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Trajet de ${gareDepart ?? "départ"} à ${
          gareArrivee ?? "arrivée"
        } — ${libelleEtape}`}
      >
        {/* Ligne du trajet (partie non parcourue) */}
        <line
          x1={xDepart}
          y1={y}
          x2={xArrivee}
          y2={y}
          stroke="#D8DEE4"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="12 12"
        />
        {/* Partie déjà parcourue */}
        <line
          x1={xDepart}
          y1={y}
          x2={xMarqueur}
          y2={y}
          stroke="#0E7C7B"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Gare de départ */}
        <circle cx={xDepart} cy={y} r="12" fill="#0E7C7B" />
        <circle cx={xDepart} cy={y} r="5" fill="#FFFFFF" />

        {/* Gare d'arrivée */}
        <circle
          cx={xArrivee}
          cy={y}
          r="12"
          fill={progression >= 1 ? "#2E7D32" : "#FFFFFF"}
          stroke="#0E7C7B"
          strokeWidth="4"
        />

        {/* Position actuelle */}
        <g transform={`translate(${xMarqueur}, ${y})`}>
          <circle r="15" fill="#E0A458" />
          <circle r="6" fill="#FFFFFF" />
        </g>

        {/* Libellés des gares */}
        <text
          x={xDepart}
          y={y + 40}
          textAnchor="middle"
          fontSize="15"
          fontWeight="600"
          fill="#33404D"
        >
          {tronquer(gareDepart ?? "Départ")}
        </text>
        <text
          x={xArrivee}
          y={y + 40}
          textAnchor="middle"
          fontSize="15"
          fontWeight="600"
          fill="#33404D"
        >
          {tronquer(gareArrivee ?? "Arrivée")}
        </text>
      </svg>

      <p className="mt-1 text-center text-xs font-medium text-ardoise-clair">
        {libelleEtape} — schéma indicatif, fondé sur les étapes scannées (pas de GPS).
      </p>
    </div>
  );
}

/** Tronque un libellé trop long pour rester lisible dans le schéma. */
function tronquer(valeur: string, max = 18): string {
  return valeur.length > max ? `${valeur.slice(0, max - 1)}…` : valeur;
}
