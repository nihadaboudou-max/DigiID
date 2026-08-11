"use client";

/**
 * Composants partagés du module Police — affichage de l'état d'expiration
 * des pièces d'identité (CNI, permis, assurance).
 */

/** Libellé lisible d'un type de document. */
export function labelDocument(type: string | undefined | null): string {
  switch (type) {
    case "cni":
      return "Carte Nationale d'Identité";
    case "permis":
      return "Permis de conduire";
    case "assurance":
      return "Assurance";
    default:
      return type || "Document";
  }
}

/** Formate une date d'expiration (ISO) en texte lisible en français. */
export function formaterDateExpiration(iso: string | null | undefined): string {
  if (!iso) return "Sans expiration";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Date inconnue";
  return `Expire le ${d.toLocaleDateString("fr-FR")}`;
}

/**
 * Badge coloré indiquant l'état d'expiration d'une pièce :
 * - rouge  → pièce EXPIRÉE
 * - orange → pièce qui expire bientôt (≤ 30 jours)
 * - vert   → pièce valide
 */
export default function BadgeExpiration({
  est_expire,
  expire_bientot,
  est_valide,
  jours_restants,
}: {
  est_expire?: boolean;
  expire_bientot?: boolean;
  est_valide?: boolean;
  jours_restants?: number | null;
}) {
  if (est_expire) {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-terre/15 text-terre whitespace-nowrap">
        ✗ EXPIRÉ
      </span>
    );
  }
  if (expire_bientot) {
    const jours = jours_restants != null ? ` (${jours_restants} j)` : "";
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-ocre/15 text-ocre whitespace-nowrap">
        ⚠ EXP. BIENTÔT{jours}
      </span>
    );
  }
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-vert/15 text-vert whitespace-nowrap">
      ✓ VALIDE
    </span>
  );
}
