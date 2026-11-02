import { ecrire, lire, lister, supprimer } from "./base_locale";

interface EntreeCacheAPI<T> {
  cle: string;
  valeur: T;
  horodatage: number;
}

const PREFIXE = "api:";
const DUREE_MAXIMALE_MS = 7 * 24 * 60 * 60 * 1000;

function cleCache(chemin: string): string {
  return `${PREFIXE}${chemin}`;
}

export async function memoriserReponseAPI<T>(
  chemin: string,
  valeur: T,
): Promise<void> {
  await ecrire("api_cache", {
    cle: cleCache(chemin),
    valeur,
    horodatage: Date.now(),
  } satisfies EntreeCacheAPI<T>);
}

export async function lireReponseAPI<T>(chemin: string): Promise<T | null> {
  const entree = await lire<EntreeCacheAPI<T>>("api_cache", cleCache(chemin));
  if (!entree) return null;
  if (Date.now() - entree.horodatage > DUREE_MAXIMALE_MS) {
    await supprimer("api_cache", entree.cle);
    return null;
  }
  return entree.valeur;
}

export async function effacerCacheAPI(): Promise<void> {
  const entrees = await lister<EntreeCacheAPI<unknown>>("api_cache");
  await Promise.all(
    entrees
      .filter((entree) => entree.cle.startsWith(PREFIXE))
      .map((entree) => supprimer("api_cache", entree.cle)),
  );
}
