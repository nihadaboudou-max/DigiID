/**
 * ListeAttestations — Liste paginée avec filtres des attestations.
 * 
 * Affiche :
 *   - Barre de filtres (statut, type)
 *   - Tableau/liste d'attestations
 *   - Pagination
 *   - Indicateurs de chargement et d'état vide
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { StatutAttestation } from "./StatutAttestation";
import {
  listerAttestations,
  ETIQUETTES_TYPES,
  type AttestationResume,
  type StatistiquesAttestations,
  type TypeAttestation,
  type StatutAttestation as TypeStatut,
} from "@/services/attestations_communautaires";
import { ErreurAPI } from "@/services/client_api";
import clsx from "clsx";

// ============================================================================
// Types
// ============================================================================

/** Propriétés du composant */
interface ProprietesListeAttestations {
  /** Direction : "recues" ou "envoyees" */
  direction: "recues" | "envoyees";
  /** Titre affiché dans l'en-tête */
  titre: string;
  /** Description sous le titre */
  description: string;
  /** Nom du champ personne (ex: "Attestant" ou "Attesté") */
  nomPersonne: string;
}

// ============================================================================
// Filtres
// ============================================================================

const STATUTS_FILTRES: Array<{ valeur: string; libelle: string }> = [
  { valeur: "", libelle: "Tous" },
  { valeur: "APPROUVEE", libelle: "Approuvées" },
  { valeur: "EN_ATTENTE", libelle: "En attente" },
  { valeur: "REFUSEE", libelle: "Refusées" },
  { valeur: "EXPIREE", libelle: "Expirées" },
];

const TYPES_FILTRES: Array<{ valeur: string; libelle: string }> = [
  { valeur: "", libelle: "Tous les types" },
  ...Object.entries(ETIQUETTES_TYPES).map(([valeur, libelle]) => ({
    valeur,
    libelle,
  })),
];

// ============================================================================
// Composant principal
// ============================================================================

export function ListeAttestations({
  direction,
  titre,
  description,
  nomPersonne,
}: ProprietesListeAttestations) {
  // --- État ---
  const [attestations, setAttestations] = useState<AttestationResume[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pagesTotales, setPagesTotales] = useState(1);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  // --- Filtres ---
  const [filtreStatut, setFiltreStatut] = useState("");
  const [filtreType, setFiltreType] = useState("");

  const LIMITE = 20;

  // --- Chargement ---
  useEffect(() => {
    chargerAttestations();
  }, [page, filtreStatut, filtreType, direction]);

  async function chargerAttestations() {
    setChargement(true);
    setErreur(null);
    try {
      const resultat = await listerAttestations(
        direction,
        (filtreStatut as TypeStatut) || undefined,
        (filtreType as TypeAttestation) || undefined,
        page,
        LIMITE,
      );
      setAttestations(resultat.attestations);
      setTotal(resultat.total);
      setPagesTotales(resultat.pages_totales);
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Erreur de chargement des attestations.",
      );
    } finally {
      setChargement(false);
    }
  }

  // --- Réinitialiser la page quand les filtres changent ---
  function changerFiltreStatut(valeur: string) {
    setFiltreStatut(valeur);
    setPage(1);
  }

  function changerFiltreType(valeur: string) {
    setFiltreType(valeur);
    setPage(1);
  }

  return (
    <div className="space-y-6 apparition">
      {/* En-tête */}
      <header>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
          Attestations communautaires
        </p>
        <h1 className="mt-1">{titre}</h1>
        <p className="text-ardoise-clair mt-2">{description}</p>
      </header>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Filtre par statut */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-ardoise-clair/60 font-medium uppercase tracking-wide">
            Statut :
          </span>
          <div className="flex flex-wrap gap-1">
            {STATUTS_FILTRES.map((filtre) => (
              <button
                key={filtre.valeur}
                onClick={() => changerFiltreStatut(filtre.valeur)}
                className={clsx(
                  "px-3 py-1.5 text-xs rounded-lg border transition-all duration-200",
                  filtreStatut === filtre.valeur
                    ? "bg-lagune text-white border-lagune"
                    : "bg-white text-ardoise-clair border-ardoise-clair/20 hover:border-lagune/50",
                )}
              >
                {filtre.libelle}
              </button>
            ))}
          </div>
        </div>

        {/* Filtre par type */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-ardoise-clair/60 font-medium uppercase tracking-wide">
            Type :
          </span>
          <select
            value={filtreType}
            onChange={(e) => changerFiltreType(e.target.value)}
            className="px-3 py-1.5 text-xs border border-ardoise-clair/20 rounded-lg
                       bg-white focus:outline-none focus:ring-2 focus:ring-lagune/20"
          >
            {TYPES_FILTRES.map((filtre) => (
              <option key={filtre.valeur} value={filtre.valeur}>
                {filtre.libelle}
              </option>
            ))}
          </select>
        </div>

        {/* Compteur */}
        <span className="text-xs text-ardoise-clair/40 ml-auto">
          {total} attestation{total > 1 ? "s" : ""}
        </span>
      </div>

      {/* Erreur */}
      {erreur && (
        <Alerte variante="erreur" titre="Erreur">
          {erreur}
          <div className="mt-2">
            <Bouton variante="secondaire" onClick={chargerAttestations}>
              Réessayer
            </Bouton>
          </div>
        </Alerte>
      )}

      {/* État de chargement */}
      {chargement && (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-sable rounded-xl" />
          ))}
        </div>
      )}

      {/* Liste des attestations */}
      {!chargement && !erreur && attestations.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-ardoise-clair/20">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-ardoise-clair font-medium">
            {direction === "recues"
              ? "Tu n'as pas encore reçu d'attestation."
              : "Tu n'as pas encore envoyé d'attestation."}
          </p>
          <p className="text-sm text-ardoise-clair/60 mt-1">
            {direction === "recues"
              ? "Les attestations des autres membres apparaîtront ici."
              : "Utilise le bouton ci-dessous pour attester un membre."}
          </p>
          {direction === "envoyees" && (
            <div className="mt-4">
              <Link href="/attestations-communautaires/nouvelle">
                <Bouton variante="primaire">Créer une attestation</Bouton>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Tableau des attestations */}
      {!chargement && !erreur && attestations.length > 0 && (
        <div className="bg-white rounded-xl border border-ardoise-clair/10 overflow-hidden">
          <div className="divide-y divide-ardoise-clair/5">
            {attestations.map((attestation) => (
              <Link
                key={attestation.id}
                href={`/attestations-communautaires/attestation/${attestation.id}`}
                className="flex items-center justify-between px-4 py-3.5 hover:bg-sable/30 transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-ardoise text-sm truncate group-hover:text-lagune transition-colors">
                      {attestation.titre}
                    </p>
                    <span className="text-[10px] uppercase text-ardoise-clair/40 bg-sable-clair px-1.5 py-0.5 rounded">
                      {ETIQUETTES_TYPES[attestation.type_attestation] || attestation.type_attestation}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-ardoise-clair/60">
                    <span>
                      {direction === "recues" ? "De : " : "Pour : "}
                      <strong className="text-ardoise/80">
                        {direction === "recues"
                          ? attestation.attestant_nom_complet
                          : attestation.atteste_nom_complet}
                      </strong>
                    </span>
                    <span>·</span>
                    <span>
                      +{attestation.poids_score} pts
                    </span>
                    <span>·</span>
                    <span>
                      {new Date(attestation.date_soumission).toLocaleDateString(
                        "fr-FR",
                        { day: "numeric", month: "short", year: "numeric" },
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  <StatutAttestation statut={attestation.statut as TypeStatut} />
                  <svg
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    className="text-ardoise-clair/30 group-hover:text-lagune transition-colors"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagesTotales > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Bouton
            variante="secondaire"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Précédent
          </Bouton>
          <span className="text-sm text-ardoise-clair px-3">
            Page {page} sur {pagesTotales}
          </span>
          <Bouton
            variante="secondaire"
            disabled={page >= pagesTotales}
            onClick={() => setPage((p) => Math.min(pagesTotales, p + 1))}
          >
            Suivant →
          </Bouton>
        </div>
      )}
    </div>
  );
}
