"use client";
import React, { useEffect, useState } from "react";
import { useQRDynamique } from "@/crochets/useQRDynamique";

export default function AffichageQR() {
  const { qrCode, tempsRestant, chargement, erreur, rafraichir } = useQRDynamique();
  const [estHTTPS, setEstHTTPS] = useState<boolean | null>(null);

  // Détection HTTPS au montage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isSecure = window.location.protocol === "https:" || window.location.hostname === "localhost";
      setEstHTTPS(isSecure);
    }
  }, []);

  const timerUrgent = tempsRestant <= 10;
  const pourcentage = (tempsRestant / 30) * 100;

  return (
    <div className="space-y-6">
      {/* Alerte HTTPS */}
      {estHTTPS === false && (
        <div className="p-4 bg-ocre/10 border-l-4 border-ocre rounded-lg">
          <p className="text-sm font-semibold text-ocre mb-1">
            ⚠️ Mode non sécurisé détecté
          </p>
          <p className="text-xs text-ardoise-clair">
            La caméra nécessite HTTPS. En production, le site sera en HTTPS.
            Pour l'instant, utilisez la <strong>saisie manuelle du token</strong> côté policier.
          </p>
        </div>
      )}

      {/* Compte à rebours visuel */}
      <div className="bg-sable-clair rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-ardoise">⏱️ Temps restant</span>
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
            ? "⚠️ Le QR Code va se renouveler dans quelques secondes..."
            : "Le QR Code se renouvelle automatiquement toutes les 30 secondes."}
        </p>
      </div>

      {/* ✅ Message d'erreur clair */}
      {erreur && (
        <div className="p-4 bg-terre/10 border border-terre/30 rounded-lg text-terre text-sm">
          <p className="font-semibold mb-2">⚠️ Impossible de générer le QR Code</p>
          <p className="text-xs mb-3">{erreur}</p>
          <div className="text-xs space-y-1">
            <p className="font-semibold">Vérifie que :</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Le module <code className="bg-white px-1 rounded">qr_dynamique</code> existe dans le backend</li>
              <li>Redis est démarré (<code className="bg-white px-1 rounded">docker ps | grep redis</code>)</li>
              <li>Le routeur est ajouté dans <code className="bg-white px-1 rounded">routeur_principal.py</code></li>
              <li>Le backend a été redémarré après l'ajout du module</li>
            </ul>
          </div>
          <button
            onClick={rafraichir}
            className="mt-3 px-4 py-2 bg-lagune text-white rounded-lg hover:bg-lagune-fonce transition-colors text-sm font-medium"
          >
            🔄 Réessayer
          </button>
        </div>
      )}

      {/* QR Code */}
      <div className="bg-white rounded-xl border-2 border-ardoise-clair/20 p-6 flex flex-col items-center">
        {chargement && !qrCode ? (
          <div className="py-12 flex flex-col items-center gap-3">
            <div className="animate-spin h-10 w-10 border-4 border-lagune border-t-transparent rounded-full" />
            <p className="text-sm text-ardoise-clair">Génération du QR Code...</p>
          </div>
        ) : qrCode ? (
          <>
            {/* QR Code généré via API externe */}
            <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(
                  qrCode.qr_code_url
                )}`}
                alt="QR Code dynamique"
                className="w-64 h-64"
                onError={(e) => {
                  // Si l'API QR échoue, afficher le token en texte
                  e.currentTarget.style.display = 'none';
                  const fallback = document.getElementById('qr-fallback');
                  if (fallback) fallback.style.display = 'block';
                }}
              />
              {/* Fallback : afficher le token en texte */}
              <div id="qr-fallback" style={{ display: 'none' }} className="text-center">
                <p className="text-xs text-ardoise-clair mb-2">QR Code non disponible. Utilisez ce token :</p>
                <p className="text-lg font-mono font-bold text-lagune break-all">{qrCode.token}</p>
              </div>
            </div>

            {/* Token affiché */}
            <div className="w-full bg-sable-clair rounded-lg p-3 mb-4">
              <p className="text-xs text-ardoise-clair uppercase font-semibold mb-1">Token temporaire</p>
              <p className="text-xs font-mono text-ardoise break-all">{qrCode.token}</p>
            </div>

            {/* Bouton rafraîchir */}
            <button
              onClick={rafraichir}
              className="flex items-center gap-2 px-4 py-2 bg-lagune text-white rounded-lg hover:bg-lagune-fonce transition-colors text-sm font-medium"
            >
              🔄 Générer un nouveau code
            </button>
          </>
        ) : (
          <div className="py-12 text-center text-ardoise-clair">
            <p className="text-4xl mb-3">📱</p>
            <p className="text-sm">En attente de génération...</p>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-bleu-50 border border-bleu-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-bleu-800 mb-2">🔒 Comment ça marche ?</h4>
        <ul className="text-xs text-bleu-700 space-y-1.5">
          <li>✓ Ce QR Code est <strong>unique et temporaire</strong></li>
          <li>✓ Il se renouvelle <strong>automatiquement toutes les 30 secondes</strong></li>
          <li>✓ Il est <strong>invalidé après chaque utilisation</strong> par un agent</li>
          <li>✓ Une capture d'écran est <strong>inutile</strong> (code expiré)</li>
          <li>✓ Il change si vous <strong>quittez cette page</strong></li>
        </ul>
      </div>

      {/* Info sécurité HTTPS */}
      <div className="bg-sable-clair rounded-lg p-3 text-xs text-ardoise-clair">
        <p className="flex items-center gap-2">
          <span>{estHTTPS ? "🔒" : "⚠️"}</span>
          <span>
            {estHTTPS
              ? "Connexion sécurisée HTTPS active"
              : "Mode HTTP détecté — la caméra sera désactivée"}
          </span>
        </p>
      </div>
    </div>
  );
}