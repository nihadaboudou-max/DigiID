"use client";

import { TypeDocument } from "@/types/inspection";

interface DocumentTypeSelectorProps {
  selectedType: TypeDocument | null;
  onSelect: (type: TypeDocument) => void;
}

const DOCUMENT_TYPES = [
  { value: TypeDocument.CNI_BIOMETRIQUE, label: "CNI Biométrique", icon: "" },
  { value: TypeDocument.CNI_PAPIER, label: "CNI Papier", icon: "📄" },
  { value: TypeDocument.PASSEPORT, label: "Passeport", icon: "📘" },
  { value: TypeDocument.PERMIS_CONDUIRE, label: "Permis de Conduire", icon: "" },
  { value: TypeDocument.CARTE_ASSURANCE, label: "Carte d'Assurance", icon: "🛡️" },
  { value: TypeDocument.CARTE_SEJOUR, label: "Carte de Séjour", icon: "🏠" },
];

export default function DocumentTypeSelector({ selectedType, onSelect }: DocumentTypeSelectorProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">
        Type de document
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {DOCUMENT_TYPES.map((type) => (
          <button
            key={type.value}
            onClick={() => onSelect(type.value)}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedType === type.value
                ? "border-blue-500 bg-blue-50 shadow-md"
                : "border-gray-200 bg-white hover:border-blue-300"
            }`}
          >
            <div className="text-3xl mb-2">{type.icon}</div>
            <div className="text-sm font-medium text-gray-700">
              {type.label}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}