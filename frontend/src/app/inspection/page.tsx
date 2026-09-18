"use client";

import { useState, useEffect } from "react";
import type { ChangeEvent } from "react";
import {
  TypeDocument,
  FaceDocument,
  StatutVerification,
  DetailVerification,
  ReponseDocumentUnifie,
} from "@/types/inspection";
import {
  uploadDocument,
  obtenirHistorique,
  supprimerVerification,
} from "@/services/inspectionApi";

// ── Libellés / styles partagés ─────────────────────────────────────────────
const LIBELLES_TYPE_DOCUMENT: Record<TypeDocument, string> = {
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

const LIBELLES_FACE: Record<FaceDocument, string> = {
  [FaceDocument.RECTO]: "Recto",
  [FaceDocument.VERSO]: "Verso",
  [FaceDocument.UNIQUE]: "Unique",
};

const LIBELLES_STATUT: Record<StatutVerification, string> = {
  [StatutVerification.EN_ATTENTE]: "En attente",
  [StatutVerification.APPROUVE]: "Approuvé",
  [StatutVerification.REJETE]: "Rejeté",
  [StatutVerification.PARTIEL]: "Partiel",
  [StatutVerification.EXPIRE]: "Expiré",
};
const CLASSES_STATUT: Record<StatutVerification, string> = {
  [StatutVerification.EN_ATTENTE]: "bg-yellow-100 text-yellow-800",
  [StatutVerification.APPROUVE]: "bg-green-100 text-green-800",
  [StatutVerification.REJETE]: "bg-red-100 text-red-800",
  [StatutVerification.PARTIEL]: "bg-orange-100 text-orange-800",
  [StatutVerification.EXPIRE]: "bg-amber-100 text-amber-800",
};

const OPTIONS_TYPE_DOCUMENT: { valeur: TypeDocument; libelle: string }[] = [
  { valeur: TypeDocument.CNI_BIOMETRIQUE, libelle: "CNI Biométrique" },
  { valeur: TypeDocument.CNI_PAPIER, libelle: "CNI Papier" },
  { valeur: TypeDocument.PASSEPORT, libelle: "Passeport" },
  { valeur: TypeDocument.PERMIS_CONDUIRE, libelle: "Permis de conduire" },
  { valeur: TypeDocument.CARTE_ASSURANCE, libelle: "Carte d'assurance" },
  { valeur: TypeDocument.CARTE_SEJOUR, libelle: "Carte de séjour" },
  { valeur: TypeDocument.CARTE_GRISE, libelle: "Carte grise" },
  { valeur: TypeDocument.CARTE_CONSULAIRE, libelle: "Carte consulaire" },
  { valeur: TypeDocument.CARTE_VOTE, libelle: "Carte de vote" },
  { valeur: TypeDocument.CARTE_ETUDIANT, libelle: "Carte étudiant" },
];

export default function TestInspectionPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [typeDocument, setTypeDocument] = useState<TypeDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReponseDocumentUnifie | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historique, setHistorique] = useState<DetailVerification[]>([]);
  const [loadingHistorique, setLoadingHistorique] = useState(false);

  // Charger l'historique au démarrage
  useEffect(() => {
    chargerHistorique();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setResult(null);
    setError(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
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
              <h2 className="text-xl font-semibold mb-4">📷 Upload d'image</h2>

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
                      alt="Aperçu du document"
                      className="max-h-64 rounded-lg border border-gray-200"
                    />
                  </div>
                )}

                {/* Sélection du type de document */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type de document (optionnel - auto-détecté si non
                    sélectionné)
                  </label>
                  <select
                    value={typeDocument || ""}
                    onChange={(e) =>
                      setTypeDocument(
                        e.target.value
                          ? (e.target.value as TypeDocument)
                          : null
                      )
                    }
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Auto-détection</option>
                    {OPTIONS_TYPE_DOCUMENT.map((option) => (
                      <option key={option.valeur} value={option.valeur}>
                        {option.libelle}
                      </option>
                    ))}
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
            {result && <ResultatsAnalyse resultat={result} />}

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
              <div className="text-center py-8 text-gray-500">Chargement...</div>
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
                              CLASSES_STATUT[verif.statut] ??
                              "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {LIBELLES_STATUT[verif.statut] ?? verif.statut}
                          </span>
                          <span className="text-xs text-gray-600">
                            {LIBELLES_TYPE_DOCUMENT[verif.type_document] ??
                              verif.type_document}
                          </span>
                          <span className="text-xs text-gray-400">
                            {LIBELLES_FACE[verif.face] ?? verif.face}
                          </span>
                        </div>
                        {verif.nom_famille && (
                          <p className="text-sm font-medium text-gray-900">
                            {verif.nom_famille}{" "}
                            {verif.prenoms ? verif.prenoms : ""}
                          </p>
                        )}
                        {verif.numero_document && (
                          <p className="text-xs text-gray-600 mt-1">
                            #{verif.numero_document}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(verif.cree_le).toLocaleString("fr-FR")}
                          {verif.taux_confiance_ocr > 0 && (
                            <span className="ml-2">
                              Confiance :{" "}
                              {verif.taux_confiance_ocr.toFixed(1)}%
                            </span>
                          )}
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

// ── Bloc résultats ──────────────────────────────────────────────────────────
interface ResultatsAnalyseProps {
  resultat: ReponseDocumentUnifie;
}

const LIBELLES_STATUT_UNIFIE: Record<string, string> = {
  approuve: "Document validé",
  rejete: "Document rejeté",
  expiree: "Document expiré",
  en_attente: "En attente de vérification",
};

function ResultatsAnalyse({ resultat }: ResultatsAnalyseProps) {
  const { donnees, statut, message, temps_ms, champs_extraits } = resultat;
  const estOk = statut === "approuve";
  const estExpire = statut === "expiree";

  const classesBandeau = estOk
    ? "bg-green-50 border-green-200"
    : estExpire
    ? "bg-orange-50 border-orange-200"
    : "bg-red-50 border-red-200";
  const iconeBandeau = estOk ? "✅" : estExpire ? "⏳" : "❌";

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">✅ Résultats de l'analyse</h2>

      {/* Statut */}
      <div className={`p-4 rounded-lg border mb-4 ${classesBandeau}`}>
        <div className="flex items-center">
          <span className="text-2xl mr-3">{iconeBandeau}</span>
          <div>
            <p className="font-semibold">
              {LIBELLES_STATUT_UNIFIE[statut] ?? statut}
            </p>
            <p className="text-sm text-gray-600 mt-1">{message}</p>
          </div>
        </div>
      </div>

      {/* Informations générales */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 mb-4">
        <span className="font-medium text-gray-800">
          {LIBELLES_TYPE_DOCUMENT[resultat.type_document] ?? resultat.type_document}
        </span>
        <span className="text-xs text-gray-400">
          {champs_extraits} champ(s) • {temps_ms} ms
        </span>
      </div>

      {/* Données extraites (rendu générique quel que soit le document) */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-800">Données extraites</h3>
        {Object.keys(donnees).length === 0 ? (
          <p className="text-sm text-gray-500">Aucune donnée extraite.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 text-sm">
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
      {resultat.texte_brut && (
        <details className="mt-4 bg-gray-50 rounded-lg p-3">
          <summary className="text-sm font-medium text-gray-700 cursor-pointer">
            Texte brut OCR
          </summary>
          <pre className="mt-2 text-xs font-mono text-gray-600 whitespace-pre-wrap break-all">
            {resultat.texte_brut}
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
