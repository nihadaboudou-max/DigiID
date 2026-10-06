"use client";
/**
 * Timeline de suivi d'un colis (S3).
 *
 * Affiche les événements renvoyés par `GET /api/v1/logistique/colis/{id}/evenements`,
 * du plus ancien au plus récent : type d'événement, date/heure, acteur et gare.
 */
import clsx from "clsx";

import type { ColisEvenement, TypeEvenementColis } from "@/types/logistique";
import { LIBELLES_EVENEMENT } from "@/types/logistique";
import { formaterDateHeure } from "./format";

interface Proprietes {
  evenements: ColisEvenement[];
}

/** Icône (emoji sobre) par type d'événement. */
const ICONES: Record<TypeEvenementColis, string> = {
  affectation: "🧑‍✈️",
  enregistrement: "📦",
  depart: "🚚",
  mise_en_transit: "🛣️",
  arrivee: "📍",
  livraison: "✅",
};

/** Couleur de la pastille par type d'événement. */
const COULEURS: Record<TypeEvenementColis, string> = {
  affectation: "bg-terre",
  enregistrement: "bg-lagune",
  depart: "bg-ocre",
  mise_en_transit: "bg-ocre",
  arrivee: "bg-lagune",
  livraison: "bg-green-600",
};

export function SuiviTimeline({ evenements }: Proprietes) {
  if (evenements.length === 0) {
    return (
      <p className="text-sm text-ardoise-clair italic">
        Aucun événement enregistré pour ce colis.
      </p>
    );
  }

  // Ordre chronologique croissant (le backend renvoie déjà trié, on sécurise)
  const ordonnes = [...evenements].sort(
    (a, b) => new Date(a.horodatage).getTime() - new Date(b.horodatage).getTime(),
  );

  return (
    <ol className="relative">
      {ordonnes.map((evenement, index) => {
        const estDernier = index === ordonnes.length - 1;
        return (
          <li key={evenement.id} className="relative pl-10 pb-6 last:pb-0">
            {/* Trait vertical */}
            {!estDernier && (
              <span className="absolute left-[15px] top-6 bottom-0 w-0.5 bg-ardoise-clair/15" />
            )}
            {/* Pastille */}
            <span
              className={clsx(
                "absolute left-0 top-0 w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-sm",
                COULEURS[evenement.type_evenement] ?? "bg-ardoise-clair",
              )}
            >
              <span aria-hidden="true">
                {ICONES[evenement.type_evenement] ?? "•"}
              </span>
            </span>

            <div>
              <p className="font-semibold text-ardoise">
                {LIBELLES_EVENEMENT[evenement.type_evenement] ?? evenement.type_evenement}
              </p>
              <p className="text-xs text-ardoise-clair">
                {formaterDateHeure(evenement.horodatage)}
                {evenement.gare_id ? "" : ""}
              </p>
              <p className="text-xs text-ardoise-clair">
                Par {evenement.acteur_nom || "acteur inconnu"}
                {evenement.localisation ? ` · ${evenement.localisation}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
