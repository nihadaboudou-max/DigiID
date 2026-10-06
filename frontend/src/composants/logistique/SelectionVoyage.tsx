"use client";
/**
 * Choix d'un car (donc d'un chauffeur) — composant partagé du pivot logistique.
 *
 * Réponse à une question concrète du terrain : « où trouve-t-on l'identifiant du
 * chauffeur ? ». **Nulle part, et c'est voulu** : le receveur ne manipule jamais
 * d'UUID. Il choisit un **voyage**, affiché avec son horaire, son immatriculation
 * et le **nom de son chauffeur**. L'identifiant technique en découle.
 *
 * Le filtre par trajet évite l'erreur coûteuse : affecter un colis Cotonou → Parakou
 * à un car Parakou → Cotonou. Les voyages sans chauffeur sont signalés comme tels
 * (ils ne peuvent pas être choisis pour une affectation).
 */
import { useMemo, useState } from "react";

import { Badge } from "@/composants/commun/Badge";
import { IconeUtilisateur } from "@/composants/commun/Icones";
import type { Ligne, Voyage } from "@/services/logistique_api";
import { formaterDateHeure } from "./format";

/** Libellé lisible d'un voyage : « 12/05 08:00 · AB-1234-RB · Amadou Diallo ». */
export function libelleVoyage(voyage: Voyage | null | undefined): string {
  if (!voyage) return "Voyage inconnu";
  return [
    formaterDateHeure(voyage.date_depart),
    voyage.vehicule_immatriculation,
    voyage.chauffeur_nom ? `chauffeur : ${voyage.chauffeur_nom}` : "sans chauffeur",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Trajet d'un voyage (« Cotonou → Parakou »), d'après la ligne déclarée. */
export function trajetVoyage(
  voyage: Voyage | null | undefined,
  lignes: Ligne[] = [],
): string | null {
  if (!voyage) return null;
  const ligne = lignes.find((l) => l.id === voyage.ligne_id);
  if (!ligne) return null;
  return `${ligne.gare_depart_nom ?? "?"} → ${ligne.gare_arrivee_nom ?? "?"}`;
}

interface Proprietes {
  voyages: Voyage[];
  /** Lignes du référentiel : servent à afficher le trajet de chaque car. */
  lignes?: Ligne[];
  /** Voyage sélectionné (identifiant). */
  valeur: string;
  surSelection: (voyageId: string, voyage: Voyage | null) => void;
  /**
   * Trajet déclaré. Si les deux gares sont fournies, seuls les cars qui
   * desservent **ce** trajet sont proposés : impossible de se tromper de sens.
   */
  gareDepartId?: string;
  gareArriveeId?: string;
  /** Exclut les voyages sans chauffeur affecté (défaut : true). */
  exigerChauffeur?: boolean;
  libelle?: string;
  obligatoire?: boolean;
  desactive?: boolean;
  aide?: string;
  /** `select` (formulaires compacts) ou `liste` (affectation, choix explicite). */
  mode?: "select" | "liste";
}

export function SelectionVoyage({
  voyages,
  lignes = [],
  valeur,
  surSelection,
  gareDepartId,
  gareArriveeId,
  exigerChauffeur = true,
  libelle = "Voyage / chauffeur",
  obligatoire = false,
  desactive = false,
  aide,
  mode = "select",
}: Proprietes) {
  const [recherche, setRecherche] = useState("");

  // Voyages compatibles avec le trajet déclaré (si connu) + filtre de recherche.
  const candidats = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return voyages.filter((v) => {
      if (exigerChauffeur && !v.chauffeur_id) return false;
      if (gareDepartId && gareArriveeId) {
        const ligne = lignes.find((l) => l.id === v.ligne_id);
        if (ligne) {
          if (
            ligne.gare_depart_id !== gareDepartId ||
            ligne.gare_arrivee_id !== gareArriveeId
          ) {
            return false;
          }
        }
      }
      if (!terme) return true;
      return [v.chauffeur_nom, v.vehicule_immatriculation, trajetVoyage(v, lignes)]
        .filter(Boolean)
        .some((champ) => String(champ).toLowerCase().includes(terme));
    });
  }, [voyages, lignes, exigerChauffeur, gareDepartId, gareArriveeId, recherche]);

  const filtreActif = Boolean(gareDepartId && gareArriveeId);

  if (mode === "liste") {
    return (
      <div className="space-y-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ardoise">
            {libelle} {obligatoire && <span className="text-terre">*</span>}
          </span>
          <input
            className="champ-saisie"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher un chauffeur ou une immatriculation…"
          />
          {aide && <p className="text-xs text-ardoise-clair">{aide}</p>}
        </div>

        {candidats.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ardoise-clair/40 px-3 py-4 text-center text-sm text-ardoise-clair">
            {filtreActif
              ? "Aucun car de ce trajet n'a de chauffeur affecté. Demandez au gérant d'affecter un chauffeur au voyage."
              : "Aucun voyage disponible pour le moment."}
          </p>
        ) : (
          <ul className="space-y-2">
            {candidats.map((v) => {
              const choisi = v.id === valeur;
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    disabled={desactive}
                    onClick={() => surSelection(choisi ? "" : v.id, choisi ? null : v)}
                    className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                      choisi
                        ? "border-lagune bg-lagune-teinte"
                        : "border-ardoise/15 bg-white hover:bg-lagune-teinte/40"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <span className="flex flex-col">
                      <span className="font-medium text-ardoise">
                        {v.chauffeur_nom ?? "Chauffeur non affecté"}
                      </span>
                      <span className="text-xs text-ardoise-clair">
                        {formaterDateHeure(v.date_depart)}
                        {v.vehicule_immatriculation
                          ? ` · ${v.vehicule_immatriculation}`
                          : ""}
                        {trajetVoyage(v, lignes) ? ` · ${trajetVoyage(v, lignes)}` : ""}
                      </span>
                    </span>
                    {v.chauffeur_id ? (
                      <Badge variante={choisi ? "succes" : "neutre"}>
                        {choisi ? "Sélectionné" : "Choisir"}
                      </Badge>
                    ) : (
                      <Badge variante="ocre">Sans chauffeur</Badge>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-ardoise">
        {libelle} {obligatoire && <span className="text-terre">*</span>}
      </label>
      <select
        className="champ-saisie"
        value={valeur}
        disabled={desactive}
        onChange={(e) => {
          const id = e.target.value;
          surSelection(id, voyages.find((v) => v.id === id) ?? null);
        }}
      >
        <option value="">— Choisir un car —</option>
        {candidats.map((v) => (
          <option key={v.id} value={v.id}>
            {libelleVoyage(v)}
            {trajetVoyage(v, lignes) ? ` · ${trajetVoyage(v, lignes)}` : ""}
          </option>
        ))}
      </select>
      {aide && <p className="text-xs italic text-ardoise-clair">{aide}</p>}
      {filtreActif && candidats.length === 0 && (
        <p className="text-xs font-medium text-terre">
          Aucun car de ce trajet n&apos;a de chauffeur affecté.
        </p>
      )}
      {!filtreActif && candidats.length === 0 && (
        <p className="flex items-center gap-1 text-xs text-ardoise-clair">
          <IconeUtilisateur className="h-3 w-3" />
          Aucun voyage avec chauffeur n&apos;est disponible : un gérant doit
          d&apos;abord affecter un chauffeur à un voyage.
        </p>
      )}
    </div>
  );
}
