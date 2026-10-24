/**
 * Mode hors-ligne — socle IndexedDB (S3).
 *
 * Trois magasins :
 *  - `comptes`     : comptes déjà connectés sur ce poste (session locale) ;
 *  - `file_colis`  : colis enregistrés sans réseau, en attente de synchronisation ;
 *  - `meta`        : divers (dernière synchro…).
 *
 * Aucune dépendance externe : l'API IndexedDB du navigateur suffit et reste
 * disponible quand le réseau tombe (contrairement à un appel HTTP).
 */

const NOM_BASE = "digiid_hors_ligne";
const VERSION_BASE = 1;

export type Magasin = "comptes" | "file_colis" | "meta";

let promesseBase: Promise<IDBDatabase> | null = null;

function ouvrirBase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB indisponible"));
  }
  if (promesseBase) return promesseBase;

  promesseBase = new Promise((resoudre, rejeter) => {
    const requete = indexedDB.open(NOM_BASE, VERSION_BASE);
    requete.onupgradeneeded = () => {
      const base = requete.result;
      if (!base.objectStoreNames.contains("comptes")) {
        base.createObjectStore("comptes", { keyPath: "cle" });
      }
      if (!base.objectStoreNames.contains("file_colis")) {
        const magasin = base.createObjectStore("file_colis", { keyPath: "id_local" });
        magasin.createIndex("statut", "statut", { unique: false });
      }
      if (!base.objectStoreNames.contains("meta")) {
        base.createObjectStore("meta", { keyPath: "cle" });
      }
    };
    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => rejeter(requete.error);
  });
  return promesseBase;
}

async function executer<T>(
  magasin: Magasin,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const base = await ouvrirBase();
  return new Promise<T>((resoudre, rejeter) => {
    const transaction = base.transaction(magasin, mode);
    const requete = action(transaction.objectStore(magasin));
    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => rejeter(requete.error);
  });
}

export async function ecrire<T>(magasin: Magasin, valeur: T): Promise<void> {
  await executer(magasin, "readwrite", (store) => store.put(valeur as unknown as never));
}

export async function lire<T>(magasin: Magasin, cle: string): Promise<T | null> {
  const resultat = await executer<T | undefined>(magasin, "readonly", (store) =>
    store.get(cle) as IDBRequest<T | undefined>,
  );
  return resultat ?? null;
}

export async function lister<T>(magasin: Magasin): Promise<T[]> {
  const resultat = await executer<T[]>(magasin, "readonly", (store) =>
    store.getAll() as IDBRequest<T[]>,
  );
  return resultat ?? [];
}

export async function supprimer(magasin: Magasin, cle: string): Promise<void> {
  await executer(magasin, "readwrite", (store) => store.delete(cle));
}

/** Vrai si l'API IndexedDB est utilisable (navigation privée, vieux Safari…). */
export function baseLocaleDisponible(): boolean {
  return typeof indexedDB !== "undefined";
}
