"use client";

import { useMemo } from "react";

import { Carte } from "@/composants/commun/Carte";
import type { Vehicule } from "@/services/logistique_api";
import type { Colis } from "@/types/logistique";

type Props = {
  colis: Colis[];
  vehicules?: Vehicule[];
};

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

function debutJour(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
    .toISOString()
    .slice(0, 10);
}

function prochainVendredi(): Date {
  const date = new Date();
  const joursJusquAuVendredi = (5 - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + joursJusquAuVendredi);
  return date;
}

export function AnalyseDemandeLogistique({ colis, vehicules = [] }: Props) {
  const prevision = useMemo(() => {
    const maintenant = new Date();
    const debutPeriode = new Date(maintenant);
    debutPeriode.setDate(debutPeriode.getDate() - 56);

    const volumesParJour = new Map<string, number>();
    for (const element of colis) {
      const date = new Date(element.cree_le);
      if (Number.isNaN(date.getTime()) || date < debutPeriode || date > maintenant) continue;
      const jour = debutJour(date);
      volumesParJour.set(jour, (volumesParJour.get(jour) ?? 0) + 1);
    }

    const volumes = [...volumesParJour.values()];
    const cible = prochainVendredi();
    const volumesVendredi = [...volumesParJour.entries()]
      .filter(([jour]) => new Date(`${jour}T12:00:00`).getDay() === 5)
      .map(([, volume]) => volume);

    if (volumesVendredi.length < 2 || volumes.length < 5) {
      return null;
    }

    const moyenne = volumes.reduce((total, volume) => total + volume, 0) / volumes.length;
    const moyenneVendredi =
      volumesVendredi.reduce((total, volume) => total + volume, 0) / volumesVendredi.length;
    const variation = moyenne ? Math.round(((moyenneVendredi - moyenne) / moyenne) * 100) : 0;
    const flotteActive = vehicules.filter((vehicule) => vehicule.actif);
    const capaciteTotale = flotteActive.reduce(
      (total, vehicule) => total + (vehicule.capacite ?? 0),
      0,
    );

    return {
      jour: JOURS[cible.getDay()],
      moyenneVendredi: Math.round(moyenneVendredi),
      moyenne: Math.round(moyenne * 10) / 10,
      variation,
      observations: volumesVendredi.length,
      capaciteTotale,
      flotteActive: flotteActive.length,
    };
  }, [colis, vehicules]);

  return (
    <Carte
      titre="Analyse prédictive de la demande"
      description="Prévision basée sur les flux de colis des 8 dernières semaines"
    >
      {!prevision ? (
        <p className="text-sm text-ardoise-clair">
          Historique insuffisant : au moins 2 journées comparables et 5 journées observées sont nécessaires.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm text-ardoise">
              Prévision pour <strong>{prevision.jour}</strong> :{" "}
              <strong className="text-lagune">{prevision.moyenneVendredi} colis</strong>
            </p>
            <span className="text-xs text-ardoise-clair">
              {prevision.observations} vendredis analysés
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Indicateur
              libelle="Variation estimée"
              valeur={`${prevision.variation >= 0 ? "+" : ""}${prevision.variation}%`}
              couleur={prevision.variation >= 20 ? "text-terre" : "text-lagune"}
            />
            <Indicateur libelle="Moyenne quotidienne" valeur={String(prevision.moyenne)} couleur="text-ardoise" />
            <Indicateur
              libelle="Flotte active"
              valeur={`${prevision.flotteActive} car${prevision.flotteActive > 1 ? "s" : ""}`}
              couleur="text-ocre-fonce"
            />
          </div>
          {prevision.variation >= 20 ? (
            <div className="rounded-lg border border-terre/30 bg-terre/10 p-3 text-sm text-terre">
              <strong>Alerte :</strong> hausse de charge de {prevision.variation}% estimée pour ce vendredi ;
              optimisation requise de la flotte disponible.
              {prevision.capaciteTotale > 0 && (
                <span className="block text-xs mt-1">
                  Capacité déclarée de la flotte active : {prevision.capaciteTotale} places.
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-ardoise-clair">
              Aucun pic significatif détecté sur la base de l’historique disponible.
            </p>
          )}
        </div>
      )}
    </Carte>
  );
}

function Indicateur({
  libelle,
  valeur,
  couleur,
}: {
  libelle: string;
  valeur: string;
  couleur: string;
}) {
  return (
    <div className="rounded-lg bg-sable p-3">
      <p className="text-[10px] font-semibold uppercase text-ardoise-clair">{libelle}</p>
      <p className={`mt-1 text-xl font-bold ${couleur}`}>{valeur}</p>
    </div>
  );
}
