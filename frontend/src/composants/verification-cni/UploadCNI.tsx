/**
 * Composant d'upload de photo de Carte Nationale d'Identité.
 *
 * Permet à l'utilisateur de :
 * - Choisir entre recto et verso
 * - Prendre une photo ou sélectionner un fichier
 * - Prévisualiser l'image avant envoi
 * - Lancer l'analyse OCR
 */
"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  ReponseUploadCNI,
  uploaderCNI,
} from "@/services/verification_cni";

interface UploadCNIProps {
  face: "recto" | "verso";
  label: string;
  description: string;
  onSucces: (resultat: ReponseUploadCNI) => void;
  onErreur: (erreur: string) => void;
  desactive?: boolean;
}

export default function UploadCNI({
  face,
  label,
  description,
  onSucces,
  onErreur,
  desactive = false,
}: UploadCNIProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fichier, setFichier] = useState<File | null>(null);
  const [previsualisation, setPrevisualisation] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [glisser, setGlisser] = useState(false);

  /**
   * Gère la sélection d'un fichier.
   */
  const gererFichier = useCallback((fichierSelectionne: File | null) => {
    if (!fichierSelectionne) return;

    // Valider le type
    const typesAutorises = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/tiff",
    ];
    if (!typesAutorises.includes(fichierSelectionne.type)) {
      onErreur(
        "Format d'image non supporté. Utilise JPG, PNG, WEBP ou TIFF."
      );
      return;
    }

    // Valider la taille (max 15 Mo)
    if (fichierSelectionne.size > 15 * 1024 * 1024) {
      onErreur("L'image dépasse la taille maximale de 15 Mo.");
      return;
    }

    setFichier(fichierSelectionne);

    // Créer la prévisualisation
    const lecteur = new FileReader();
    lecteur.onload = (e) => {
      setPrevisualisation(e.target?.result as string);
    };
    lecteur.readAsDataURL(fichierSelectionne);
  }, [onErreur]);

  /**
   * Gère le drop de fichier.
   */
  const gererDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setGlisser(false);
      const fichierDrop = e.dataTransfer.files[0];
      gererFichier(fichierDrop);
    },
    [gererFichier]
  );

  /**
   * Gère le clic sur le bouton de sélection.
   */
  const gererClickSelection = () => {
    inputRef.current?.click();
  };

  /**
   * Gère le changement dans l'input file.
   */
  const gererChangementInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichierInput = e.target.files?.[0] || null;
    gererFichier(fichierInput);
  };

  /**
   * Lance l'analyse OCR.
   */
  const lancerAnalyse = async () => {
    if (!fichier) {
      onErreur("Sélectionne d'abord une image.");
      return;
    }

    setChargement(true);
    try {
      const resultat = await uploaderCNI(fichier, face);
      onSucces(resultat);
    } catch (erreur: unknown) {
      const message =
        erreur instanceof Error
          ? erreur.message
          : "Erreur lors de l'analyse OCR.";
      onErreur(message);
    } finally {
      setChargement(false);
    }
  };

  /**
   * Réinitialise le champ.
   */
  const reinitialiser = () => {
    setFichier(null);
    setPrevisualisation(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div
      className={`
        border-2 border-dashed rounded-xl p-6 transition-all duration-200
        ${glisser ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white"}
        ${desactive ? "opacity-50 cursor-not-allowed" : "hover:border-blue-400"}
      `}
      onDragOver={(e) => {
        e.preventDefault();
        setGlisser(true);
      }}
      onDragLeave={() => setGlisser(false)}
      onDrop={gererDrop}
    >
      {/* En-tête */}
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">{label}</h3>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>

      {/* Zone de drop / prévisualisation */}
      {previsualisation ? (
        <div className="relative mb-4">
          <img
            src={previsualisation}
            alt={`Aperçu ${face}`}
            className="w-full max-h-64 object-contain rounded-lg border border-gray-200"
          />
          <button
            onClick={reinitialiser}
            className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 transition-colors"
            title="Changer l'image"
            type="button"
          >
            ✕
          </button>
        </div>
      ) : (
        <div
          onClick={gererClickSelection}
          className="flex flex-col items-center justify-center py-12 cursor-pointer"
        >
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-gray-600 font-medium">
            Clique ou glisse une photo ici
          </p>
          <p className="text-gray-400 text-sm mt-1">
            JPG, PNG, WEBP ou TIFF (max 15 Mo)
          </p>
        </div>
      )}

      {/* Input file caché */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/tiff"
        onChange={gererChangementInput}
        className="hidden"
      />

      {/* Infos fichier */}
      {fichier && (
        <div className="text-xs text-gray-500 text-center mb-4">
          {fichier.name} — {(fichier.size / 1024 / 1024).toFixed(1)} Mo
        </div>
      )}

      {/* Bouton d'analyse */}
      <button
        onClick={lancerAnalyse}
        disabled={!fichier || chargement || desactive}
        className={`
          w-full py-3 px-4 rounded-lg font-medium transition-all duration-200
          flex items-center justify-center gap-2
          ${
            !fichier || chargement || desactive
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]"
          }
        `}
        type="button"
      >
        {chargement ? (
          <>
            <svg
              className="animate-spin h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Analyse en cours...
          </>
        ) : (
          <>
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Lancer l&apos;analyse OCR
          </>
        )}
      </button>
    </div>
  );
}
