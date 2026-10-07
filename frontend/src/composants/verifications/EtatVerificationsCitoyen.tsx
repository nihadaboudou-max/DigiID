
/**
 * EtatVerificationsCitoyen — État des vérifications d'identité du citoyen.
 *
 * Affiche, dans l'ordre, les vérifications du compte (email, visage, 2FA) et
 * les documents d'identité fournis (CNI, permis, assurance), avec leur statut
 * (vérifié / à valider / expiré / non fourni). Chaque ligne mène à la page où
 * compléter la démarche.
 *
 * Utilisé sur la page profil (`variante="complet"`) et sur le tableau de bord
 * citoyen (`variante="compact"`).
 */
"use client";

import Link from "next/link";
import clsx from "clsx";
import { Badge, type BadgeVariante } from "@/composants/commun/Badge";
import {
  useEtatVerifications,
  type EtapeVerification,
  type EtatVerifications,
  type StatutEtapeVerification,
} from "@/crochets/useEtatVerifications";

const VARIANTES_STATUT: Record<StatutEtapeVerification, BadgeVariante> = {
  complete: "succes",
  en_cours: "info",
  attention: "ocre",
  a_faire: "neutre",
};

const COULEURS_NIVEAU: Record<string, string> = {
  aucune: "bg-ardoise-clair/30",
  partielle: "bg-ocre",
  renforcee: "bg-lagune/70",
  complete: "bg-green-500",
};

interface ProprietesEtatVerifications {
  /**
   * État déjà calculé par le parent (via `useEtatVerifications`). Si absent, le
   * composant charge lui-même les documents — utile pour un usage autonome.
   */
  etat?: EtatVerifications;
  /** `compact` : lignes resserrées (tableau de bord) ; `complet` : lignes détaillées (profil). */
  variante?: "compact" | "complet";
  /** Affiche la barre de progression et la synthèse « identité globale ». */
  afficherProgression?: boolean;
  className?: string;
}

export default function EtatVerificationsCitoyen({
  etat,
  variante = "compact",
  afficherProgression = false,
  className,
}: ProprietesEtatVerifications) {
  const etatInterne = useEtatVerifications(!etat);
  const {
    etapes,
    completees,
    total,
    pourcentage,
    niveau,
    identiteVerifiee,
    chargement,
  } = etat ?? etatInterne;

  if (chargement) {
    return (
      <p className={clsx("text-xs text-ardoise-clair italic py-2", className)}>
        Chargement des vérifications…
      </p>
    );
  }

  return (
    <div className={clsx("space-y-2", className)}>
      {afficherProgression && (
        <div className="pb-1">
          <div className="flex items-center justify-between text-xs text-ardoise-clair mb-1">
            <span>
              {completees} / {total} vérifications complètes
            </span>
            <span className="font-semibold text-ardoise">{pourcentage}%</span>
          </div>
          <div className="w-full bg-ardoise-clair/15 rounded-full h-2 overflow-hidden">
            <div
              className={clsx(
                "h-2 rounded-full transition-all duration-700",
                COULEURS_NIVEAU[niveau] ?? COULEURS_NIVEAU.aucune,
              )}
              style={{ width: `${pourcentage}%` }}
            />
          </div>
        </div>
      )}

      {etapes.map((etape) => (
        <LigneEtape key={etape.id} etape={etape} variante={variante} />
      ))}

      {afficherProgression && (
        <div className="flex items-center justify-between p-2 bg-lagune/10 rounded-lg border border-lagune/20">
          <span className="text-sm text-ardoise font-medium">🛡️ Identité globale</span>
          <Badge variante={identiteVerifiee ? "succes" : "terre"} taille="petit">
            {identiteVerifiee ? "Vérifiée" : "Non vérifiée"}
          </Badge>
        </div>
      )}
    </div>
  );
}

function LigneEtape({
  etape,
  variante,
}: {
  etape: EtapeVerification;
  variante: "compact" | "complet";
}) {
  return (
    <Link
      href={etape.lien}
      className={clsx(
        "flex items-center justify-between gap-2 transition-colors",
        variante === "compact"
          ? "py-1.5 hover:opacity-80"
          : "p-2 bg-sable rounded-lg hover:bg-sable-clair",
      )}
    >
      <span className="flex items-center gap-2 min-w-0 text-sm text-ardoise">
        <span aria-hidden>{etape.icone}</span>
        <span className="truncate">{etape.titre}</span>
        {variante === "complet" && etape.detail && (
          <span className="text-xs text-ardoise-clair truncate">· {etape.detail}</span>
        )}
        {variante === "complet" && etape.documents > 1 && (
          <span className="text-xs text-ardoise-clair">({etape.documents})</span>
        )}
      </span>
      <Badge variante={VARIANTES_STATUT[etape.statut]} taille="petit">
        {etape.libelle}
      </Badge>
    </Link>
  );
}
