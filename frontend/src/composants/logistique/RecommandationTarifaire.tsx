"use client";

import { Carte } from "@/composants/commun/Carte";
import type { AnalysesLogistiques } from "@/services/logistique_api";

export function RecommandationTarifaire({
  analyses,
}: {
  analyses: AnalysesLogistiques;
}) {
  const tauxRemplissage = analyses.taux_remplissage_pct;
  const coefficient = analyses.coefficient_suggere;

  return (
    <Carte
      titre="Optimisation tarifaire (yield management)"
      description="Recommandation indicative basée sur le remplissage et la saisonnalité"
    >
      {tauxRemplissage === null || coefficient === null ? (
        <p className="text-sm text-ardoise-clair">
          Données insuffisantes : au moins 2 voyages avec une capacité déclarée sont nécessaires.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Indicateur
              libelle="Remplissage prévu"
              valeur={`${tauxRemplissage}%`}
              couleur={tauxRemplissage >= 85 ? "text-terre" : "text-lagune"}
            />
            <Indicateur
              libelle="Coefficient conseillé"
              valeur={`×${coefficient.toFixed(2)}`}
              couleur="text-ocre-fonce"
            />
            <Indicateur
              libelle="Voyages analysés"
              valeur={String(analyses.voyages_mesurables)}
              couleur="text-ardoise"
            />
          </div>
          <p className="text-sm text-ardoise">{analyses.action_suggeree}</p>
          {!analyses.saisonnalite_confirmee && (
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
