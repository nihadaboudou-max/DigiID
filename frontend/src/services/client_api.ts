/**
 * Client HTTP centralisé pour tous les appels à l'API DigiID.
 *
 * Avantages d'un wrapper unique :
 *  - Gestion uniforme du token JWT
 *  - Rafraîchissement automatique du token expiré (401)
 *  - Gestion uniforme des erreurs (format ReponseErreurAPI)
 *  - Logs centralisés
 *  - Facile à remplacer par axios/ky si besoin
 */
import Cookies from "js-cookie";

import type { Jetons, ReponseErreurAPI } from "@/types/api";

// URL du backend interne utilisé par le proxy Next.js.
// Toujours utiliser /api/backend pour éviter les problèmes CORS et les appels mixtes http/https.
const URL_BASE = "/api/backend";

// Nom du cookie où on stocke le token d'accès
const NOM_COOKIE_TOKEN = "digiid_token";
const NOM_COOKIE_REFRESH = "digiid_refresh";

const CHEMIN_RAFRAICHIR = "/api/v1/auth/rafraichir";

/** Codes d'erreur pour lesquels on ne tente pas de rafraîchir le token. */
const CODES_SANS_RAFRAICHISSEMENT = new Set([
  "AUTH_001",
  "AUTH_004",
  "AUTH_005",
  "AUTH_008",
]);

/**
 * Événement personnalisé déclenché quand l'authentification expire
 * de façon irrécupérable (token invalide, rôle modifié, etc.).
 * Le contexte d'authentification écoute cet événement pour
 * déconnecter l'utilisateur proprement.
 */
export const EVENEMENT_AUTH_EXPIRE = "digiid:auth-expired";

export function declencherEvenementAuthExpire() {
  if (typeof window !== "undefined") {
    effacerJetons();
    window.dispatchEvent(new CustomEvent(EVENEMENT_AUTH_EXPIRE));
  }
}

// -----------------------------------------------------------------------------
// Gestion du token
// -----------------------------------------------------------------------------

export function stockerJetons(tokenAcces: string, tokenRafraichissement: string) {
  // Cookies sécurisés en httponly serait mieux, mais nécessite un middleware
  // Next.js. Pour le prototype, on utilise js-cookie côté navigateur.
  // ⚠️ path: "/" est OBLIGATOIRE — sans ça, le cookie n'est accessible que
  // En HTTP, secure doit être false sinon les cookies ne sont pas envoyés
  
  const estHTTPS = typeof window !== 'undefined' && window.location.protocol === 'https:';
  
  Cookies.set(NOM_COOKIE_TOKEN, tokenAcces, {
    path: "/",
    secure: estHTTPS,  // ← true seulement si HTTPS
    sameSite: "strict",
    expires: 1 / 96, // 15 minutes
  });
  Cookies.set(NOM_COOKIE_REFRESH, tokenRafraichissement, {
    path: "/",
    secure: estHTTPS,  // ← true seulement si HTTPS
    sameSite: "strict",
    expires: 7, // 7 jours
  });
}

export function obtenirTokenAcces(): string | undefined {
  return Cookies.get(NOM_COOKIE_TOKEN);
}

export function obtenirTokenRafraichissement(): string | undefined {
  return Cookies.get(NOM_COOKIE_REFRESH);
}

export function effacerJetons() {
  Cookies.remove(NOM_COOKIE_TOKEN, { path: "/" });
  Cookies.remove(NOM_COOKIE_REFRESH, { path: "/" });
}

// -----------------------------------------------------------------------------
// Rafraîchissement automatique (mutex pour requêtes parallèles)
// -----------------------------------------------------------------------------

let promesseRafraichissement: Promise<boolean> | null = null;

async function executerRafraichissement(): Promise<boolean> {
  const refresh = obtenirTokenRafraichissement();
  if (!refresh) {
    effacerJetons();
    return false;
  }

  const url = `${URL_BASE}${CHEMIN_RAFRAICHIR}`;
  try {
    const reponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
      credentials: "include",
    });

    if (!reponse.ok) {
      effacerJetons();
      return false;
    }

    const jetons = (await reponse.json()) as Jetons;
    stockerJetons(jetons.token_acces, jetons.token_rafraichissement);
    return true;
  } catch {
    effacerJetons();
    return false;
  }
}

function tenterRafraichissement(): Promise<boolean> {
  if (!promesseRafraichissement) {
    promesseRafraichissement = executerRafraichissement().finally(() => {
      promesseRafraichissement = null;
    });
  }
  return promesseRafraichissement;
}

// -----------------------------------------------------------------------------
// Erreurs typées
// -----------------------------------------------------------------------------

export class ErreurAPI extends Error {
  constructor(
    public code_erreur: string,
    public message_utilisateur: string,
    public code_http: number,
    public request_id?: string,
  ) {
    super(message_utilisateur);
    this.name = "ErreurAPI";
  }
}

// -----------------------------------------------------------------------------
// Fonction principale — fait une requête à l'API
// -----------------------------------------------------------------------------

interface OptionsRequete extends RequestInit {
  authentifie?: boolean;
  /** Interne — évite une boucle infinie lors du retry après refresh. */
  _retry?: boolean;
}

async function appel_api<T>(
  chemin: string,
  options: OptionsRequete = {},
): Promise<T> {
  const { authentifie = false, headers = {}, _retry = false, ...reste } = options;

  // Construction des en-têtes
  const enTetes: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string>),
  };

  if (authentifie) {
    const token = obtenirTokenAcces();
    if (token) {
      enTetes["Authorization"] = `Bearer ${token}`;
    }
  }

  // URL complète
  const url = `${URL_BASE}${chemin}`;

  // Appel fetch
  let reponse: Response;
  try {
    reponse = await fetch(url, {
      ...reste,
      headers: enTetes,
      credentials: "include",
    });
  } catch (erreur) {
    // Erreur réseau : le serveur n'a pas répondu du tout.
    console.error("Échec d'appel API vers :", url, erreur);
    throw new ErreurAPI(
      "RESEAU",
      `Le backend ne répond pas à ${URL_BASE}. ` +
      `Vérifie que Docker tourne (« docker compose ps backend » doit montrer Up) ` +
      `et que .env.local contient NEXT_PUBLIC_URL_BACKEND=http://127.0.0.1:8000.`,
      0,
    );
  }

  // Réponse 204 No Content : pas de body à parser
  if (reponse.status === 204) {
    return undefined as T;
  }

  // Parser le JSON
  let donnees: unknown;
  try {
    donnees = await reponse.json();
  } catch {
    throw new ErreurAPI(
      "REPONSE_INVALIDE",
      "Le serveur a renvoyé une réponse invalide.",
      reponse.status,
    );
  }

  // Token expiré → rafraîchir une fois puis réessayer
  if (
    !reponse.ok &&
    authentifie &&
    !_retry &&
    reponse.status === 401 &&
    chemin !== CHEMIN_RAFRAICHIR
  ) {
    const erreurApi = donnees as ReponseErreurAPI;
    const code = erreurApi.code_erreur || "";
    if (!CODES_SANS_RAFRAICHISSEMENT.has(code)) {
      const rafraichi = await tenterRafraichissement();
      if (rafraichi) {
        return appel_api<T>(chemin, { ...options, _retry: true });
      }
    }
    // 🔑 Rafraîchissement impossible (rôle modifié, token invalide, etc.)
    // → Déclencher l'événement pour que le contexte d'authentification
    //   déconnecte l'utilisateur et le redirige vers la connexion
    declencherEvenementAuthExpire();
    throw new ErreurAPI(
      "AUTH_TOKEN_EXPIRE",
      "Session expirée. Veuillez vous reconnecter.",
      401,
    );
  }

  // Réponse d'erreur ?
  if (!reponse.ok) {
    const erreurApi = donnees as ReponseErreurAPI;
    throw new ErreurAPI(
      erreurApi.code_erreur || "INCONNU",
      erreurApi.message || "Erreur inconnue",
      reponse.status,
      erreurApi.request_id || undefined,
    );
  }

  return donnees as T;
}

// -----------------------------------------------------------------------------
// API publique — méthodes typées
// -----------------------------------------------------------------------------

export const clientAPI = {
  get: <T>(chemin: string, options?: OptionsRequete) =>
    appel_api<T>(chemin, { ...options, method: "GET" }),

  post: <T>(chemin: string, donnees?: unknown, options?: OptionsRequete) =>
    appel_api<T>(chemin, {
      ...options,
      method: "POST",
      body: donnees ? JSON.stringify(donnees) : undefined,
    }),

  patch: <T>(chemin: string, donnees?: unknown, options?: OptionsRequete) =>
    appel_api<T>(chemin, {
      ...options,
      method: "PATCH",
      body: donnees ? JSON.stringify(donnees) : undefined,
    }),

  delete: <T>(chemin: string, options?: OptionsRequete) =>
    appel_api<T>(chemin, { ...options, method: "DELETE" }),

  put: <T>(chemin: string, donnees?: unknown, options?: OptionsRequete) =>
    appel_api<T>(chemin, {
      ...options,
      method: "PUT",
      body: donnees ? JSON.stringify(donnees) : undefined,
    }),
};
