"use client";

import { useMemo } from "react";

import { Carte } from "@/composants/commun/Carte";
import type { Vehicule, Voyage } from "@/services/logistique_api";
import type { Colis } from "@/types/logistique";

type Props = {
  voyages: Voyage[];
  colis: Colis[];
  vehicules: Vehicule[];
  passagersParVoyage?: Record<string, number>;
};

export function RecommandationTarifaire({
  voyages,
  colis,
  vehicules,
  passagersParVoyage = {},
}: Props) {
  const recommandation = useMemo(() => {
    const avecCapacite = voyages
      .map((voyage) => {
        const vehicule = vehicules.find((item) => item.id === voyage.vehicule_id);
        const capacite = vehicule?.capacite ?? 0;
        const colisVoyage = colis.filter((item) => item.voyage_id === voyage.id).length;
        const passagers = passagersParVoyage[voyage.id] ?? 0;
        return {
          voyage,
          capacite,
          charge: colisVoyage + passagers,
          jour: new Date(voyage.date_depart).getDay(),
        };
      })
      .filter((item) => item.capacite > 0 && item.voyage.statut !== "annule");

    if (avecCapacite.length < 2) return null;

    const tauxActuel = avecCapacite.reduce(
      (total, item) => total + item.charge / item.capacite,
      0,
    ) / avecCapacite.length;
    const tauxParJour = avecCapacite.reduce<Record<number, number[]>>((acc, item) => {
      (acc[item.jour] ??= []).push(item.charge / item.capacite);
      return acc;
    }, {});
    const jourCible = avecCapacite[0].jour;
    const historique = tauxParJour[jourCible] ?? [];
    const tauxSaisonnier = historique.length
      ? historique.reduce((total, taux) => total + taux, 0) / historique.length
      : tauxActuel;
    const tauxPrevu = Math.max(tauxActuel, tauxSaisonnier);
    const coefficient = tauxPrevu >= 0.85 ? 1.1 : tauxPrevu <= 0.4 ? 0.95 : 1;

    return {
      tauxPrevu: Math.round(tauxPrevu * 100),
      coefficient,
      observations: avecCapacite.length,
      saisonnalite: historique.length >= 2,
      action:
        coefficient > 1
          ? "Préserver la capacité et appliquer une majoration validée par l’opérateur."
          : coefficient < 1
            ? "Stimuler la demande avec une remise validée par l’opérateur."
            : "Maintenir le tarif de référence.",
    };
  }, [colis, passagersParVoyage, vehicules, voyages]);

  return (
    <Carte
      titre="Optimisation tarifaire (yield management)"
      description="Recommandation indicative basée sur le remplissage et la saisonnalité"
    >
      {!recommandation ? (
        <p className="text-sm text-ardoise-clair">
          Données insuffisantes : au moins 2 voyages avec une capacité déclarée sont nécessaires.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Indicateur
              libelle="Remplissage prévu"
              valeur={`${recommandation.tauxPrevu}%`}
              couleur={recommandation.tauxPrevu >= 85 ? "text-terre" : "text-lagune"}
            />
            <Indicateur
              libelle="Coefficient conseillé"
              valeur={`×${recommandation.coefficient.toFixed(2)}`}
              couleur="text-ocre-fonce"
            />
            <Indicateur
              libelle="Voyages analysés"
              valeur={String(recommandation.observations)}
              couleur="text-ardoise"
            />
          </div>
          <p className="text-sm text-ardoise">{recommandation.action}</p>
          {!recommandation.saisonnalite && (
            <p className="text-xs text-ardoise-clair">
              Saisonnalité non confirmée : la recommandation repose principalement sur le remplissage courant.
            </p>
          )}
          <p className="text-xs text-ardoise-clair">
            La recommandation ne modifie aucun tarif et ne remplace pas la validation du transporteur.
          </p>
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
