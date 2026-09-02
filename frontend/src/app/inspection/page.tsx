"use client";

import { useState, useEffect } from "react";
import {
  TypeDocument,
  ReponseUploadDocument,
  DetailVerification,
  StatutVerification,
} from "@/types/inspection";
import {
  uploadDocument,
  obtenirHistorique,
  supprimerVerification,
} from "@/services/inspectionApi";

export default function TestInspectionPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [typeDocument, setTypeDocument] = useState<TypeDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReponseUploadDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historique, setHistorique] = useState<DetailVerification[]>([]);
  const [loadingHistorique, setLoadingHistorique] = useState(false);

  // Charger l'historique au démarrage
  useEffect(() => {
    chargerHistorique();
  }, []);

  const chargerHistorique = async () => {
    setLoadingHistorique(true);
    try {
      const data = await obtenirHistorique(10);
      setHistorique(data.historique);
    } catch (err) {
      console.error("Erreur chargement historique:", err);
    } finally {
      setLoadingHistorique(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Veuillez sélectionner une image");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await uploadDocument(
        selectedFile,
        typeDocument || undefined,
        "recto"
      );
      setResult(response);
      // Recharger l'historique après un upload réussi
      await chargerHistorique();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'upload");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette vérification ?")) return;
    try {
      await supprimerVerification(id);
      await chargerHistorique();
    } catch (err) {
      alert("Erreur lors de la suppression");
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPreview(null);
    setTypeDocument(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* En-tête */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            🧪 Test Inspection de Documents
          </h1>
          <p className="text-gray-600 mt-2">
            Page de test pour valider le module d'inspection de documents
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Colonne gauche : Upload et test */}
          <div className="space-y-6">
            {/* Upload d'image */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">
                📷 Upload d'image
              </h2>

              <div className="space-y-4">
                {/* Sélection de fichier */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sélectionner une image
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/tiff"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>

                {/* Aperçu */}
                {preview && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Aperçu
                    </label>
                    <img
                      src={preview}
                      alt="Aperçu"
                      className="max-h-64 rounded-lg border border-gray-200"
                    />
                  </div>
                )}

                {/* Sélection du type de document */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type de document (optionnel - auto-détecté si non sélectionné)
                  </label>
                  <select
                    value={typeDocument || ""}
                    onChange={(e) =>
                      setTypeDocument(
                        e.target.value ? (e.target.value as TypeDocument) : null
                      )
                    }
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Auto-détection</option>
                    <option value={TypeDocument.CNI_BIOMETRIQUE}>
                      CNI Biométrique
                    </option>
                    <option value={TypeDocument.CNI_PAPIER}>CNI Papier</option>
                    <option value={TypeDocument.PASSEPORT}>Passeport</option>
                    <option value={TypeDocument.PERMIS_CONDUIRE}>
                      Permis de Conduire
                    </option>
                    <option value={TypeDocument.CARTE_ASSURANCE}>
                      Carte d'Assurance
                    </option>
                  </select>
                </div>

                {/* Boutons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleUpload}
                    disabled={!selectedFile || loading}
                    className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? "⏳ Analyse en cours..." : "🚀 Analyser"}
                  </button>
                  <button
                    onClick={resetForm}
                    className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    🔄 Réinitialiser
                  </button>
                </div>
              </div>
            </div>

            {/* Résultats */}
            {result && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">
                  ✅ Résultats de l'analyse
                </h2>

                {/* Statut */}
                <div
                  className={`p-4 rounded-lg mb-4 ${
                    result.validation.est_valide
                      ? "bg-green-50 border border-green-200"
                      : "bg-red-50 border border-red-200"
                  }`}
                >
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">
                      {result.validation.est_valide ? "✅" : "❌"}
                    </span>
                    <div>
                      <p className="font-semibold">
                        {result.validation.est_valide
                          ? "Document validé"
                          : "Document rejeté"}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {result.validation.message}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Données extraites */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-800">
                    Données extraites
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <InfoField
                      label="Type"
                      value={result.donnees.type_document}
                    />
                    <InfoField
                      label="Pays"
                      value={result.donnees.pays_emetteur}
                    />
                    <InfoField
                      label="Nom"
                      value={result.donnees.nom_famille}
                    />
                    <InfoField
                      label="Prénoms"
                      value={result.donnees.prenoms}
                    />
                    <InfoField
                      label="Date naissance"
                      value={result.donnees.date_naissance}
                    />
                    <InfoField label="Sexe" value={result.donnees.sexe} />
                    <InfoField
                      label="N° Document"
                      value={result.donnees.numero_document}
                    />
                    <InfoField
                      label="Expiration"
                      value={result.donnees.date_expiration}
                    />
                    <InfoField
                      label="Confiance OCR"
                      value={`${result.donnees.taux_confiance_ocr.toFixed(1)}%`}
                    />
                    <InfoField
                      label="MRZ Valide"
                      value={result.donnees.mrz_valide ? "Oui" : "Non"}
                    />
                  </div>
                </div>

                {/* Cohérence */}
                {result.coherence && (
                  <div className="mt-4">
                    <h3 className="font-semibold text-gray-800 mb-2">
                      Vérification d'identité
                    </h3>
                    <div
                      className={`p-3 rounded-lg text-sm ${
                        result.coherence.est_coherent
                          ? "bg-blue-50 text-blue-800"
                          : "bg-yellow-50 text-yellow-800"
                      }`}
                    >
                      {result.coherence.message}
                    </div>
                  </div>
                )}

                {/* Scores */}
                {Object.keys(result.validation.scores).length > 0 && (
                  <div className="mt-4">
                    <h3 className="font-semibold text-gray-800 mb-2">
                      Scores de validation
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(result.validation.scores).map(
                        ([key, value]) => (
                          <div
                            key={key}
                            className={`text-xs px-3 py-2 rounded ${
                              value
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {value ? "✓" : "✗"} {key}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Temps de traitement */}
                <div className="mt-4 text-xs text-gray-500">
                  Temps de traitement : {result.temps_traitement_ms}ms
                </div>
              </div>
            )}

            {/* Erreur */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start">
                  <span className="text-red-500 text-xl mr-3">⚠️</span>
                  <div>
                    <p className="font-semibold text-red-800">Erreur</p>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Colonne droite : Historique */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">📋 Historique</h2>
              <button
                onClick={chargerHistorique}
                disabled={loadingHistorique}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {loadingHistorique ? "..." : "🔄 Rafraîchir"}
              </button>
            </div>

            {loadingHistorique ? (
              <div className="text-center py-8 text-gray-500">
                Chargement...
              </div>
            ) : historique.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucune vérification dans l'historique
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {historique.map((verif) => (
                  <div
                    key={verif.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              verif.statut === StatutVerification.APPROUVE
                                ? "bg-green-100 text-green-800"
                                : verif.statut === StatutVerification.REJETE
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {verif.statut}
                          </span>
                          <span className="text-xs text-gray-600">
                            {verif.type_document}
                          </span>
                        </div>
                        {verif.nom_famille && (
                          <p className="text-sm font-medium text-gray-900">
                            {verif.nom_famille} {verif.prenoms}
                          </p>
                        )}
                        {verif.numero_document && (
                          <p className="text-xs text-gray-600 mt-1">
                            #{verif.numero_document}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(verif.cree_le).toLocaleString("fr-FR")}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(verif.id)}
                        className="text-red-500 hover:text-red-700 text-sm"
                        title="Supprimer"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Composant helper pour afficher les champs
function InfoField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <span className="text-gray-500">{label}:</span>{" "}
      <span className="font-medium text-gray-900">
        {value || <span className="text-gray-400">-</span>}
      </span>
    </div>
  );
}