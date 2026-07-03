/**
 * Composant d'affichage du QR Code dynamique avec compte à rebours.
 */
"use client";
import React from "react";
import { useQRDynamique } from "@/crochets/useQRDynamique";

export default function AffichageQR() {
  const { qrCode, tempsRestant, chargement, erreur, rafraichir } = useQRDynamique();

  // Calcul de la couleur du timer (rouge si < 10s)
  const timerUrgent = tempsRestant <= 10;
  const pourcentage = (tempsRestant / 30) * 100;

  return (
    <div className="space-y-6">
      {/* Compte à rebours visuel */}
      <div className="bg-sable-clair rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-ardoise">
            ️ Temps restant
          </span>
          <span
            className={`text-2xl font-bold tabular-nums ${
              timerUrgent ? "text-terre animate-pulse" : "text-lagune"
            }`}
          >
            {tempsRestant}s
          </span>
        </div>
        <div className="w-full bg-ardoise-clair/20 rounded-full h-3 overflow-hidden">
          <div
            className={`h-3 rounded-full transition-all duration-1000 ease-linear ${
              timerUrgent ? "bg-terre" : "bg-lagune"
            }`}
            style={{ width: `${pourcentage}%` }}
          />
        </div>
        <p className="text-xs text-ardoise-clair mt-2">
          {timerUrgent
            ? "️ Le QR Code va se renouveler dans quelques secondes..."
            : "Le QR Code se renouvelle automatiquement toutes les 30 secondes."}
        </p>
      </div>

      {/* Message d'erreur */}
      {erreur && (
        <div className="p-4 bg-terre/10 border border-terre/30 rounded-lg text-terre text-sm">
          <p className="font-semibold mb-1">⚠️ Erreur</p>
          <p>{erreur}</p>
          <button
            onClick={rafraichir}
            className="mt-2 text-xs font-semibold underline hover:no-underline"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* QR Code */}
      <div className="bg-white rounded-xl border-2 border-ardoise-clair/20 p-6 flex flex-col items-center">
        {chargement || !qrCode ? (
          <div className="py-12 flex flex-col items-center gap-3">
            <div className="animate-spin h-10 w-10 border-4 border-lagune border-t-transparent rounded-full" />
            <p className="text-sm text-ardoise-clair">Génération du QR Code...</p>
          </div>
        ) : (
          <>
            {/* Affichage du QR Code (utiliser une lib comme qrcode.react ou une image API) */}
            <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(
                  qrCode.qr_code_url
                )}`}
                alt="QR Code dynamique"
                className="w-64 h-64"
              />
            </div>

            {/* Token affiché (pour debug ou copier-coller) */}
            <div className="w-full bg-sable-clair rounded-lg p-3 mb-4">
              <p className="text-xs text-ardoise-clair uppercase font-semibold mb-1">
                Token temporaire
              </p>
              <p className="text-xs font-mono text-ardoise break-all">
                {qrCode.token}
              </p>
            </div>

            {/* Bouton rafraîchir manuel */}
            <button
              onClick={rafraichir}
              className="flex items-center gap-2 px-4 py-2 bg-lagune text-white rounded-lg hover:bg-lagune-fonce transition-colors text-sm font-medium"
            >
              🔄 Générer un nouveau code
            </button>
          </>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-bleu-50 border border-bleu-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-bleu-800 mb-2">
          🔒 Comment ça marche ?
        </h4>
        <ul className="text-xs text-bleu-700 space-y-1.5">
          <li>✓ Ce QR Code est <strong>unique et temporaire</strong></li>
          <li>✓ Il se renouvelle <strong>automatiquement toutes les 30 secondes</strong></li>
          <li>✓ Il est <strong>invalidé après chaque utilisation</strong> par un agent</li>
          <li>✓ Une capture d'écran est <strong>inutile</strong> (code expiré)</li>
          <li>✓ Il change si vous <strong>quittez cette page</strong></li>
        </ul>
      </div>
    </div>
  );
}