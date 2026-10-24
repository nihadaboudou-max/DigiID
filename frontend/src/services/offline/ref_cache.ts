/**
 * Cache local du référentiel (gares, voyages, lignes) — S3.
 *
 * Sans cela, le mode hors-ligne était **inutilisable** : à l'ouverture du
 * formulaire de colis, gares et voyages étaient chargés depuis l'API ; réseau
 * coupé → listes vides → impossible de choisir un trajet, donc impossible
 * d'enregistrer quoi que ce soit.
 *
 * Ici : chaque liste est enregistrée dans IndexedDB à chaque chargement réussi,
 * et resservie telle quelle si l'API ne répond pas.
 */
import { ecrire, lire } from "./base_locale";

interface EntreeCache<T> {
  cle: string;
  valeur: T;
  horodatage: number;
}

/** Ancienneté maximale servie hors-ligne : au-delà, on rafraîchit (si réseau). */
const DUREE_VALIDITE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Charge une donnée via `chargeur`, la met en cache, et retombe sur le cache
 * local si l'appel échoue (réseau coupé).
 */
export async function chargerAvecCache<T>(
  cle: string,
  chargeur: () => Promise<T>,
): Promise<T> {
  const cleCache = `ref:${cle}`;
  try {
    const valeur = await chargeur();
    await ecrire("meta", {
      cle: cleCache,
      valeur,
      horodatage: Date.now(),
    } satisfies EntreeCache<T>);
    return valeur;
  } catch (erreur) {
    const cache = await lire<EntreeCache<T>>("meta", cleCache).catch(() => null);
    if (cache && Date.now() - cache.horodatage < DUREE_VALIDITE_MS) {
      return cache.valeur;
    }
    throw erreur;
  }
}

/** Vrai si la donnée est disponible en local (indicateur « hors-ligne »). */
export async function presenteEnCache(cle: string): Promise<boolean> {
  const cache = await lire<EntreeCache<unknown>>("meta", `ref:${cle}`).catch(
    () => null,
  );
  return cache !== null;
}
