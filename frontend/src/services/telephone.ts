/**
 * Validation des numéros de téléphone — miroir exact du backend
 * (`src/noyau/telephone.py`).
 *
 * Un numéro saisi au guichet ne doit jamais être « n'importe quoi » : sans
 * cette validation, `1234` ou `abc` étaient acceptés, le colis devenait
 * introuvable par téléphone et les SMS partaient dans le vide.
 *
 * Formes acceptées → toujours rendues sous la forme canonique `+2290197123456` :
 *   `+229 01 97 12 34 56` · `002290197123456` · `0197123456` · `97 12 34 56`
 * Un numéro étranger explicite (`+226 70 12 34 56`) est conservé tel quel.
 */

export const INDICATIF_BENIN = "+229";

/** Retire les séparateurs usuels (espaces, points, tirets, parenthèses). */
function nettoyer(valeur: string): string {
  return (valeur ?? "").replace(/[\s.\-()/]/g, "").trim();
}

/**
 * Normalise un numéro. Retourne `null` si la saisie n'est pas un numéro
 * plausible (béninois ou international explicite).
 */
export function normaliserTelephone(valeur: string | null | undefined): string | null {
  if (!valeur) return null;
  let brut = nettoyer(valeur);
  if (!brut) return null;

  // 00229… → +229…
  if (brut.startsWith("00")) brut = `+${brut.slice(2)}`;

  const avecIndicatif = brut.startsWith("+");
  const chiffres = brut.replace(/^\+/, "");

  // Numéro béninois ?
  const indicatifBenin = chiffres.startsWith("229");
  const sansIndicatif = indicatifBenin ? chiffres.slice(3) : chiffres;
  // L'ancien plan à 8 chiffres n'est complété en « 01… » que pour une saisie
  // locale **sans** indicatif : `+229 01 97 12 34` (tronqué) doit être refusé,
  // pas « réparé » en un numéro faux.
  const local =
    !avecIndicatif && sansIndicatif.length === 8
      ? `01${sansIndicatif}`
      : sansIndicatif;

  if (/^0[1-9]\d{8}$/.test(local)) {
    return `${INDICATIF_BENIN}${local}`;
  }

  // Numéro étranger explicite : +<8 à 15 chiffres> (E.164). Un préfixe +229
  // mal formé n'est jamais « sauvé » par cette branche.
  if (avecIndicatif && !indicatifBenin && /^[1-9]\d{7,14}$/.test(chiffres)) {
    return `+${chiffres}`;
  }

  return null;
}

/** Vrai si la saisie est un numéro exploitable (SMS/appel). */
export function telephoneValide(valeur: string | null | undefined): boolean {
  return normaliserTelephone(valeur) !== null;
}

/** Affichage lisible dans une confirmation : `+229 01 97 12 34 56`. */
export function formaterTelephone(normalise: string | null | undefined): string {
  if (!normalise) return "";
  const benin = normaliserTelephone(normalise);
  if (benin && benin.startsWith(INDICATIF_BENIN)) {
    const chiffres = benin.slice(INDICATIF_BENIN.length);
    return `${INDICATIF_BENIN} ${chiffres.slice(0, 2)} ${chiffres.slice(2, 4)} ${chiffres.slice(4, 6)} ${chiffres.slice(6, 8)} ${chiffres.slice(8, 10)}`;
  }
  return benin ?? normalise;
}

/** Message d'erreur unique, réutilisé par tous les formulaires. */
export const MESSAGE_TELEPHONE_INVALIDE =
  "Numéro invalide. Format attendu : +229 01 XX XX XX XX.";
