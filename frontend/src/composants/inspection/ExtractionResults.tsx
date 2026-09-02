"use client";

import { ReponseUploadDocument, StatutVerification } from "@/types/inspection";

interface ExtractionResultsProps {
  result: ReponseUploadDocument | null;
  loading: boolean;
  error: string | null;
}

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

  const { donnees, validation, coherence } = result;

  return (
    <div className="space-y-6">
      {/* Statut de validation */}
      <div
        className={`p-4 rounded-lg border-2 ${
          validation.est_valide
            ? "bg-green-50 border-green-200"
            : "bg-red-50 border-red-200"
        }`}
      >
        <div className="flex items-center">
          <div className="text-3xl mr-3">
            {validation.est_valide ? "✅" : "❌"}
          </div>
          <div>
            <h4 className="font-semibold text-gray-800">
              {validation.est_valide ? "Document validé" : "Document rejeté"}
            </h4>
            <p className="text-sm text-gray-600 mt-1">{validation.message}</p>
          </div>
        </div>
      </div>

      {/* Données extraites */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-800 mb-4">
          Données extraites
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoField label="Nom" value={donnees.nom_famille} />
          <InfoField label="Prénoms" value={donnees.prenoms} />
          <InfoField label="Date de naissance" value={donnees.date_naissance} />
          <InfoField label="Sexe" value={donnees.sexe} />
          <InfoField label="Numéro document" value={donnees.numero_document} />
          <InfoField label="Date d'expiration" value={donnees.date_expiration} />
          <InfoField label="Lieu de naissance" value={donnees.lieu_naissance} />
          <InfoField label="Nationalité" value={donnees.nationalite} />
          <InfoField label="Pays émetteur" value={donnees.pays_emetteur} />
          <InfoField label="Confiance OCR" value={`${donnees.taux_confiance_ocr.toFixed(1)}%`} />
        </div>
      </div>

      {/* Cohérence identité */}
      {coherence && (
        <div
          className={`p-4 rounded-lg border ${
            coherence.est_coherent
              ? "bg-blue-50 border-blue-200"
              : "bg-yellow-50 border-yellow-200"
          }`}
        >
          <h4 className="font-semibold text-gray-800 mb-2">
            Vérification d'identité
          </h4>
          <p className="text-sm text-gray-700">{coherence.message}</p>
          {coherence.incoherences.length > 0 && (
            <ul className="mt-2 space-y-1">
              {coherence.incoherences.map((inc, idx) => (
                <li key={idx} className="text-sm text-yellow-800">
                  • {inc}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Scores de validation */}
      {Object.keys(validation.scores).length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-800 mb-3">
            Scores de validation
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(validation.scores).map(([key, value]) => (
              <div
                key={key}
                className={`text-sm px-3 py-2 rounded ${
                  value ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                }`}
              >
                {value ? "✓" : ""} {key}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
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