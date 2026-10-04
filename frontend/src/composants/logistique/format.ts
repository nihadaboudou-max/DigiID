/**
 * Utilitaires de formatage pour le guichet logistique (S3).
 */

/** Formate un montant en francs CFA (ex : `1 500 FCFA`). */
export function formaterFcfa(montant: number | null | undefined): string {
  if (montant === null || montant === undefined) return "—";
  return `${new Intl.NumberFormat("fr-FR").format(montant)} FCFA`;
}

/** Formate une date ISO en `jj/mm/aaaa`. */
export function formaterDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(date);
}

/** Formate une date ISO en `jj/mm/aaaa hh:mm`. */
export function formaterDateHeure(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

/**
 * Construit l'URL d'une image QR (API publique) à partir du contenu du QR.
 * Retourne `null` si aucun contenu (l'appelant affiche alors le code clair).
 */
export function urlImageQR(contenuQR: string | null | undefined): string | null {
  if (!contenuQR) return null;
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(
    contenuQR,
  )}`;
}

/**
 * Détermine si une saisie/scan correspond à un `token` QR ou à un `code_clair`.
 *
 * Tolérance terrain : l'agent peut scanner l'URL encodée dans le QR
 * (`…/logistique/scan?token=…`), coller le token brut (48 hex), ou taper le
 * numéro imprimé sur le ticket (`DKR-2025-000001`).
 */
export function analyserEntreeScan(texte: string): {
  token?: string;
  code_clair?: string;
} {
  const valeur = texte.trim();
  if (!valeur) return {};

  // 1. URL complète (scan à la caméra native)
  if (/^https?:\/\//i.test(valeur)) {
    const extrait = extraireParametre(valeur, "token");
    return extrait ? { token: extrait } : {};
  }

  // 2. Fragment d'URL « token=… »
  if (valeur.toLowerCase().includes("token=")) {
    const extrait = extraireParametre(valeur, "token");
    if (extrait) return { token: extrait };
  }

  // 3. Token opaque (hexadécimal long)
  if (/^[0-9a-f]{40,}$/i.test(valeur)) {
    return { token: valeur };
  }

  // 4. Sinon : numéro en clair imprimé sur le ticket
  return { code_clair: valeur.toUpperCase() };
}

/** Extrait (au mieux) la valeur d'un paramètre d'une URL. */
function extraireParametre(url: string, cle: string): string | null {
  const correspondance = url.match(new RegExp(`[?&]${cle}=([^&#]+)`));
  if (!correspondance) return null;
  try {
    return decodeURIComponent(correspondance[1]);
  } catch {
    return correspondance[1];
  }
}
