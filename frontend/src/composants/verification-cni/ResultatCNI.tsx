/**
 * Composant d'affichage des résultats OCR de la CNI.
 *
 * Affiche les données extraites de manière structurée, avec
 * des indicateurs visuels pour la validité de chaque champ.
 */
"use client";

import React from "react";
import {
  classeStatutCNI,
  formaterDateCNI,
  iconeStatutCNI,
  ReponseUploadCNI,
  SyntheseVerificationCNI,
} from "@/services/verification_cni";

interface ResultatCNIProps {
  resultat: ReponseUploadCNI | null;
  synthese: SyntheseVerificationCNI | null;
}

/**
 * Affiche une valeur de champ avec son label.
 */
function ChampCNI({
  label,
  valeur,
  valide,
}: {
  label: string;
  valeur: string | null;
  valide?: boolean;
}) {
  const afficher = valeur || "Non détecté";
  const estDetecte = valeur !== null && valeur !== "non_detecte" && valeur !== "";

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
      <span className="text-sm font-medium text-gray-600">{label}</span>
      <span
        className={`text-sm ${
          estDetecte
            ? valide === false
              ? "text-red-600"
              : "text-gray-900"
            : "text-gray-400 italic"
        }`}
      >
        {valide === false && "⚠ "}
        {estDetecte ? afficher : "—"}
      </span>
    </div>
  );
}

/**
 * Affiche les scores de validation.
 */
function ScoresValidation({
  scores,
}: {
  scores: Record<string, boolean> | null | undefined;
}) {
  if (!scores || Object.keys(scores).length === 0) return null;

  const labels: Record<string, string> = {
    numero_cni: "Numéro de carte",
    date_naissance: "Date de naissance",
    date_expiration: "Date d'expiration",
    sexe: "Sexe",
    mrz: "MRZ",
    identite: "Identité",
    mrz_checksum_numero: "Checksum numéro MRZ",
    mrz_checksum_ddn: "Checksum date naiss. MRZ",
    mrz_checksum_exp: "Checksum expiration MRZ",
  };

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
      <h4 className="text-sm font-semibold text-gray-700 mb-2">
        Détail des validations
      </h4>
      <div className="space-y-1">
        {Object.entries(scores).map(([cle, valide]) => (
          <div key={cle} className="flex items-center justify-between text-xs">
            <span className="text-gray-600">
              {labels[cle] || cle}
            </span>
            <span
              className={`font-medium ${
                valide ? "text-green-600" : "text-red-500"
              }`}
            >
              {valide ? "✓" : "✗"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Affiche les données OCR brutes (debug).
 */
function TexteBrut({ texte }: { texte: string | null | undefined }) {
  if (!texte) return null;

  return (
    <details className="mt-4">
      <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
        Afficher le texte OCR brut
      </summary>
      <pre className="mt-2 p-3 bg-gray-100 rounded text-xs text-gray-600 overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap font-mono">
        {texte}
      </pre>
    </details>
  );
}

export function ResultatOCR({
  resultat,
  synthese,
}: ResultatCNIProps) {
  if (!resultat && !synthese) {
    return (
      <div className="text-center py-8 text-gray-400">
        Aucun résultat à afficher. Scanne une carte pour commencer.
      </div>
    );
  }

  const donnees = resultat?.resultat_ocr?.donnees;
  const validation = synthese?.validation_globale || null;
  const statut = synthese?.statut || resultat?.statut || "en_attente";

  return (
    <div className="space-y-6">
      {/* Bannière de statut */}
      <div
        className={`p-4 rounded-lg border ${classeStatutCNI(statut)}`}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{iconeStatutCNI(statut)}</span>
          <div>
            <h3 className="font-semibold">
              {statut === "approuve"
                ? "CNI valide"
                : statut === "rejete"
                ? "CNI invalide"
                : "Analyse en cours"}
            </h3>
            <p className="text-sm opacity-80">
              {validation?.message || resultat?.message || "En attente..."}
            </p>
          </div>
        </div>
      </div>

      {/* Barre de progression des champs extraits */}
      {synthese && (
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Champs extraits</span>
            <span>
              {synthese.champs_verifies}/{synthese.champs_total}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                synthese.statut === "approuve"
                  ? "bg-green-500"
                  : synthese.statut === "rejete"
                  ? "bg-red-500"
                  : "bg-amber-500"
              }`}
              style={{
                width: `${
                  (synthese.champs_verifies / synthese.champs_total) * 100
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Données extraites */}
      {donnees && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">
            Données extraites
          </h4>

          <ChampCNI
            label="Nom de famille"
            valeur={donnees.nom_famille}
          />
          <ChampCNI
            label="Prénom(s)"
            valeur={donnees.prenoms}
          />
          <ChampCNI
            label="Sexe"
            valeur={donnees.sexe}
            valide={donnees.sexe === "M" || donnees.sexe === "F"}
          />
          <ChampCNI
            label="Date de naissance"
            valeur={formaterDateCNI(donnees.date_naissance)}
            valide={validation?.scores_validation?.date_naissance}
          />
          <ChampCNI
            label="Lieu de naissance"
            valeur={donnees.lieu_naissance}
          />
          <ChampCNI
            label="Numéro CNI"
            valeur={donnees.numero_cni}
            valide={validation?.scores_validation?.numero_cni}
          />
          <ChampCNI
            label="Date de délivrance"
            valeur={formaterDateCNI(donnees.date_delivrance)}
          />
          <ChampCNI
            label="Date d'expiration"
            valeur={formaterDateCNI(donnees.date_expiration)}
            valide={validation?.scores_validation?.date_expiration}
          />
          <ChampCNI
            label="Autorité"
            valeur={donnees.autorite_delivrance}
          />
          <ChampCNI
            label="Taille"
            valeur={donnees.taille ? `${donnees.taille} cm` : null}
          />

          {/* MRZ */}
          {donnees.mrz_ligne_1 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h5 className="text-xs font-bold text-gray-500 uppercase mb-2">
                Zone MRZ
              </h5>
              <div className="font-mono text-xs bg-gray-50 p-3 rounded space-y-1">
                {donnees.mrz_ligne_1 && (
                  <p className="text-gray-700">{donnees.mrz_ligne_1}</p>
                )}
                {donnees.mrz_ligne_2 && (
                  <p className="text-gray-700">{donnees.mrz_ligne_2}</p>
                )}
                {donnees.mrz_ligne_3 && (
                  <p className="text-gray-700">{donnees.mrz_ligne_3}</p>
                )}
              </div>
              {validation?.verification_mrz !== null && (
                <p
                  className={`text-xs mt-1 ${
                    validation?.verification_mrz
                      ? "text-green-600"
                      : "text-amber-600"
                  }`}
                >
                  {validation?.verification_mrz
                    ? "✓ MRZ valide (checksums OK)"
                    : "⚠ MRZ partiellement lue"}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Scores de validation */}
      <ScoresValidation scores={synthese?.validation_globale?.scores_validation} />

      {/* Format de la carte */}
      {donnees?.format_carte && (
        <div className="text-xs text-gray-400">
          Format détecté :{" "}
          {donnees.format_carte === "nouveau_2021"
            ? "Nouveau format (2021+)"
            : donnees.format_carte === "ancien"
            ? "Ancien format"
            : "Non reconnu"}
          {donnees.taux_confiance_moyen !== null &&
            donnees.taux_confiance_moyen !== undefined && (
              <span>
                {" "}
— Confiance OCR : {donnees.taux_confiance_moyen.toFixed(1)}%
              </span>
            )}
        </div>
      )}

      {/* Texte brut (debug) */}
      <TexteBrut texte={donnees?.texte_brut} />

      {/* Erreurs */}
      {resultat?.resultat_ocr?.erreurs &&
        resultat.resultat_ocr.erreurs.length > 0 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <h5 className="text-sm font-medium text-red-700 mb-1">
              Avertissements
            </h5>
            <ul className="list-disc list-inside text-xs text-red-600 space-y-1">
              {resultat.resultat_ocr.erreurs.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}
    </div>
  );
}

export default ResultatOCR;
