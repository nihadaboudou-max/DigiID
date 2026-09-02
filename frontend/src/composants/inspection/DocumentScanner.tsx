"use client";

import { useState } from "react";
import { TypeDocument, ReponseUploadDocument } from "@/types/inspection";
import { uploadDocument } from "@/services/inspectionApi";
import DocumentTypeSelector from "./DocumentTypeSelector";
import ImageCapture from "./ImageCapture";
import ExtractionResults from "./ExtractionResults";
import DocumentHistory from "./DocumentHistory";

export default function DocumentScanner() {
  const [selectedType, setSelectedType] = useState<TypeDocument | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [result, setResult] = useState<ReponseUploadDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"scan" | "history">("scan");

  const handleUpload = async () => {
    if (!selectedImage) {
      setError("Veuillez sélectionner une image");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await uploadDocument(
        selectedImage,
        selectedType || undefined,
        "recto"
      );
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'upload");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedType(null);
    setSelectedImage(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Inspection de Documents
        </h1>
        <p className="text-gray-600 mt-1">
          Scannez et vérifiez vos documents d'identité
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("scan")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "scan"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          Scanner
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "history"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          Historique
        </button>
      </div>

      {activeTab === "scan" ? (
        <div className="space-y-6">
          {/* Sélection du type */}
          <DocumentTypeSelector
            selectedType={selectedType}
            onSelect={setSelectedType}
          />

          {/* Capture d'image */}
          <ImageCapture
            selectedImage={selectedImage}
            onImageSelected={setSelectedImage}
          />

          {/* Boutons d'action */}
          <div className="flex gap-3">
            <button
              onClick={handleUpload}
              disabled={!selectedImage || loading}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Analyse en cours..." : "Analyser le document"}
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Réinitialiser
            </button>
          </div>

          {/* Résultats */}
          <ExtractionResults
            result={result}
            loading={loading}
            error={error}
          />
        </div>
      ) : (
        <DocumentHistory />
      )}
    </div>
  );
}