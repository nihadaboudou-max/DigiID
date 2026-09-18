"use client";

import { ReponseDocumentUnifie, TypeDocument } from "@/types/inspection";

interface ExtractionResultsProps {
  result: ReponseDocumentUnifie | null;
  loading: boolean;
  error: string | null;
}

const LIBELLES_TYPE: Record<string, string> = {
  [TypeDocument.CNI_BIOMETRIQUE]: "CNI Biométrique",
  [TypeDocument.CNI_PAPIER]: "CNI Papier",
  [TypeDocument.PASSEPORT]: "Passeport",
  [TypeDocument.PERMIS_CONDUIRE]: "Permis de conduire",
  [TypeDocument.CARTE_ASSURANCE]: "Carte d'assurance",
  [TypeDocument.CARTE_SEJOUR]: "Carte de séjour",
  [TypeDocument.CARTE_GRISE]: "Carte grise",
  [TypeDocument.CARTE_CONSULAIRE]: "Carte consulaire",
  [TypeDocument.CARTE_VOTE]: "Carte de vote",
  [TypeDocument.CARTE_ETUDIANT]: "Carte étudiant",
  [TypeDocument.INCONNU]: "Inconnu",
};

const LIBELLES_STATUT: Record<string, string> = {
  approuve: "Document validé",
  rejete: "Document rejeté",
  expiree: "Document expiré",
  en_attente: "En attente de vérification",
};

export default function ExtractionResults({ result, loading, error }: ExtractionResultsProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-700">Analyse en cours...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="text-red-500 text-xl mr-3">⚠️</div>
          <div>
            <h4 className="font-semibold text-red-800">Erreur</h4>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return null;
  }

    const { donnees, statut, message, temps_ms, champs_extraits } = result;
  const estOk = statut === "approuve";
  const estExpire = statut === "expiree";

  const classesBandeau = estOk
    ? "bg-green-50 border-green-200"
    : estExpire
    ? "bg-orange-50 border-orange-200"
    : "bg-red-50 border-red-200";
  const iconeBandeau = estOk ? "✅" : estExpire ? "⏳" : "❌";

  return (
    <div className="space-y-6">
      {/* Statut */}
      <div className={`p-4 rounded-lg border-2 ${classesBandeau}`}>
        <div className="flex items-center">
          <div className="text-3xl mr-3">{iconeBandeau}</div>
          <div>
            <h4 className="font-semibold text-gray-800">
              {LIBELLES_STATUT[statut] ?? statut}
            </h4>
            <p className="text-sm text-gray-600 mt-1">{message}</p>
          </div>
        </div>
      </div>

      {/* Données extraites (rendu générique quel que soit le document) */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-gray-800">
            Données extraites — {LIBELLES_TYPE[result.type_document] ?? result.type_document}
          </h4>
          <span className="text-xs text-gray-400">
            {champs_extraits} champ(s) • {temps_ms} ms
          </span>
        </div>
        {Object.keys(donnees).length === 0 ? (
          <p className="text-sm text-gray-500">Aucune donnée extraite.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(donnees).map(([cle, valeur]) => (
              <InfoField
                key={cle}
                label={formaterLibelleChamp(cle)}
                value={formaterValeur(valeur)}
              />
            ))}
          </div>
        )}
      </div>

            {/* Texte brut OCR (aide au débogage) */}
      {result.texte_brut && (
        <details className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <summary className="text-sm font-medium text-gray-700 cursor-pointer">
            Texte brut OCR
          </summary>
          <pre className="mt-2 text-xs font-mono text-gray-600 whitespace-pre-wrap break-all">
            {result.texte_brut}
          </pre>
        </details>
      )}
    </div>
  );
}

function formaterLibelleChamp(cle: string): string {
  return cle
    .split("_")
    .map((mot) => mot.charAt(0).toUpperCase() + mot.slice(1))
    .join(" ");
}

function formaterValeur(valeur: any): string {
  if (valeur === null || valeur === undefined) return "";
  if (Array.isArray(valeur)) return valeur.join(", ");
  if (typeof valeur === "object") return JSON.stringify(valeur);
  return String(valeur);
}

function InfoField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-gray-500 uppercase">
        {label}
      </div>
      <div className="text-gray-900 font-medium mt-1">
        {value || <span className="text-gray-400">Non extrait</span>}
      </div>
    </div>
  );
}