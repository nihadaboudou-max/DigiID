"use client";

/**
 * StatutVerification — affiche le statut actuel de la vérification visuelle.
 */
import type { VerificationDetail } from "@/services/verification_visuelle";

type Props = {
  verification: VerificationDetail | null;
  chargement: boolean;
};

const COULEURS_STATUT: Record<string, string> = {
  en_attente: "text-ocre bg-ocre/10 border-ocre/30",
  approuve: "text-green-700 bg-green-100 border-green-300",
  rejete: "text-rouge bg-rouge/10 border-rouge/30",
};

const LABELS_STATUT: Record<string, string> = {
  en_attente: "En attente",
  approuve: "✅ Approuvée",
  rejete: "❌ Rejetée",
};

const ICONES_STATUT: Record<string, string> = {
  en_attente: "⏳",
  approuve: "✅",
  rejete: "❌",
};

export default function StatutVerification({ verification, chargement }: Props) {
  if (chargement) {
    return (
      <div className="border border-ardoise-clair/20 rounded-xl p-6 text-center">
        <p className="text-ardoise-clair italic">Chargement du statut...</p>
      </div>
    );
  }

  if (!verification) {
    return (
      <div className="border border-dashed border-ardoise-clair/30 rounded-xl p-6 text-center">
        <p className="text-3xl mb-2">📸</p>
        <p className="text-ardoise-clair">
          Tu n&apos;as pas encore fait de vérification visuelle.
        </p>
        <p className="text-sm text-ardoise-clair/60 mt-1">
          Prends ou upload une photo de ton visage pour commencer.
        </p>
      </div>
    );
  }

  if (verification.est_supprime) {
    return (
      <div className="border border-ardoise-clair/20 rounded-xl p-6 text-center opacity-60">
        <p className="text-3xl mb-2">🗑️</p>
        <p className="text-ardoise-clair">
          Cette vérification est dans la corbeille.
        </p>
        {verification.date_suppression && (
          <p className="text-xs text-ardoise-clair/60 mt-1">
            Supprimée le {new Date(verification.date_suppression).toLocaleDateString("fr-FR")}
          </p>
        )}
      </div>
    );
  }

  const classeStatut = COULEURS_STATUT[verification.statut] || "text-ardoise bg-sable-clair/50";
  const labelStatut = LABELS_STATUT[verification.statut] || verification.statut;
  const iconeStatut = ICONES_STATUT[verification.statut] || "❓";

  return (
    <div className={`border rounded-xl p-5 ${classeStatut}`}>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{iconeStatut}</span>
        <div>
          <p className="font-semibold">{labelStatut}</p>
          <p className="text-sm opacity-75">{verification.raison || "Aucune information."}</p>
        </div>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
        <div>
          <p className="text-ardoise-clair uppercase text-xs tracking-wide">Score liveness</p>
          <p className="font-mono font-bold">
            {(verification.score_liveness * 100).toFixed(1)}%
          </p>
        </div>
        {verification.score_similarite !== null && verification.score_similarite !== undefined && (
          <div>
            <p className="text-ardoise-clair uppercase text-xs tracking-wide">Similarité</p>
            <p className="font-mono font-bold">
              {(verification.score_similarite * 100).toFixed(1)}%
            </p>
          </div>
        )}
      </div>

      {/* Date */}
      <p className="text-xs text-ardoise-clair/60 mt-4">
        Uploadé le {new Date(verification.date_upload).toLocaleString("fr-FR")}
      </p>
    </div>
  );
}
