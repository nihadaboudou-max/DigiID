"use client";

import { useEffect, useState } from "react";
import {
  DetailVerification,
  StatutVerification,
  TypeDocument,
} from "@/types/inspection";
import { obtenirHistorique, supprimerVerification } from "@/services/inspectionApi";

export default function DocumentHistory() {
  const [verifications, setVerifications] = useState<DetailVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await obtenirHistorique(20);
      setVerifications(data.historique);
      setError(null);
    } catch (err) {
      setError("Impossible de charger l'historique");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette vérification ?")) return;
    try {
      await supprimerVerification(id);
      await loadHistory();
    } catch (err) {
      alert("Erreur lors de la suppression");
    }
  };

  const getStatutColor = (statut: StatutVerification) => {
    switch (statut) {
      case StatutVerification.APPROUVE:
        return "bg-green-100 text-green-800";
      case StatutVerification.REJETE:
        return "bg-red-100 text-red-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };

  const getTypeLabel = (type: TypeDocument) => {
    const labels: Record<TypeDocument, string> = {
      [TypeDocument.CNI_BIOMETRIQUE]: "CNI Biométrique",
      [TypeDocument.CNI_PAPIER]: "CNI Papier",
      [TypeDocument.PASSEPORT]: "Passeport",
      [TypeDocument.PERMIS_CONDUIRE]: "Permis",
      [TypeDocument.CARTE_ASSURANCE]: "Assurance",
      [TypeDocument.CARTE_SEJOUR]: "Carte de séjour",
      [TypeDocument.CARTE_VOTE]: "Carte de vote",
      [TypeDocument.CARTE_ETUDIANT]: "Carte étudiant",
      [TypeDocument.INCONNU]: "Inconnu",
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (verifications.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        Aucune vérification dans l'historique
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">
        Historique des vérifications
      </h3>
      <div className="space-y-3">
        {verifications.map((verif) => (
          <div
            key={verif.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-1 rounded ${getStatutColor(verif.statut)}`}>
                    {verif.statut}
                  </span>
                  <span className="text-sm text-gray-600">
                    {getTypeLabel(verif.type_document)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {verif.face}
                  </span>
                </div>
                <div className="text-sm text-gray-700">
                  {verif.nom_famille && verif.prenoms && (
                    <span className="font-medium">
                      {verif.nom_famille} {verif.prenoms}
                    </span>
                  )}
                  {verif.numero_document && (
                    <span className="text-gray-500 ml-2">
                      #{verif.numero_document}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(verif.cree_le).toLocaleString("fr-FR")}
                  {verif.taux_confiance_ocr > 0 && (
                    <span className="ml-2">
                      Confiance: {verif.taux_confiance_ocr.toFixed(1)}%
                    </span>
                  )}
                </div>
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
    </div>
  );
}