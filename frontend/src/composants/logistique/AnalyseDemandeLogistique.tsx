"use client";

import { Carte } from "@/composants/commun/Carte";
import type { AnalysesLogistiques } from "@/services/logistique_api";

const nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export function AnalyseDemandeLogistique({
  analyses,
}: {
  analyses: AnalysesLogistiques;
}) {
  return (
    <Carte
      titre="Analyse prédictive de la demande"
      description="Prévision quotidienne par ligne comparée à une moyenne simple sur sept jours."
    >
      {analyses.previsions.length === 0 ? (
        <p className="text-sm text-ardoise-clair">
          Aucune prévision disponible pour votre périmètre.
        </p>
      ) : (
        <div className="space-y-3">
          <ul className="divide-y divide-sable">
            {analyses.previsions.map((prevision) => (
              <li
                key={`${prevision.depart}-${prevision.arrivee}-${prevision.date_prevue}`}
                className="flex flex-wrap items-baseline justify-between gap-2 py-3 first:pt-0"
              >
                <p className="text-sm font-semibold text-ardoise">
                  {prevision.depart} → {prevision.arrivee}
                </p>
                <p className="text-sm text-ardoise">
                  Prévision :{" "}
                  <strong className="text-lagune">
                    {nombre.format(prevision.demande_prevue)} colis
                  </strong>
                  <span className="ml-2 text-xs text-ardoise-clair">
                    moyenne simple : {nombre.format(prevision.moyenne_simple)}
                  </span>
                </p>
              </li>
            ))}
          </ul>
          <div className="grid gap-2 sm:grid-cols-2">
            <Indicateur
              libelle="Erreur moyenne du modèle (30 jours)"
              valeur={formaterErreur(analyses.erreur_modele_moyenne)}
            />
            <Indicateur
              libelle="Erreur de la moyenne simple (30 jours)"
              valeur={formaterErreur(analyses.erreur_moyenne_simple)}
            />
          </div>
          <p className="text-xs text-ardoise-clair">
            Comparaison calculée sur {analyses.previsions_evaluees} prévisions déjà vérifiées.
          </p>
        </div>
      )}
    </Carte>
  );
}

function formaterErreur(valeur: number | null): string {
  return valeur === null ? "En attente de mesures" : `${nombre.format(valeur)} colis`;
}

function Indicateur({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="rounded-lg bg-sable p-3">
      <p className="text-[10px] font-semibold uppercase text-ardoise-clair">{libelle}</p>
      <p className="mt-1 text-xl font-bold text-ardoise">{valeur}</p>
    </div>
  );
}
